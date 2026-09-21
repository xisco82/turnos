import { AppConfig, DayOfWeek, Employee, ScheduleRow, Shift } from './types';
import { DAYS_OF_WEEK, ShiftConst } from './constants';

interface ShiftAssignment {
  employeeId: string;
  day: DayOfWeek;
  shift: Shift;
}

// Helper to check if a date is within a request range
export const isDateInRange = (dateStr: string, startDate: string, endDate: string): boolean => {
  const d = new Date(dateStr);
  const start = new Date(startDate);
  const end = new Date(endDate);
  d.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return d >= start && d <= end;
};

// Helper to get actual date string for a specific DayOfWeek in current week
export const getDateForDay = (startOfWeek: Date = new Date(), day: DayOfWeek): string => {
  const base = startOfWeek instanceof Date && !isNaN(startOfWeek.getTime()) ? startOfWeek : new Date();
  const d = new Date(base);
  const offset = DAYS_OF_WEEK.indexOf(day);
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

/**
 * Calcula dinámicamente los días posteriores al bloque de cobertura nocturna:
 * Encuentra el último día trabajado de noche y devuelve los 3 días siguientes en la semana.
 */
export function getPostNightSequenceDays(coverageDays: DayOfWeek[]): DayOfWeek[] {
  if (!coverageDays || coverageDays.length === 0) return [];

  // Encontrar el día de cobertura cuyo día siguiente en DAYS_OF_WEEK no esté en coverageDays
  let lastDay = coverageDays[0];
  for (const day of coverageDays) {
    const idx = DAYS_OF_WEEK.indexOf(day);
    const nextDay = DAYS_OF_WEEK[(idx + 1) % DAYS_OF_WEEK.length];
    if (!coverageDays.includes(nextDay)) {
      lastDay = day;
      break;
    }
  }

  const lastIdx = DAYS_OF_WEEK.indexOf(lastDay);
  return [
    DAYS_OF_WEEK[(lastIdx + 1) % DAYS_OF_WEEK.length],
    DAYS_OF_WEEK[(lastIdx + 2) % DAYS_OF_WEEK.length],
    DAYS_OF_WEEK[(lastIdx + 3) % DAYS_OF_WEEK.length],
  ];
}

/**
 * Motor de generación de turnos semanal basado en las reglas del hotel:
 * 1. Todos los empleados a jornada completa trabajan 5 días y libran 2 días consecutivos (L).
 * 2. Mínimos de servicio:
 *    - Lunes a Jueves: 3 Mañanas (M), 2 Tardes (T), 1 Noche (N)
 *    - Viernes a Domingo: 4 Mañanas (M), 2 Tardes (T), 1 Noche (N)
 * 3. Reglas fijas:
 *    - Xisco (Jefe): Libres Viernes y Sábado. Trabaja siempre de Mañana (M).
 *    - Aliz (Subjefe): Libres Domingo y Lunes. Trabaja Martes a Sábado (M o T).
 *    - Oscar (Conserje): Libres Lunes y Martes. Trabaja Noche (N) Miércoles a Domingo.
 *    - Lorena (Ayudante): Libres L-M-X-J. Viernes: Tarde 16-20 (refuerzo). Sábado: M. Domingo: M.
 *    - Peticiones/Bajas: Si Toni (o cualquier otro) está de baja o vacaciones, se respeta estrictamente.
 * 4. Noche de Lunes y Martes:
 *    - La cubre un recepcionista en rotación semanal:
 *      Lunes: N, Martes: N, Miércoles: T, Jueves: L, Viernes: L, Sábado: M/T, Domingo: M/T.
 * 5. Rotación de días libres para el resto de plantilla:
 *    - Las parejas de días libres rotan determinísticamente cada semana según weekNumber.
 * 6. Asignación de turnos M y T:
 *    - 2 personas de Tarde por día, evitando turno T seguido de M al día siguiente siempre que sea posible.
 *    - El resto de personal en servicio hace Mañana (M).
 */
export function generateWeeklySchedule(
  config: AppConfig,
  weekNumber: number,
  startOfWeek: Date = new Date(),
  overrides?: Record<string, Shift> // key: `${employeeId}-${day}`
): ScheduleRow[] {
  if (!config.isConfigured) return [];

  // 1. Preparar lista de empleados: Oscar en 3ª posición después de Aliz (Jefe, Subjefe, Conserje, ...)
  const cleanAyudantes = (config.ayudantes || []).filter(name => name.trim().toUpperCase() !== 'LORENA');
  const employees: { id: string; name: string; role: string }[] = [
    { id: 'jefe', name: config.jefe, role: 'Jefe' },
    { id: 'subjefe', name: config.subjefe, role: '2º Jefe' },
    { id: 'conserje', name: config.conserje, role: 'Conserje' },
    ...config.recepcionistas.map((name, i) => ({ id: `rec-${i}`, name, role: 'Recepcionista' })),
    ...cleanAyudantes.map((name, i) => ({ id: `ayu-${i}`, name, role: 'Ayudante' })),
    ...config.extraEmployees.map(e => ({ id: e.id, name: e.name, role: e.role }))
  ].filter(e => e.name.trim() !== '');

  // Mapa de turnos asignados: employeeId -> (DayOfWeek -> Shift)
  const schedule = new Map<string, Map<DayOfWeek, Shift>>();
  employees.forEach(e => schedule.set(e.id, new Map<DayOfWeek, Shift>()));

  const setShift = (id: string, day: DayOfWeek, shift: Shift) => {
    schedule.get(id)?.set(day, shift);
  };

  const getShift = (id: string, day: DayOfWeek): Shift | undefined => {
    return schedule.get(id)?.get(day);
  };

  const hasShift = (id: string, day: DayOfWeek): boolean => {
    return schedule.get(id)?.has(day) ?? false;
  };

  // 2. APLICAR PETICIONES Y BAJAS (Prioridad máxima)
  employees.forEach(emp => {
    DAYS_OF_WEEK.forEach(day => {
      const dateStr = getDateForDay(startOfWeek, day);
      const req = config.requests?.find(r => r.employeeId === emp.id && isDateInRange(dateStr, r.startDate, r.endDate));
      if (req) {
        const s = req.type === 'Baja' 
          ? ShiftConst.Paternity 
          : req.type === 'Vacaciones' 
          ? ShiftConst.Vacation 
          : req.type === 'Festivo' 
          ? ShiftConst.Festive 
          : ShiftConst.Petition;
        setShift(emp.id, day, s);
      }
    });
  });

  // 2.1 APLICAR TURNOS FIJOS CONFIGURADOS EN DÍAS CONCRETOS (Jefe, 2º Jefe, etc.)
  employees.forEach(emp => {
    const empFixedShifts = config.fixedShifts?.[emp.id] || (config.fixedShifts as any)?.[emp.name];
    if (empFixedShifts) {
      DAYS_OF_WEEK.forEach(day => {
        const fixedShift = empFixedShifts[day];
        if (fixedShift && !hasShift(emp.id, day)) {
          setShift(emp.id, day, fixedShift);
        }
      });
    }
  });

  // 3. IDENTIFICAR EMPLEADOS CLAVE
  const xisco = employees.find(e => e.id === 'jefe');
  const aliz = employees.find(e => e.id === 'subjefe');
  const oscar = employees.find(e => e.id === 'conserje');

  // 5. REGLA OSCAR (Conserje de Noche)
  // La fuente de verdad son los días libres seleccionados en Ajustes
  const dias_libres_conserje_noche: DayOfWeek[] = config.fixedOffDays?.['conserje'] || [];
  if (oscar) {
    dias_libres_conserje_noche.forEach(d => {
      if (!hasShift(oscar.id, d)) setShift(oscar.id, d, ShiftConst.Off);
    });
    // Las noches que no libra, hace Noche
    DAYS_OF_WEEK.forEach(d => {
      if (!hasShift(oscar.id, d)) setShift(oscar.id, d, ShiftConst.Night);
    });
  }

  // 6. REGLA XISCO (Jefe)
  if (xisco) {
    const xiscoFixed = config.fixedOffDays?.['jefe'] !== undefined
      ? config.fixedOffDays['jefe']
      : [DayOfWeek.Friday, DayOfWeek.Saturday];
    xiscoFixed.forEach(d => {
      if (!hasShift(xisco.id, d)) setShift(xisco.id, d, ShiftConst.Off);
    });
    // Si no tiene turno fijo en un día que trabaja, por defecto Xisco hace Mañana (M)
    DAYS_OF_WEEK.forEach(d => {
      if (!hasShift(xisco.id, d)) setShift(xisco.id, d, ShiftConst.Morning);
    });
  }

  // 7. REGLA ALIZ (2º Jefe)
  if (aliz) {
    const alizFixed = config.fixedOffDays?.['subjefe'] !== undefined
      ? config.fixedOffDays['subjefe']
      : [DayOfWeek.Sunday, DayOfWeek.Monday];
    alizFixed.forEach(d => {
      if (!hasShift(aliz.id, d)) setShift(aliz.id, d, ShiftConst.Off);
    });
  }

  // 8. RESPETAR DÍAS LIBRES FIJOS CONFIGURADOS EN EL SETUP FORM
  employees.forEach(emp => {
    if (['jefe', 'subjefe', 'conserje'].includes(emp.id)) return;
    const customFixed = config.fixedOffDays?.[emp.id];
    if (customFixed && customFixed.length > 0) {
      customFixed.forEach(d => {
        if (!hasShift(emp.id, d)) setShift(emp.id, d, ShiftConst.Off);
      });
    }
  });

  // 9. TURNO DE NOCHE POR OTRO TRABAJADOR (COBERTURA DINÁMICA)
  // REGLA PRINCIPAL: Días a cubrir = días libres seleccionados del conserje de noche
  const dias_a_cubrir: DayOfWeek[] = dias_libres_conserje_noche;

  const allRecepcionistas = employees.filter(e => e.role === 'Recepcionista');
  const availableRecepcionistas = allRecepcionistas.filter(r => {
    // Si tiene baja o vacaciones en alguno de los días a cubrir, no puede hacer noche
    const isBlocked = dias_a_cubrir.some(d => {
      const s = getShift(r.id, d);
      return [ShiftConst.Paternity, ShiftConst.Vacation].includes(s as any);
    });
    return !isBlocked;
  });

  let nightRecepcionista: { id: string; name: string; role: string } | undefined;
  let activePostNightRule: 'Afternoon' | 'Off' = config.postNightBehaviour || 'Afternoon';

  if (dias_a_cubrir.length > 0 && availableRecepcionistas.length > 0) {
    const nightIndex = Math.abs(weekNumber) % availableRecepcionistas.length;
    nightRecepcionista = availableRecepcionistas[nightIndex];

    // Preferencia individual del empleado o regla global configurada
    if (config.employeePostNightPreferences) {
      if (config.employeePostNightPreferences[nightRecepcionista.id]) {
        activePostNightRule = config.employeePostNightPreferences[nightRecepcionista.id];
      } else if (config.employeePostNightPreferences[nightRecepcionista.name]) {
        activePostNightRule = config.employeePostNightPreferences[nightRecepcionista.name];
      }
    }

    // Asignar el turno de Noche (N) a todos los días que necesitan cobertura
    dias_a_cubrir.forEach(d => {
      if (!hasShift(nightRecepcionista.id, d)) {
        setShift(nightRecepcionista.id, d, ShiftConst.Night);
      }
    });

    // Calcular días posteriores dinámicamente según la salida del bloque nocturno
    const [day1PostNight, day2PostNight, day3PostNight] = getPostNightSequenceDays(dias_a_cubrir);

    if (activePostNightRule === 'Off') {
      // REGLA: 2 DÍAS LIBRES CONSECUTIVOS DIRECTOS TRAS LA NOCHE
      if (day1PostNight && !hasShift(nightRecepcionista.id, day1PostNight)) {
        setShift(nightRecepcionista.id, day1PostNight, ShiftConst.Off);
      }
      if (day2PostNight && !hasShift(nightRecepcionista.id, day2PostNight)) {
        setShift(nightRecepcionista.id, day2PostNight, ShiftConst.Off);
      }
    } else {
      // REGLA: TURNO DE TARDE DESPUÉS DE LA NOCHE
      // Día 1 entra de Tarde (descansa por la mañana y trabaja de 16:00 a 00:00)
      if (day1PostNight && !hasShift(nightRecepcionista.id, day1PostNight)) {
        setShift(nightRecepcionista.id, day1PostNight, ShiftConst.Afternoon);
      }
      // Días 2 y 3 son sus 2 días libres consecutivos
      if (day2PostNight && !hasShift(nightRecepcionista.id, day2PostNight)) {
        setShift(nightRecepcionista.id, day2PostNight, ShiftConst.Off);
      }
      if (day3PostNight && !hasShift(nightRecepcionista.id, day3PostNight)) {
        setShift(nightRecepcionista.id, day3PostNight, ShiftConst.Off);
      }
    }
  }

  // 10. ASIGNAR LOS 2 DÍAS LIBRES CONSECUTIVOS AL RESTO DE LA PLANTILLA
  const staffToAssignOffs = employees.filter(emp => {
    if (emp.id === 'jefe' || emp.id === 'subjefe' || emp.id === 'conserje') return false;
    if (emp.id === nightRecepcionista?.id) return false;
    // Si ya tiene 2 o más días de baja/vacaciones/libres fijos, no añadir más
    const existingOffs = Array.from(schedule.get(emp.id)?.values() || []).filter(
      s => [ShiftConst.Off, ShiftConst.Vacation, ShiftConst.Paternity].includes(s)
    ).length;
    return existingOffs < 2;
  });

  // Para los Ayudantes: desfasar sus días libres para que NUNCA coincidan en descanso
  // Así siempre habrá exactamente un ayudante disponible para cubrir la tarde requerida
  const ayudantesToAssign = staffToAssignOffs.filter(e => e.role === 'Ayudante');
  const recepcionistasToAssign = staffToAssignOffs.filter(e => e.role !== 'Ayudante');

  const ayudanteOffPatterns: DayOfWeek[][] = [
    [DayOfWeek.Monday, DayOfWeek.Tuesday],
    [DayOfWeek.Wednesday, DayOfWeek.Thursday],
    [DayOfWeek.Friday, DayOfWeek.Saturday],
    [DayOfWeek.Sunday, DayOfWeek.Monday]
  ];

  ayudantesToAssign.forEach((emp, idx) => {
    const existingOffsCount = Array.from(schedule.get(emp.id)?.values() || []).filter(
      s => [ShiftConst.Off, ShiftConst.Vacation, ShiftConst.Paternity].includes(s)
    ).length;
    if (existingOffsCount >= 2) return;

    // Desfase matemático: idx * 2 garantiza que Inés y Jakeline tengan bloques de libres distintos
    const patternIdx = (idx * 2 + weekNumber) % ayudanteOffPatterns.length;
    const assignedPair = ayudanteOffPatterns[patternIdx];

    if (!hasShift(emp.id, assignedPair[0]) && !hasShift(emp.id, assignedPair[1])) {
      setShift(emp.id, assignedPair[0], ShiftConst.Off);
      setShift(emp.id, assignedPair[1], ShiftConst.Off);
    } else {
      for (const pair of ayudanteOffPatterns) {
        if (!hasShift(emp.id, pair[0]) && !hasShift(emp.id, pair[1])) {
          setShift(emp.id, pair[0], ShiftConst.Off);
          setShift(emp.id, pair[1], ShiftConst.Off);
          break;
        }
      }
    }
  });

  // Parejas consecutivas óptimas calculadas matemáticamente para cuadrar la plantilla según la regla post-noche:
  const rotatingOffPatterns: DayOfWeek[][] = activePostNightRule === 'Off'
    ? [
        [DayOfWeek.Monday, DayOfWeek.Tuesday],
        [DayOfWeek.Tuesday, DayOfWeek.Wednesday],
        [DayOfWeek.Thursday, DayOfWeek.Friday],
        [DayOfWeek.Friday, DayOfWeek.Saturday],
        [DayOfWeek.Saturday, DayOfWeek.Sunday]
      ]
    : [
        [DayOfWeek.Monday, DayOfWeek.Tuesday],
        [DayOfWeek.Tuesday, DayOfWeek.Wednesday],
        [DayOfWeek.Wednesday, DayOfWeek.Thursday],
        [DayOfWeek.Wednesday, DayOfWeek.Thursday],
        [DayOfWeek.Saturday, DayOfWeek.Sunday]
      ];

  // Asignar a cada recepcionista su patrón de libres rotado según weekNumber
  recepcionistasToAssign.forEach((emp, idx) => {
    const existingOffsCount = Array.from(schedule.get(emp.id)?.values() || []).filter(
      s => [ShiftConst.Off, ShiftConst.Vacation, ShiftConst.Paternity].includes(s)
    ).length;
    if (existingOffsCount >= 2) return;

    // Calcular índice del patrón rotado
    const patternIdx = (idx + weekNumber) % rotatingOffPatterns.length;
    const assignedPair = rotatingOffPatterns[patternIdx];

    // Si los dos días están libres, asignarlos
    if (!hasShift(emp.id, assignedPair[0]) && !hasShift(emp.id, assignedPair[1])) {
      setShift(emp.id, assignedPair[0], ShiftConst.Off);
      setShift(emp.id, assignedPair[1], ShiftConst.Off);
    } else {
      // Fallback: buscar otra pareja consecutiva disponible
      const allConsecutivePairs: DayOfWeek[][] = [
        [DayOfWeek.Saturday, DayOfWeek.Sunday],
        [DayOfWeek.Sunday, DayOfWeek.Monday],
        [DayOfWeek.Monday, DayOfWeek.Tuesday],
        [DayOfWeek.Tuesday, DayOfWeek.Wednesday],
        [DayOfWeek.Wednesday, DayOfWeek.Thursday],
        [DayOfWeek.Thursday, DayOfWeek.Friday],
        [DayOfWeek.Friday, DayOfWeek.Saturday]
      ];
      let assigned = false;
      for (const pair of allConsecutivePairs) {
        if (!hasShift(emp.id, pair[0]) && !hasShift(emp.id, pair[1])) {
          setShift(emp.id, pair[0], ShiftConst.Off);
          setShift(emp.id, pair[1], ShiftConst.Off);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        // Asignar los días restantes hasta 2
        let currentOffs = Array.from(schedule.get(emp.id)?.values() || []).filter(
          s => [ShiftConst.Off, ShiftConst.Vacation, ShiftConst.Paternity].includes(s)
        ).length;
        for (const d of DAYS_OF_WEEK) {
          if (currentOffs >= 2) break;
          if (!hasShift(emp.id, d)) {
            setShift(emp.id, d, ShiftConst.Off);
            currentOffs++;
          }
        }
      }
    }
  });

  // 11. ASIGNACIÓN DE TURNOS DE TRABAJO (Tarde 'T' y Mañana 'M') DÍA A DÍA
  // Requisitos obligatorios pedidos por el usuario:
  // 1. MÁXIMOS DIARIOS:
  //    - Lunes, Martes, Miércoles y Jueves: MÁXIMO 3 de Mañana (M) y 2 de Tarde (T).
  //    - Viernes, Sábado y Domingo: MÁXIMO 4 de Mañana (M) y 2 de Tarde (T).
  // 2. DESCANSO ENTRE JORNADAS:
  //    - "SI TRABAJA DE TARDE NO TRABAJE DE MAÑANA":
  //      Si un empleado trabajó de Tarde (T) ayer, TIENE PROHIBIDO trabajar de Mañana (M) hoy.
  //      Tampoco se le asigna T hoy si ya tiene fijada una Mañana (M) mañana.
  // 3. COMPOSICIÓN DE LA TARDE:
  //    - "POR LAS TARDES NO PUEDE HABER 2 AYUDANTES JUNTOS. SIEMPRE TIENE QUE SER UN RECEPCIONISTA Y UN AYUDANTE."
  //      Máximo estricto de 1 Ayudante en turno de Tarde por día.
  DAYS_OF_WEEK.forEach((day, dayIndex) => {
    const isWeekend = [DayOfWeek.Friday, DayOfWeek.Saturday, DayOfWeek.Sunday].includes(day);
    const maxM = isWeekend ? 4 : 3;
    const maxT = 2;

    const prevDay = dayIndex > 0 ? DAYS_OF_WEEK[dayIndex - 1] : undefined;
    const nextDay = dayIndex < DAYS_OF_WEEK.length - 1 ? DAYS_OF_WEEK[dayIndex + 1] : undefined;

    // Helper: ¿Trabajó de Tarde el día anterior?
    const workedYesterdayT = (empId: string) => {
      if (!prevDay) return false;
      return getShift(empId, prevDay) === ShiftConst.Afternoon;
    };

    // Helper: ¿Tiene turno de Mañana fijado para mañana?
    const hasMorningTomorrow = (empId: string) => {
      if (!nextDay) return false;
      return getShift(empId, nextDay) === ShiftConst.Morning;
    };

    // Contar cuántas Tardes y Mañanas ya están asignadas este día
    let countT = 0;
    let countM = 0;
    let countAyudanteT = 0;
    let countRecepT = 0;

    employees.forEach(emp => {
      const s = getShift(emp.id, day);
      if (s === ShiftConst.Afternoon) {
        countT++;
        if (emp.role === 'Ayudante') countAyudanteT++;
        else countRecepT++;
      }
      if (s === ShiftConst.Morning) countM++;
    });

    // 11.A ASIGNACIÓN DE TURNOS DE TARDE (T)
    // REGLA: SIEMPRE 1 RECEPCIONISTA (O SUBJEFE) Y 1 AYUDANTE. NUNCA 2 AYUDANTES JUNTOS.
    let neededT = Math.max(0, maxT - countT);

    if (neededT > 0) {
      // Elegibilidad para Tarde hoy:
      // - No tiene turno hoy
      // - No es el Jefe (Xisco trabaja solo de Mañana)
      // - No es el Conserje (Oscar realiza noche)
      // - No tiene Mañana fijada para mañana (para no violar T -> M)
      const canDoT = (emp: { id: string; role: string }) => {
        if (hasShift(emp.id, day)) return false;
        if (emp.id === 'jefe' || emp.id === 'conserje') return false;
        if (hasMorningTomorrow(emp.id)) return false;
        return true;
      };

      // 1. Asignar 1 Ayudante a Tarde si aún no hay ninguno
      if (countAyudanteT < 1 && neededT > 0) {
        const ayudanteCandidates = employees.filter(e => e.role === 'Ayudante' && canDoT(e));
        // Priorizar al que trabajó T ayer (mantiene bloque de tarde sin conflicto con M)
        // luego al que menos T lleve esta semana
        ayudanteCandidates.sort((a, b) => {
          const aPrevT = workedYesterdayT(a.id) ? 1 : 0;
          const bPrevT = workedYesterdayT(b.id) ? 1 : 0;
          if (aPrevT !== bPrevT) return bPrevT - aPrevT;
          const aT = Array.from(schedule.get(a.id)?.values() || []).filter(s => s === ShiftConst.Afternoon).length;
          const bT = Array.from(schedule.get(b.id)?.values() || []).filter(s => s === ShiftConst.Afternoon).length;
          if (aT !== bT) return aT - bT;
          return a.name.localeCompare(b.name);
        });

        if (ayudanteCandidates.length > 0) {
          const chosenAyudante = ayudanteCandidates[0];
          setShift(chosenAyudante.id, day, ShiftConst.Afternoon);
          countT++;
          countAyudanteT++;
          neededT--;
        }
      }

      // 2. Asignar 1 Recepcionista (o 2º Jefe) a Tarde si aún no hay ninguno
      if (countRecepT < 1 && neededT > 0) {
        const recepCandidates = employees.filter(e => (e.role === 'Recepcionista' || e.role === '2º Jefe') && canDoT(e));
        recepCandidates.sort((a, b) => {
          const aPrevT = workedYesterdayT(a.id) ? 1 : 0;
          const bPrevT = workedYesterdayT(b.id) ? 1 : 0;
          if (aPrevT !== bPrevT) return bPrevT - aPrevT;
          const aT = Array.from(schedule.get(a.id)?.values() || []).filter(s => s === ShiftConst.Afternoon).length;
          const bT = Array.from(schedule.get(b.id)?.values() || []).filter(s => s === ShiftConst.Afternoon).length;
          if (aT !== bT) return aT - bT;
          const aVal = (parseInt(a.id.replace(/\D/g, '') || '0', 10) + weekNumber + dayIndex) % 7;
          const bVal = (parseInt(b.id.replace(/\D/g, '') || '0', 10) + weekNumber + dayIndex) % 7;
          return aVal - bVal;
        });

        if (recepCandidates.length > 0) {
          const chosenRecep = recepCandidates[0];
          setShift(chosenRecep.id, day, ShiftConst.Afternoon);
          countT++;
          countRecepT++;
          neededT--;
        }
      }

      // 3. Si aún queda un hueco en Tarde (por ejemplo, si ambos Ayudantes tenían libre/vacaciones):
      // NUNCA asignamos un segundo Ayudante ("no puede haber 2 ayudantes juntos").
      // Se asigna otro Recepcionista / Subjefe disponible:
      while (neededT > 0) {
        const extraRecepCandidates = employees.filter(e => (e.role === 'Recepcionista' || e.role === '2º Jefe') && canDoT(e));
        if (extraRecepCandidates.length === 0) break;
        extraRecepCandidates.sort((a, b) => {
          const aPrevT = workedYesterdayT(a.id) ? 1 : 0;
          const bPrevT = workedYesterdayT(b.id) ? 1 : 0;
          if (aPrevT !== bPrevT) return bPrevT - aPrevT;
          const aT = Array.from(schedule.get(a.id)?.values() || []).filter(s => s === ShiftConst.Afternoon).length;
          const bT = Array.from(schedule.get(b.id)?.values() || []).filter(s => s === ShiftConst.Afternoon).length;
          return aT - bT;
        });
        const extraChosen = extraRecepCandidates[0];
        setShift(extraChosen.id, day, ShiftConst.Afternoon);
        countT++;
        countRecepT++;
        neededT--;
      }
    }

    // 11.B ENFORCEMENT: "SI TRABAJA DE TARDE NO TRABAJE DE MAÑANA"
    // Cualquier empleado que trabajó de Tarde ayer y que aún no tenga turno hoy,
    // TIENE TERMINANTEMENTE PROHIBIDO TRABAJAR DE MAÑANA (M) HOY.
    // Como las Tardes de hoy ya están cubiertas, debe asignársele Libre (L) de descanso:
    employees.forEach(emp => {
      if (!hasShift(emp.id, day) && workedYesterdayT(emp.id)) {
        setShift(emp.id, day, ShiftConst.Off);
      }
    });

    // 11.C ASIGNACIÓN DE TURNOS DE MAÑANA (M) HASTA EL MÁXIMO PERMITIDO (3 L-J, 4 V-D)
    const neededM = Math.max(0, maxM - countM);
    const morningCandidates = employees.filter(emp => !hasShift(emp.id, day));

    // Priorizar al Jefe Xisco y 2º Jefe Aliz de Mañana si están disponibles
    morningCandidates.sort((a, b) => {
      if (a.id === 'jefe') return -1;
      if (b.id === 'jefe') return 1;
      if (a.id === 'subjefe') return -1;
      if (b.id === 'subjefe') return 1;
      const aOffs = Array.from(schedule.get(a.id)?.values() || []).filter(
        s => [ShiftConst.Off, ShiftConst.Vacation, ShiftConst.Paternity, ShiftConst.Festive].includes(s as any)
      ).length;
      const bOffs = Array.from(schedule.get(b.id)?.values() || []).filter(
        s => [ShiftConst.Off, ShiftConst.Vacation, ShiftConst.Paternity, ShiftConst.Festive].includes(s as any)
      ).length;
      if (aOffs !== bOffs) return aOffs - bOffs;
      return (parseInt(a.id.replace(/\D/g, '') || '0', 10) + weekNumber) - (parseInt(b.id.replace(/\D/g, '') || '0', 10) + weekNumber);
    });

    let assignedM = 0;
    for (const emp of morningCandidates) {
      if (assignedM < neededM) {
        setShift(emp.id, day, ShiftConst.Morning);
        assignedM++;
      } else {
        // Excedente no puede superar el cupo máximo exigido por el usuario
        setShift(emp.id, day, ShiftConst.Off);
      }
    }
  });

  // 12. APLICAR OVERRIDES MANUALES (si el usuario ha hecho ajustes personalizados)
  if (overrides) {
    Object.entries(overrides).forEach(([key, overrideShift]) => {
      // key: `${employeeId}-${day}`
      const [empId, dayStr] = key.split('-');
      if (empId && dayStr && schedule.has(empId)) {
        setShift(empId, dayStr as DayOfWeek, overrideShift);
      }
    });
  }

  // 13. GENERAR RESULTADO FINAL DE FILAS
  return employees.map(emp => ({
    employeeId: emp.id,
    employeeName: emp.name,
    role: emp.role,
    shifts: DAYS_OF_WEEK.map(day => ({
      day,
      shift: getShift(emp.id, day) || ShiftConst.Off
    }))
  }));
}
