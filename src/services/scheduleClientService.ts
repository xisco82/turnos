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
export async function generateScheduleClient(weekNumber: number, year: number, shuffle: boolean = false, iterationOffset: number = 0): Promise<Schedule> {
  // 1. Fetch Data
  const employeesSnapshot = await getDocs(collection(db, 'employees'));
  const requestsSnapshot = await getDocs(collection(db, 'requests'));
  const configSnap = await getDoc(doc(db, 'configuracion', 'reglasTurnos'));
  const config = configSnap.exists() ? configSnap.data() : null;
  
  const employees = employeesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
  const requests = requestsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleRequest));

  // PRIORITY LISTS FROM CONFIG
  const NOCHES_LIST: string[] = config?.listasPrioridad?.noches || [];
  const FINDES_LIST: string[] = config?.listasPrioridad?.findes || [];

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

  // 3c. Weekly Base Pattern (From Employee profile)
  employees.forEach(emp => {
    if (emp.weeklyBasePattern) {
      DAYS_ARRAY.forEach(day => {
        const patternShift = emp.weeklyBasePattern?.[day];
        // Only apply if NO shift is assigned yet (i.e., NOT on vacation/sick)
        if (patternShift && patternShift !== 'NONE' && !assignments[emp.id][day]) {
          assignments[emp.id][day] = patternShift;
          if (patternShift === ShiftCode.Off) {
            offDaysCount[emp.id]++;
          } else {
            workDaysCount[emp.id]++;
          }
        }
      });
    }
  });

  // 3d. Concierge and Substitution
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

      // Priority list from config
      const coverageParticipants = NOCHES_LIST;
      if (coverageParticipants.length > 0) {
        // Base index is deterministic by week + the shuffle iteration
        const baseOffset = weekNumber + iterationOffset;
        
        // 1. For each concierge off day, find a substitute
        conciergeOffDays.forEach((day, dayIdx) => {
          if (!day) return;
          let selectedSub: Employee | null = null;

          for (let i = 0; i < coverageParticipants.length; i++) {
            const subName = coverageParticipants[(baseOffset + i + dayIdx) % coverageParticipants.length];
            const candidate = employees.find(e => e.name.toUpperCase().includes(subName.toUpperCase()));
            
            if (candidate) {
              const current = assignments[candidate.id][day];
              const isAvailable = current !== ShiftCode.Sick && current !== ShiftCode.Vacation && !current;
              
              if (isAvailable) {
                selectedSub = candidate;
                break;
              }
            }
          }

          if (selectedSub) {
            assignments[selectedSub.id][day] = ShiftCode.Night;
            workDaysCount[selectedSub.id]++;

            // Handle post-night behaviour for this specific day
            const nextDayIdx = DAYS_ARRAY.indexOf(day) + 1;
            if (nextDayIdx < DAYS_ARRAY.length) {
              const nextDay = DAYS_ARRAY[nextDayIdx];
              if (selectedSub.postNightBehaviour === 'Afternoon') {
                // Only assign if slot is empty and not violating sick/vacation
                if (!assignments[selectedSub.id][nextDay]) {
                  assignments[selectedSub.id][nextDay] = ShiftCode.Afternoon;
                  workDaysCount[selectedSub.id]++;
                }
              } else {
                // Force TWO days off as per user request (if possible)
                assignments[selectedSub.id][nextDay] = ShiftCode.Off;
                offDaysCount[selectedSub.id]++;

                const dayAfterNextIdx = nextDayIdx + 1;
                if (dayAfterNextIdx < DAYS_ARRAY.length) {
                  const dayAfterNext = DAYS_ARRAY[dayAfterNextIdx];
                  if (!assignments[selectedSub.id][dayAfterNext]) {
                    assignments[selectedSub.id][dayAfterNext] = ShiftCode.Off;
                    offDaysCount[selectedSub.id]++;
                  }
                }
              }
            }
          }
        });
      }
    }
  }

  // 3d. Weekend Off Rotation
  if (config?.rotacionFindeLibre?.activo) {
    // Priority list from config
    const participants = FINDES_LIST;
    if (participants.length > 0) {
      const baseIdx = (weekNumber + iterationOffset);
      
      // Try to find the first available person in the list who isn't already off or working something critical
      for (let i = 0; i < participants.length; i++) {
        const rotIdx = (baseIdx + i) % participants.length;
        const rotatingName = participants[rotIdx];
        const rotatingEmp = employees.find(e => e.name.toUpperCase().includes(rotatingName.toUpperCase()));
        
        if (rotatingEmp && offDaysCount[rotatingEmp.id] === 0) {
          // Check if they are on leave for Sat/Sun
          const satStatus = assignments[rotatingEmp.id][DayOfWeek.Saturday];
          const sunStatus = assignments[rotatingEmp.id][DayOfWeek.Sunday];
          
          if (!satStatus && !sunStatus) {
            assignments[rotatingEmp.id][DayOfWeek.Saturday] = ShiftCode.Off;
            assignments[rotatingEmp.id][DayOfWeek.Sunday] = ShiftCode.Off;
            offDaysCount[rotatingEmp.id] = 2;
            break; // Found our person for the weekend
          }
        }
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
              label = `${rule.turno}: ${rule.startTime} a ${rule.endTime}`;
            } else if (rule.startTime) {
              label = `${rule.turno}: desde ${rule.startTime}`;
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
    
    // Calculate initial assignments from rules/patterns (TOTAL COUNT)
    let assignedT = employees.filter(e => {
      const code = assignments[e.id][day];
      return typeof code === 'string' && code.startsWith('T');
    }).length;

    let assignedM = employees.filter(e => {
      const code = assignments[e.id][day];
      return typeof code === 'string' && code.startsWith('M');
    }).length;

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
    const isStrict = config?.strictCapacityControl ?? true;

    sortedForT.forEach(e => {
      // PROHIBIDO: Strict limit check (includes everyone)
      if (!isStrict || assignedT < minT) {
        // If they need the day (to stay at 2 days off), we override preference
        const needsWork = (offDaysCount[e.id] >= targetOffDays);
        
        // Skip if they strictly prefer Morning (M) AND they don't desperately need the day
        if (getPreference(e, day) === ShiftCode.Morning && !needsWork) return;

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
    // Sort to prioritize those who need the work most (to stay at 2 days off)
    const sortedForM = [...remaining].sort((a, b) => {
      // Priority 1: Those who reached or exceeded target off days (2)
      const needsA = offDaysCount[a.id] >= targetOffDays ? 0 : 1;
      const needsB = offDaysCount[b.id] >= targetOffDays ? 0 : 1;
      if (needsA !== needsB) return needsA - needsB;
      
      // Priority 2: Preference
      const prefA = getPreference(a, day) === ShiftCode.Morning ? 0 : 1;
      const prefB = getPreference(b, day) === ShiftCode.Morning ? 0 : 1;
      if (prefA !== prefB) return prefA - prefB;
      
      return workDaysCount[a.id] - workDaysCount[b.id];
    });

    sortedForM.forEach(e => {
      // If we are in strict mode, we try to stay within minM
      // BUT if we MUST assign them to keep them at 2 days off, we might push slightly
      // unless user said PROHIBIDO for morning too. (User only said PROHIBIDO for Tarde).
      if (assignedM < minM || (offDaysCount[e.id] >= targetOffDays && assignedM < 5)) {
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
