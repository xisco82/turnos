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
export const getDateForDay = (startOfWeek: Date, day: DayOfWeek): string => {
  const d = new Date(startOfWeek);
  const offset = DAYS_OF_WEEK.indexOf(day);
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

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
  startOfWeek: Date,
  overrides?: Record<string, Shift> // key: `${employeeId}-${day}`
): ScheduleRow[] {
  if (!config.isConfigured) return [];

  // 1. Preparar lista de empleados
  const employees: { id: string; name: string; role: string }[] = [
    { id: 'jefe', name: config.jefe, role: 'Jefe' },
    { id: 'subjefe', name: config.subjefe, role: 'Subjefe' },
    ...config.recepcionistas.map((name, i) => ({ id: `rec-${i}`, name, role: 'Recepcionista' })),
    ...config.ayudantes.map((name, i) => ({ id: `ayu-${i}`, name, role: 'Ayudante' })),
    { id: 'conserje', name: config.conserje, role: 'Conserje' },
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

  // 3. IDENTIFICAR EMPLEADOS CLAVE
  const xisco = employees.find(e => e.id === 'jefe');
  const aliz = employees.find(e => e.id === 'subjefe');
  const oscar = employees.find(e => e.id === 'conserje');
  const lorena = employees.find(e => e.name.toUpperCase().includes('LORENA'));

  // 4. REGLA LORENA (Jornada reducida fin de semana)
  if (lorena) {
    if (!hasShift(lorena.id, DayOfWeek.Monday)) setShift(lorena.id, DayOfWeek.Monday, ShiftConst.Off);
    if (!hasShift(lorena.id, DayOfWeek.Tuesday)) setShift(lorena.id, DayOfWeek.Tuesday, ShiftConst.Off);
    if (!hasShift(lorena.id, DayOfWeek.Wednesday)) setShift(lorena.id, DayOfWeek.Wednesday, ShiftConst.Off);
    if (!hasShift(lorena.id, DayOfWeek.Thursday)) setShift(lorena.id, DayOfWeek.Thursday, ShiftConst.Off);
    if (!hasShift(lorena.id, DayOfWeek.Friday)) setShift(lorena.id, DayOfWeek.Friday, ShiftConst.LorenaSpecial);
    if (!hasShift(lorena.id, DayOfWeek.Saturday)) setShift(lorena.id, DayOfWeek.Saturday, ShiftConst.Morning);
    if (!hasShift(lorena.id, DayOfWeek.Sunday)) setShift(lorena.id, DayOfWeek.Sunday, ShiftConst.Morning);
  }

  // 5. REGLA OSCAR (Conserje de Noche)
  if (oscar) {
    const oscarFixed = config.fixedOffDays?.['conserje'] || [DayOfWeek.Monday, DayOfWeek.Tuesday];
    oscarFixed.forEach(d => {
      if (!hasShift(oscar.id, d)) setShift(oscar.id, d, ShiftConst.Off);
    });
    // Las noches que no libra, hace Noche
    DAYS_OF_WEEK.forEach(d => {
      if (!hasShift(oscar.id, d)) setShift(oscar.id, d, ShiftConst.Night);
    });
  }

  // 6. REGLA XISCO (Jefe)
  if (xisco) {
    const xiscoFixed = config.fixedOffDays?.['jefe'] || [DayOfWeek.Friday, DayOfWeek.Saturday];
    xiscoFixed.forEach(d => {
      if (!hasShift(xisco.id, d)) setShift(xisco.id, d, ShiftConst.Off);
    });
    // Xisco siempre trabaja de Mañana (M)
    DAYS_OF_WEEK.forEach(d => {
      if (!hasShift(xisco.id, d)) setShift(xisco.id, d, ShiftConst.Morning);
    });
  }

  // 7. REGLA ALIZ (Subjefe)
  if (aliz) {
    const alizFixed = config.fixedOffDays?.['subjefe'] || [DayOfWeek.Sunday, DayOfWeek.Monday];
    alizFixed.forEach(d => {
      if (!hasShift(aliz.id, d)) setShift(aliz.id, d, ShiftConst.Off);
    });
  }

  // 8. RESPETAR DÍAS LIBRES FIJOS CONFIGURADOS EN EL SETUP FORM
  employees.forEach(emp => {
    if (['jefe', 'subjefe', 'conserje'].includes(emp.id)) return;
    if (emp.id === lorena?.id) return;
    const customFixed = config.fixedOffDays?.[emp.id];
    if (customFixed && customFixed.length > 0) {
      customFixed.forEach(d => {
        if (!hasShift(emp.id, d)) setShift(emp.id, d, ShiftConst.Off);
      });
    }
  });

  // 9. TURNO DE NOCHE DE RECEPCIÓN (Lunes y Martes)
  // Oscar libra Lunes y Martes noche. Debe cubrirlo un recepcionista que esté activo (no de baja ni de vacaciones esa semana).
  const allRecepcionistas = employees.filter(e => e.role === 'Recepcionista');
  const availableRecepcionistas = allRecepcionistas.filter(r => {
    // Si tiene baja o vacaciones en Lunes o Martes, no puede hacer noche
    const mShift = getShift(r.id, DayOfWeek.Monday);
    const tShift = getShift(r.id, DayOfWeek.Tuesday);
    const isBlocked = [ShiftConst.Paternity, ShiftConst.Vacation].includes(mShift as any) ||
                      [ShiftConst.Paternity, ShiftConst.Vacation].includes(tShift as any);
    return !isBlocked;
  });

  let nightRecepcionista: { id: string; name: string; role: string } | undefined;
  if (availableRecepcionistas.length > 0) {
    const nightIndex = Math.abs(weekNumber) % availableRecepcionistas.length;
    nightRecepcionista = availableRecepcionistas[nightIndex];

    if (!hasShift(nightRecepcionista.id, DayOfWeek.Monday)) setShift(nightRecepcionista.id, DayOfWeek.Monday, ShiftConst.Night);
    if (!hasShift(nightRecepcionista.id, DayOfWeek.Tuesday)) setShift(nightRecepcionista.id, DayOfWeek.Tuesday, ShiftConst.Night);
    if (!hasShift(nightRecepcionista.id, DayOfWeek.Wednesday)) setShift(nightRecepcionista.id, DayOfWeek.Wednesday, ShiftConst.Afternoon);
    if (!hasShift(nightRecepcionista.id, DayOfWeek.Thursday)) setShift(nightRecepcionista.id, DayOfWeek.Thursday, ShiftConst.Off);
    if (!hasShift(nightRecepcionista.id, DayOfWeek.Friday)) setShift(nightRecepcionista.id, DayOfWeek.Friday, ShiftConst.Off);
  }

  // 10. ASIGNAR LOS 2 DÍAS LIBRES CONSECUTIVOS AL RESTO DE LA PLANTILLA
  // Empleados que necesitan sus 2 días libres asignados y rotativos:
  const staffToAssignOffs = employees.filter(emp => {
    if (emp.id === 'jefe' || emp.id === 'subjefe' || emp.id === 'conserje') return false;
    if (emp.id === lorena?.id) return false;
    if (emp.id === nightRecepcionista?.id) return false;
    // Si ya tiene 2 o más días de baja/vacaciones/libres fijos, no añadir más
    const existingOffs = Array.from(schedule.get(emp.id)?.values() || []).filter(
      s => [ShiftConst.Off, ShiftConst.Vacation, ShiftConst.Paternity].includes(s)
    ).length;
    return existingOffs < 2;
  });

  // Parejas consecutivas óptimas calculadas matemáticamente para cuadrar la plantilla:
  // Lunes: 1 libre extra (+ Oscar, Aliz = 3 libres).
  // Martes: 2 libres extras (+ Oscar = 3 libres).
  // Miércoles: 3 libres extras (= 3 libres).
  // Jueves: 2 libres extras (+ NightRec = 3 libres).
  // Viernes: 0 libres extras (+ Xisco, NightRec = 2 libres).
  // Sábado: 1 libre extra (+ Xisco = 2 libres).
  // Domingo: 1 libre extra (+ Aliz = 2 libres).
  const rotatingOffPatterns: DayOfWeek[][] = [
    [DayOfWeek.Monday, DayOfWeek.Tuesday],
    [DayOfWeek.Tuesday, DayOfWeek.Wednesday],
    [DayOfWeek.Wednesday, DayOfWeek.Thursday],
    [DayOfWeek.Wednesday, DayOfWeek.Thursday],
    [DayOfWeek.Saturday, DayOfWeek.Sunday]
  ];

  // Asignar a cada empleado su patrón de libres rotado según weekNumber
  staffToAssignOffs.forEach((emp, idx) => {
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
  // Requisitos diarios:
  // - 1 Noche (ya asignada: Oscar o Recepcionista de noche).
  // - 2 Tardes (16:00 - 00:00).
  // - El resto de personal en servicio hace Mañana (M) (3 M de L-J, 4 M de V-D).
  DAYS_OF_WEEK.forEach((day, dayIndex) => {
    const prevDay = dayIndex > 0 ? DAYS_OF_WEEK[dayIndex - 1] : undefined;

    // Contar cuántas Tardes ya están asignadas este día
    let countT = 0;
    employees.forEach(emp => {
      const s = getShift(emp.id, day);
      if (s === ShiftConst.Afternoon) countT++;
      // Lorena en viernes hace 16-20 (refuerzo de tarde)
    });

    // Candidatos disponibles para trabajar en este día
    const availableForWork = employees.filter(emp => {
      return !hasShift(emp.id, day);
    });

    // Subjefe Aliz puede hacer Mañana o Tarde.
    // Xisco solo hace Mañana (M).

    // Para asignar las 2 Tardes necesarias:
    // Criterio:
    // 1. Quien no hizo Tarde el día anterior si es posible (para evitar T tarde seguida de M mañana si se puede, aunque aquí asignamos T tarde).
    // 2. Dar prioridad a recepcionistas y ayudantes, rotando según weekNumber + dayIndex.
    // 3. No asignar Tarde a Xisco.
    const afternoonCandidates = availableForWork.filter(emp => emp.id !== 'jefe');

    // Ordenar candidatos para equilibrar las tardes entre ellos a lo largo de la semana
    afternoonCandidates.sort((a, b) => {
      // Contar cuántas tardes tiene cada uno ya esta semana
      const aT = Array.from(schedule.get(a.id)?.values() || []).filter(s => s === ShiftConst.Afternoon).length;
      const bT = Array.from(schedule.get(b.id)?.values() || []).filter(s => s === ShiftConst.Afternoon).length;
      if (aT !== bT) return aT - bT; // El que menos tardes tenga primero

      // Desempate rotativo según semana y día
      const aVal = (parseInt(a.id.replace(/\D/g, '') || '0', 10) + weekNumber + dayIndex) % 7;
      const bVal = (parseInt(b.id.replace(/\D/g, '') || '0', 10) + weekNumber + dayIndex) % 7;
      return aVal - bVal;
    });

    // Asignar Tardes hasta llegar a 2
    while (countT < 2 && afternoonCandidates.length > 0) {
      const selected = afternoonCandidates.shift()!;
      setShift(selected.id, day, ShiftConst.Afternoon);
      countT++;
    }

    // Todos los demás trabajadores disponibles para este día HACEN MAÑANA (M)
    employees.forEach(emp => {
      if (!hasShift(emp.id, day)) {
        setShift(emp.id, day, ShiftConst.Morning);
      }
    });
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
