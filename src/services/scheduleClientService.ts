import { db } from '../lib/firebase-client.ts';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { 
  Employee, 
  ScheduleRequest, 
  Schedule, 
  Role, 
  DayOfWeek, 
  ShiftCode, 
  DAYS_ARRAY 
} from '../types.ts';

/**
 * GENERATES SCHEDULE ON CLIENT SIDE
 * Uses configuration from Firestore 'configuracion/reglasTurnos'
 */
export async function generateScheduleClient(weekNumber: number, year: number, shuffle: boolean = false): Promise<Schedule> {
  // 1. Fetch Data
  const employeesSnapshot = await getDocs(collection(db, 'employees'));
  const requestsSnapshot = await getDocs(collection(db, 'requests'));
  const configSnap = await getDoc(doc(db, 'configuracion', 'reglasTurnos'));
  const config = configSnap.exists() ? configSnap.data() : null;
  
  const employees = employeesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
  const requests = requestsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleRequest));

  // 2. Initial Data Structures
  const assignments: { [empId: string]: { [day: string]: string } } = {};
  const workDaysCount: { [empId: string]: number } = {};
  const offDaysCount: { [empId: string]: number } = {};

  const targetWorkDays = config?.objetivosSemanales?.diasTrabajo ?? 5;
  const targetOffDays = config?.objetivosSemanales?.diasLibres ?? 2;
  const libresConsecutivos = config?.objetivosSemanales?.libresConsecutivos ?? false;

  employees.forEach(emp => {
    assignments[emp.id] = {};
    workDaysCount[emp.id] = 0;
    offDaysCount[emp.id] = 0;
    DAYS_ARRAY.forEach(day => assignments[emp.id][day] = ''); 
  });

  const getDateOfDay = (day: DayOfWeek) => {
    const jan4 = new Date(year, 0, 4);
    const dayOfJan4 = jan4.getDay() || 7;
    const firstMon = new Date(jan4.getTime() - (dayOfJan4 - 1) * 24 * 60 * 60 * 1000);
    const weekStart = new Date(firstMon.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
    const dayIndex = DAYS_ARRAY.indexOf(day);
    const targetDate = new Date(weekStart.getTime() + dayIndex * 24 * 60 * 60 * 1000);
    return targetDate.toISOString().split('T')[0];
  };

  // 3. APPLY RIGID RULES
  // 3a. Fixed Rules for Jefes
  if (config) {
    employees.forEach(emp => {
      const name = emp.name.toLowerCase();
      if (name === config.jefeViernesSabadoLibre?.toLowerCase()) {
        assignments[emp.id][DayOfWeek.Friday] = ShiftCode.Off;
        assignments[emp.id][DayOfWeek.Saturday] = ShiftCode.Off;
        offDaysCount[emp.id] = 2;
      }
      if (name === config.jefeDomingoLunesLibre?.toLowerCase()) {
        assignments[emp.id][DayOfWeek.Sunday] = ShiftCode.Off;
        assignments[emp.id][DayOfWeek.Monday] = ShiftCode.Off;
        offDaysCount[emp.id] = 2;
      }
    });
  }

  // 3b. Requests (Vacations/Sick)
  requests.forEach(req => {
    if (assignments[req.employeeId]) {
      DAYS_ARRAY.forEach(day => {
        const dateStr = getDateOfDay(day);
        if (dateStr >= req.startDate && dateStr <= req.endDate) {
          assignments[req.employeeId][day] = req.type === 'Vacación' ? ShiftCode.Vacation : 
                                          req.type === 'Baja' ? ShiftCode.Sick : ShiftCode.Off;
          // Only increment off days if it was empty or not already an off code
          if (assignments[req.employeeId][day] !== '') offDaysCount[req.employeeId]++;
        }
      });
    }
  });

  // 3c. Concierge (Oscar) and Substitution
  if (config && config.rotacionCoberturaConserje?.activo) {
    const conserje = employees.find(e => e.name.toLowerCase() === config.rotacionCoberturaConserje.conserje?.toLowerCase());
    if (conserje) {
      const offDaysNames = config.rotacionCoberturaConserje.diasLibresConserje || ["Lunes", "Martes"];
      const conciergeOffDays = offDaysNames.map((d: string) => Object.values(DayOfWeek).find(v => v.startsWith(d)));
      
      DAYS_ARRAY.forEach(day => {
        if (conciergeOffDays.includes(day)) {
          assignments[conserje.id][day!] = ShiftCode.Off;
          offDaysCount[conserje.id]++;
        } else {
          assignments[conserje.id][day] = ShiftCode.Night;
          workDaysCount[conserje.id]++;
        }
      });

      // Fixed Substitute for this week (with fallback if primary is sick/vacation)
      const coverageParticipants = config.rotacionCoberturaConserje.empleadosCobertura || [];
      if (coverageParticipants.length > 0) {
        // Use a random starting offset if shuffling, otherwise fixed by weekNumber
        const startOffset = shuffle ? Math.floor(Math.random() * coverageParticipants.length) : weekNumber;
        
        conciergeOffDays.forEach(day => {
          if (!day) return;
          
          let subAssigned = false;
          // Try to find an available substitute starting from the designated one
          for (let i = 0; i < coverageParticipants.length; i++) {
            const subIdx = (startOffset + i) % coverageParticipants.length;
            const subName = coverageParticipants[subIdx];
            const substitute = employees.find(e => e.name.toLowerCase() === subName?.toLowerCase());
            
            if (substitute) {
              const current = assignments[substitute.id][day];
              if (current !== ShiftCode.Sick && current !== ShiftCode.Vacation && !current) {
                assignments[substitute.id][day] = ShiftCode.Night;
                workDaysCount[substitute.id]++;
                subAssigned = true;
                break;
              }
            }
          }
        });
      }
    }
  }

  // 3d. Weekend Off Rotation
  if (config?.rotacionFindeLibre?.activo) {
    const participants = config.rotacionFindeLibre.empleadosParticipantes || [];
    if (participants.length > 0) {
      // Use random if shuffle, else deterministic
      const rotIdx = shuffle ? Math.floor(Math.random() * participants.length) : (weekNumber % participants.length);
      const rotatingName = participants[rotIdx];
      const rotatingEmp = employees.find(e => e.name.toLowerCase() === rotatingName?.toLowerCase());
      if (rotatingEmp && offDaysCount[rotatingEmp.id] === 0) {
        assignments[rotatingEmp.id][DayOfWeek.Saturday] = ShiftCode.Off;
        assignments[rotatingEmp.id][DayOfWeek.Sunday] = ShiftCode.Off;
        offDaysCount[rotatingEmp.id] = 2;
      }
    }
  }

  // 3e. Complex Individual Rules (Global + Per-Employee)
  const allComplexRules: any[] = [...(config?.reglasComplejas || [])];
  
  // Also collect from employees
  employees.forEach(emp => {
    if (emp.specialRules && emp.specialRules.length > 0) {
      emp.specialRules.forEach(rule => {
        allComplexRules.push({ ...rule, empleado: emp.name });
      });
    }
  });

  if (allComplexRules.length > 0) {
    allComplexRules.forEach((rule: any) => {
      const emp = employees.find(e => e.name.toLowerCase() === rule.empleado?.toLowerCase());
      if (!emp) return;

      DAYS_ARRAY.forEach(day => {
        const matchDay = !rule.dia || rule.dia === day || rule.dia === 'Todos' ||
                        (rule.dia === 'Fin de semana' && [DayOfWeek.Saturday, DayOfWeek.Sunday].includes(day)) ||
                        (rule.dia === 'Lunes a Viernes' && ![DayOfWeek.Saturday, DayOfWeek.Sunday].includes(day)) ||
                        (rule.dia === 'Lunes a Sábado' && day !== DayOfWeek.Sunday);
        
        if (matchDay) {
          // DO NOT Overwrite if the employee is ON LEAVE (Sick/Vacation)
          const current = assignments[emp.id][day];
          if (current === ShiftCode.Sick || current === ShiftCode.Vacation) return;

          if (rule.accion === 'SOLO') {
            assignments[emp.id][day] = rule.turno;
            workDaysCount[emp.id]++;
          } else if (rule.accion === 'NUNCA') {
            assignments[emp.id][day] = ShiftCode.Off;
            offDaysCount[emp.id]++;
          } else if (rule.accion === 'RESTRINGIR_HORAS') {
            // Apply hours if specified
            let label = rule.turno;
            if (rule.startTime && rule.endTime) {
              const start = rule.startTime.split(':')[0];
              const end = rule.endTime.split(':')[0];
              label = `${rule.turno}: ${start} a ${end}`;
            } else if (rule.startTime) {
              const start = rule.startTime.split(':')[0];
              label = `${rule.turno}: desde ${start}`;
            }
            assignments[emp.id][day] = label;
            workDaysCount[emp.id]++;
          }
        }
      });
    });
  }

  // 4. PRE-ASSIGN CONSECUTIVE LIBRES for everyone else
  const staggeredOffBlocks = [
    [DayOfWeek.Monday, DayOfWeek.Tuesday],
    [DayOfWeek.Tuesday, DayOfWeek.Wednesday],
    [DayOfWeek.Wednesday, DayOfWeek.Thursday],
    [DayOfWeek.Thursday, DayOfWeek.Friday],
    [DayOfWeek.Friday, DayOfWeek.Saturday],
    [DayOfWeek.Saturday, DayOfWeek.Sunday]
  ];

  let blockIdx = weekNumber % staggeredOffBlocks.length;
  
  const employeesToProcess = [...employees];
  if (shuffle) {
    // Shuffle blocks
    staggeredOffBlocks.sort(() => Math.random() - 0.5);
    // Shuffle employees (except fixed ones like Conserje)
    employeesToProcess.sort(() => Math.random() - 0.5);
  }

  employeesToProcess.forEach(emp => {
    if (emp.role !== Role.Conserje && offDaysCount[emp.id] === 0) {
      // Find a safe block (not already working)
      let found = false;
      for (let i = 0; i < staggeredOffBlocks.length; i++) {
        const potentialIdx = (blockIdx + i) % staggeredOffBlocks.length;
        const block = staggeredOffBlocks[potentialIdx];
        if (block.every(day => !assignments[emp.id][day])) {
          block.forEach(day => assignments[emp.id][day] = ShiftCode.Off);
          offDaysCount[emp.id] = 2;
          blockIdx = (potentialIdx + 1) % staggeredOffBlocks.length;
          found = true;
          break;
        }
      }
      // If no consecutive block found, fallback to any 2 days (unlikely)
      if (!found) {
        DAYS_ARRAY.forEach(day => {
          if (offDaysCount[emp.id] < 2 && !assignments[emp.id][day]) {
            assignments[emp.id][day] = ShiftCode.Off;
            offDaysCount[emp.id]++;
          }
        });
      }
    }
  });

  // 5. FILL SHIFTS (M/T)
  DAYS_ARRAY.forEach((day, dayIdx) => {
    const isWeekend = [DayOfWeek.Friday, DayOfWeek.Saturday, DayOfWeek.Sunday].includes(day);
    const capacity = config?.capacidad?.[isWeekend ? "Viernes-Domingo" : "Lunes-Jueves"] || { manana: 3, tarde: 2 };
    const minM = capacity.manana || (isWeekend ? 4 : 3);
    const minT = capacity.tarde || 2;
    const daysLeft = 7 - dayIdx;

    const available = employees.filter(e => !assignments[e.id][day] && e.role !== Role.Conserje);
    
    // Sorting: First by preference for the current day/shift balance, then by work days.
    // However, available is common for both M and T. We will filter/sort inside the loops.
    
    let assignedT = 0;
    let assignedM = 0;

    const getPreference = (e: Employee, day: DayOfWeek) => {
      const globalP = config?.preferenciasEmpleados?.find((p: any) => p.nombre.toLowerCase() === e.name.toLowerCase() && (!p.diasAfectados || p.diasAfectados.includes(day)));
      const specialP = e.specialRules?.find(r => {
        const matchDay = !r.dia || r.dia === day || r.dia === 'Todos' ||
                        (r.dia === 'Fin de semana' && [DayOfWeek.Saturday, DayOfWeek.Sunday].includes(day)) ||
                        (r.dia === 'Lunes a Viernes' && ![DayOfWeek.Saturday, DayOfWeek.Sunday].includes(day)) ||
                        (r.dia === 'Lunes a Sábado' && day !== DayOfWeek.Sunday);
        return matchDay && r.accion === 'PREFERENCIA';
      });
      return specialP?.turno || globalP?.turnoPreferido;
    };

    // Sort to prioritize those who PREFER Tarde, or just have fewer work days
    const sortedForT = [...available].sort((a, b) => {
      const prefA = getPreference(a, day) === ShiftCode.Afternoon ? 0 : 1;
      const prefB = getPreference(b, day) === ShiftCode.Afternoon ? 0 : 1;
      if (prefA !== prefB) return prefA - prefB;
      return workDaysCount[a.id] - workDaysCount[b.id];
    });

    // Assign Tarde (T)
    sortedForT.forEach(e => {
      if (assignedT < minT) {
        // Skip if they strictly prefer Morning (M)
        if (getPreference(e, day) === ShiftCode.Morning) return;

        // Restriction: noTwoHelpers
        const isHelper = e.role === Role.Ayudante;
        const noTwoHelpers = config?.restriccionesTurnos?.noDosAyudantesJuntosTarde ?? true;
        const helpersInT = employees.filter(emp => assignments[emp.id][day] === ShiftCode.Afternoon && emp.role === Role.Ayudante).length;
        
        if (!isHelper || !noTwoHelpers || helpersInT < 1) {
          assignments[e.id][day] = ShiftCode.Afternoon;
          workDaysCount[e.id]++;
          assignedT++;
        }
      }
    });

    // Assign Mañana (M)
    const remaining = available.filter(e => !assignments[e.id][day]);
    // Sort to prioritize those who PREFER Mañana, or just have fewer work days
    const sortedForM = [...remaining].sort((a, b) => {
      const prefA = getPreference(a, day) === ShiftCode.Morning ? 0 : 1;
      const prefB = getPreference(b, day) === ShiftCode.Morning ? 0 : 1;
      if (prefA !== prefB) return prefA - prefB;
      return workDaysCount[a.id] - workDaysCount[b.id];
    });

    sortedForM.forEach(e => {
      if (assignedM < minM || workDaysCount[e.id] < targetWorkDays) {
        assignments[e.id][day] = ShiftCode.Morning;
        workDaysCount[e.id]++;
        assignedM++;
      }
    });
  });

  // Finally, ensure everyone doesn't exceed 5 work days unless necessary for coverage
  // and handle anyone still empty
  employees.forEach(e => {
    DAYS_ARRAY.forEach(day => {
      if (!assignments[e.id][day]) {
        assignments[e.id][day] = ShiftCode.Off;
      }
    });
  });

  const schedule: Schedule = { weekNumber, year, assignments, generatedAt: new Date().toISOString() };
  await setDoc(doc(db, 'schedules', `${year}-W${weekNumber}`), schedule);
  return schedule;
}
