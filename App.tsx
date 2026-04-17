
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Employee, Shift, DayOfWeek, ScheduleRequest } from './types';
import { 
    INITIAL_EMPLOYEES, 
    DAYS_OF_WEEK, 
    ShiftConst 
} from './constants';
import EmployeeManager from './components/EmployeeManager';
import RequestsManager from './components/RequestsManager';
import ScheduleCalendar from './ScheduleCalendar';
import * as XLSX from 'xlsx';

// Helper to get the start of the week (Monday)
const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  d.setHours(0, 0, 0, 0);
  return new Date(d.setDate(diff));
};

// Helper to get ISO week number
const getWeekNumber = (d: Date): number => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
  return weekNo;
};


export default function App() {
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [generationTrigger, setGenerationTrigger] = useState(0);
  const [weeklyOverrides, setWeeklyOverrides] = useState<Record<string, Partial<Record<DayOfWeek, Shift>>>>({});
  const [requests, setRequests] = useState<ScheduleRequest[]>([]);

  const startOfWeek = useMemo(() => getStartOfWeek(currentDate), [currentDate]);
  
  const handleForceGenerate = useCallback(() => {
    setGenerationTrigger(v => v + 1);
  }, []);

  const handleAddEmployee = (employee: Omit<Employee, 'id'>) => {
    setEmployees([...employees, { ...employee, id: new Date().toISOString() }]);
    handleForceGenerate();
  };

  const handleUpdateEmployee = (updatedEmployee: Employee) => {
    setEmployees(employees.map(e => e.id === updatedEmployee.id ? updatedEmployee : e));
    handleForceGenerate();
  };

  const handleDeleteEmployee = (employeeId: string) => {
    setEmployees(employees.filter(e => e.id !== employeeId));
    setWeeklyOverrides(prev => {
        const newOverrides = {...prev};
        delete newOverrides[employeeId];
        return newOverrides;
    });
    setRequests(requests.filter(r => r.employeeId !== employeeId));
  };

  const handleAddRequest = (request: Omit<ScheduleRequest, 'id'>) => {
    setRequests([...requests, { ...request, id: new Date().toISOString() }]);
    handleForceGenerate();
  };

  const handleDeleteRequest = (id: string) => {
    setRequests(requests.filter(r => r.id !== id));
    handleForceGenerate();
  };

  const handleSetVacationWeek = useCallback((employeeId: string) => {
    setWeeklyOverrides(prev => {
        const newOverrides = { ...prev };
        const currentOverride = newOverrides[employeeId];
        
        const isAlreadyOnVacation = currentOverride && DAYS_OF_WEEK.every(day => currentOverride[day] === ShiftConst.Vacation);

        if (isAlreadyOnVacation) {
            delete newOverrides[employeeId];
        } else {
            const vacationWeek: Partial<Record<DayOfWeek, Shift>> = {};
            DAYS_OF_WEEK.forEach(day => {
                vacationWeek[day] = ShiftConst.Vacation;
            });
            newOverrides[employeeId] = vacationWeek;
        }
        
        return newOverrides;
    });
    handleForceGenerate();
  }, [handleForceGenerate]);

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        const header = ["Empleado", ...DAYS_OF_WEEK, "Total L"];

        const data = scheduleData.map(row => {
            const shiftsRow: { [key: string]: Shift } = {};
            row.shifts.forEach(s => {
                shiftsRow[s.day] = s.shift;
            });
            const totalL = row.shifts.filter(s => s.shift === ShiftConst.Off).length;
            return [row.employeeName, ...DAYS_OF_WEEK.map(day => shiftsRow[day]), totalL];
        });
        
        const dailyTotalsM = ['Total Mañana (M)', ...DAYS_OF_WEEK.map(day => scheduleData.reduce((acc, row) => acc + (row.shifts.find(s => s.day === day)?.shift === ShiftConst.Morning ? 1 : 0), 0))];
        const dailyTotalsT = ['Total Tarde (T)', ...DAYS_OF_WEEK.map(day => scheduleData.reduce((acc, row) => acc + (row.shifts.find(s => s.day === day)?.shift === ShiftConst.Afternoon ? 1 : 0), 0))];

        const grandTotalL = scheduleData.reduce((total, row) => total + row.shifts.filter(s => s.shift === ShiftConst.Off).length, 0);
        const totalLRow = Array(8).fill('');
        totalLRow[0] = 'Total Libres (L) de la Semana';
        totalLRow[8] = grandTotalL;


        const wsData = [header, ...data, [], dailyTotalsM, dailyTotalsT, [], totalLRow];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        // Add styles
        const borderStyle = { style: 'thin', color: { rgb: "000000" } };
        const borders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
        
        const yellowFill = { fgColor: { rgb: "FFFF00" } };
        const grayFill = { fgColor: { rgb: "CCCCCC" } };
        
        const range = XLSX.utils.decode_range(ws['!ref']!);

        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = { c: C, r: R };
                const cell_ref = XLSX.utils.encode_cell(cell_address);
                if (!ws[cell_ref]) continue;

                if (!ws[cell_ref].s) ws[cell_ref].s = {};
                
                ws[cell_ref].s.border = borders;

                const cellValue = ws[cell_ref].v;
                if (cellValue === ShiftConst.Off) {
                    ws[cell_ref].s.fill = yellowFill;
                } else if (cellValue === ShiftConst.Night) {
                    ws[cell_ref].s.fill = grayFill;
                }
            }
        }
        
        // Auto-fit columns
        const colWidths = header.map((_, i) => ({
            wch: wsData.reduce((w, r) => Math.max(w, String(r[i] || '').length), 10)
        }));
        ws['!cols'] = colWidths;
        
        XLSX.utils.book_append_sheet(wb, ws, "Horario");
        XLSX.writeFile(wb, `HorarioSemanal-${startOfWeek.toISOString().split('T')[0]}.xlsx`);
    };

  const changeWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(startOfWeek);
    newDate.setDate(newDate.getDate() + (direction === 'prev' ? -7 : 7));
    setCurrentDate(newDate);
    setWeeklyOverrides({}); // Clear overrides for the new week
  };

  const scheduleData = useMemo(() => {
    const weekNumber = getWeekNumber(startOfWeek);
    const isToniWeekForFriSatOff = (weekNumber % 2 === 0);

    // Get end of week for request filtering
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const getShiftForDate = (empId: string, day: DayOfWeek): Shift | null => {
        // Find day index
        const dayIdx = DAYS_OF_WEEK.indexOf(day);
        const targetDate = new Date(startOfWeek);
        targetDate.setDate(targetDate.getDate() + dayIdx);
        targetDate.setHours(12, 0, 0, 0);

        const activeRequest = requests.find(r => {
            if (r.employeeId !== empId) return false;
            const start = new Date(r.startDate);
            const end = new Date(r.endDate);
            start.setHours(0,0,0,0);
            end.setHours(23,59,59,999);
            return targetDate >= start && targetDate <= end;
        });

        if (activeRequest) {
            return activeRequest.type === 'Vacaciones' ? ShiftConst.Vacation : ShiftConst.Off;
        }

        const override = weeklyOverrides[empId]?.[day];
        if (override) return override;

        return null;
    };

    // --- STEP 0: DETERMINE AVAILABLE & VACATIONING EMPLOYEES ---
    // (Vacation now prioritized via getShiftForDate, but we still need a set for legacy logic if any)
    const vacationingEmployeeIds = new Set<string>();
    employees.forEach(emp => {
        const isOnVacationWholeWeek = DAYS_OF_WEEK.every(day => getShiftForDate(emp.id, day) === ShiftConst.Vacation);
        if (isOnVacationWholeWeek) {
            vacationingEmployeeIds.add(emp.id);
        }
    });
    
    const availableEmployees = employees.filter(emp => !vacationingEmployeeIds.has(emp.id));

    // --- INITIALIZATION ---
    const schedule = new Map<string, Map<DayOfWeek, Shift>>();
    employees.forEach(e => schedule.set(e.id, new Map<DayOfWeek, Shift>()));

    employees.forEach(emp => {
      const empSchedule = schedule.get(emp.id)!;
      DAYS_OF_WEEK.forEach(day => {
          const forcedShift = getShiftForDate(emp.id, day);
          if (forcedShift === ShiftConst.Vacation || (forcedShift === ShiftConst.Off && requests.some(r => r.employeeId === emp.id && r.type === 'Libre'))) {
              empSchedule.set(day, forcedShift);
          }
      });
    });
    
    // --- STEP 1: DETERMINE ROTATIONS (WEEKEND & NIGHT) ---
    let nightShiftEmployeeId: string | null = null;
    const nightShiftRotationGroup = employees.filter(e => e.isNightRotationMember && !vacationingEmployeeIds.has(e.id)).map(e => e.id);
    if (nightShiftRotationGroup.length > 0) {
        const nightStartIndex = weekNumber % nightShiftRotationGroup.length;
        nightShiftEmployeeId = nightShiftRotationGroup[nightStartIndex];
    }
    
    let weekendOffEmployeeId: string | null = null;
    const weekendRotationGroup = employees.filter(e => e.isWeekendRotationMember && !vacationingEmployeeIds.has(e.id)).map(e => e.id);
    if (weekendRotationGroup.length > 0) {
        // Handle rotation if active (currently disabled in UI but logic skeleton remains)
        const weekendStartIndex = weekNumber % weekendRotationGroup.length;
        weekendOffEmployeeId = weekendRotationGroup[weekendStartIndex];
    }

    // --- STEP 2: ASSIGN GUARANTEED CONSECUTIVE OFF DAYS ---
    availableEmployees.forEach(emp => {
        const employeeSchedule = schedule.get(emp.id)!;
        let offDays: [DayOfWeek, DayOfWeek] | null = null;
        const toniId = '6'; // Keep Toni special rule if not overridden by flags

        if (emp.fixedWeekendOff) {
            offDays = [DayOfWeek.Saturday, DayOfWeek.Sunday];
        } else if (emp.id === toniId && isToniWeekForFriSatOff) {
             // Specific existing Toni rule (Legacy)
            offDays = [DayOfWeek.Friday, DayOfWeek.Saturday];
        } else if (emp.id === weekendOffEmployeeId) {
            offDays = [DayOfWeek.Saturday, DayOfWeek.Sunday];
        } else if (emp.id === nightShiftEmployeeId && emp.postNightBehaviour === 'Off') {
            offDays = [DayOfWeek.Wednesday, DayOfWeek.Thursday];
        } else {
            // Check for rules first
            for (let i = 0; i < DAYS_OF_WEEK.length - 1; i++) {
                if (emp.rules[DAYS_OF_WEEK[i]] === ShiftConst.Off && emp.rules[DAYS_OF_WEEK[i + 1]] === ShiftConst.Off) {
                    offDays = [DAYS_OF_WEEK[i], DAYS_OF_WEEK[i + 1]];
                    break;
                }
            }
            if (!offDays && emp.rules[DayOfWeek.Sunday] === ShiftConst.Off && emp.rules[DayOfWeek.Monday] === ShiftConst.Off) {
                offDays = [DayOfWeek.Sunday, DayOfWeek.Monday];
            }
        }
        
        // Ensure everyone has at least 2 off days together
        if (!offDays) {
            const failsafePairs: [DayOfWeek, DayOfWeek][] = [[DayOfWeek.Monday, DayOfWeek.Tuesday], [DayOfWeek.Tuesday, DayOfWeek.Wednesday], [DayOfWeek.Wednesday, DayOfWeek.Thursday]];
            const empIndex = availableEmployees.findIndex(e => e.id === emp.id);
            offDays = failsafePairs[empIndex % failsafePairs.length];
        }
        
        if (offDays) {
            employeeSchedule.set(offDays[0], ShiftConst.Off);
            employeeSchedule.set(offDays[1], ShiftConst.Off);
        }
    });

    const guaranteedOffSlots = new Map<string, Set<DayOfWeek>>();
    availableEmployees.forEach(emp => {
        const offDays = new Set<DayOfWeek>();
        const empSchedule = schedule.get(emp.id)!;
        for (const [day, shift] of empSchedule.entries()) {
            if (shift === ShiftConst.Off) {
                offDays.add(day);
            }
        }
        guaranteedOffSlots.set(emp.id, offDays);
    });

    // --- STEP 3: APPLY EMPLOYEE RULES & PRIORITY SHIFTS ---
    availableEmployees.forEach(emp => {
        const employeeSchedule = schedule.get(emp.id)!;
        DAYS_OF_WEEK.forEach(day => {
            if (!employeeSchedule.has(day)) {
                const ruleShift = emp.rules[day];
                if (ruleShift !== ShiftConst.Off) {
                    employeeSchedule.set(day, ruleShift);
                }
            }
        });
    });
    
    // Ines and Catalina Morning/Afternoon resolution
    const inesId = '8', catalinaId = '9';
    DAYS_OF_WEEK.forEach(day => {
        const inesSchedule = schedule.get(inesId), catalinaSchedule = schedule.get(catalinaId);
        if (inesSchedule?.get(day) === ShiftConst.Afternoon && catalinaSchedule?.get(day) === ShiftConst.Afternoon) {
            catalinaSchedule.set(day, ShiftConst.Morning);
        }
    });

    if (nightShiftEmployeeId) {
        const emp = availableEmployees.find(e => e.id === nightShiftEmployeeId);
        const nightShiftEmployeeSchedule = schedule.get(nightShiftEmployeeId)!;
        nightShiftEmployeeSchedule.set(DayOfWeek.Monday, ShiftConst.Night);
        nightShiftEmployeeSchedule.set(DayOfWeek.Tuesday, ShiftConst.Night);
        
        if (emp?.postNightBehaviour === 'Afternoon') {
            nightShiftEmployeeSchedule.set(DayOfWeek.Wednesday, ShiftConst.Afternoon);
            nightShiftEmployeeSchedule.set(DayOfWeek.Thursday, ShiftConst.Afternoon);
            // If they are working afternoon, they need their 2 off days later or elsewhere
            // but the user requirement said "after night shift they have afternoon".
            // We should ensure they still get off days if not assigned.
        }
    }

    // --- STEP 4: ENSURE MINIMUM STAFFING ON ALL DAYS ---
    DAYS_OF_WEEK.forEach(day => {
        const isWeekend = day === DayOfWeek.Saturday || day === DayOfWeek.Sunday;
        const isFriday = day === DayOfWeek.Friday;
        const minMorning = (isFriday || isWeekend) ? 4 : 3;
        const minAfternoon = 2;

        const getShiftCount = (shift: Shift) => Array.from(schedule.values()).filter(s => s.get(day) === shift).length;
        
        const getWeeklyOffDaysCount = (empId: string): number => {
            const empSchedule = schedule.get(empId);
            if (!empSchedule) return 0;
            return Array.from(empSchedule.values()).filter(s => s === ShiftConst.Off).length;
        };
        
        const getWeeklyShiftTypeCount = (empId: string, shiftType: Shift): number => {
            const empSchedule = schedule.get(empId);
            if (!empSchedule) return 0;
            return Array.from(empSchedule.values()).filter(s => s === shiftType).length;
        };

        const fillShift = (shiftToFill: Shift) => {
            const potentialCandidates = availableEmployees.filter(emp => {
                const empSchedule = schedule.get(emp.id)!;
                const currentShift = empSchedule.get(day);
                const isGuaranteedOff = guaranteedOffSlots.get(emp.id)?.has(day);

                if (isGuaranteedOff) return false;
                if (currentShift === shiftToFill) return false;

                const isWorkingAnotherShift = currentShift === ShiftConst.Morning || currentShift === ShiftConst.Afternoon || currentShift === ShiftConst.Night;
                if (isWorkingAnotherShift) return false;
                
                return true;
            });

            potentialCandidates.sort((a, b) => {
                 const shiftA = schedule.get(a.id)!.get(day);
                 const shiftB = schedule.get(b.id)!.get(day);
                if (shiftA === undefined && shiftB !== undefined) return -1;
                if (shiftB === undefined && shiftA !== undefined) return 1;
                if (shiftA === ShiftConst.Off && shiftB !== ShiftConst.Off) return -1;
                if (shiftB === ShiftConst.Off && shiftA !== ShiftConst.Off) return 1;
                
                if (shiftToFill === ShiftConst.Morning) {
                    const morningCountA = getWeeklyShiftTypeCount(a.id, ShiftConst.Morning);
                    const morningCountB = getWeeklyShiftTypeCount(b.id, ShiftConst.Morning);
                    if (morningCountA !== morningCountB) return morningCountA - morningCountB;
                }
                if (shiftToFill === ShiftConst.Afternoon) {
                    const afternoonCountA = getWeeklyShiftTypeCount(a.id, ShiftConst.Afternoon);
                    const afternoonCountB = getWeeklyShiftTypeCount(b.id, ShiftConst.Afternoon);
                    if (afternoonCountA !== afternoonCountB) return afternoonCountA - afternoonCountB;
                }

                return getWeeklyOffDaysCount(b.id) - getWeeklyOffDaysCount(a.id);
            });
            
            if (potentialCandidates.length > 0) {
                schedule.get(potentialCandidates[0].id)?.set(day, shiftToFill);
                return true;
            }
            return false;
        };

        let morningCount = getShiftCount(ShiftConst.Morning);
        while (morningCount < minMorning) {
            if (!fillShift(ShiftConst.Morning)) break;
            morningCount = getShiftCount(ShiftConst.Morning);
        }

        let afternoonCount = getShiftCount(ShiftConst.Afternoon);
        while (afternoonCount < minAfternoon) {
            if (!fillShift(ShiftConst.Afternoon)) break;
            afternoonCount = getShiftCount(ShiftConst.Afternoon);
        }
    });

    // --- STEP 5: FILL REMAINING EMPTY SLOTS ---
    availableEmployees.forEach(emp => {
        const employeeSchedule = schedule.get(emp.id)!;
        DAYS_OF_WEEK.forEach(day => {
            if (!employeeSchedule.has(day)) {
                employeeSchedule.set(day, ShiftConst.Morning);
            }
        });
    });
    
    // --- FINAL TRANSFORMATION FOR UI ---
    return employees.map(employee => ({
      employeeId: employee.id,
      employeeName: employee.name,
      role: employee.role,
      shifts: DAYS_OF_WEEK.map(day => ({
        day: day,
        shift: schedule.get(employee.id)?.get(day) || '',
      })),
    }));
  }, [employees, startOfWeek, generationTrigger, weeklyOverrides]);

  // Alert when afternoon shifts exceed 2 people
  React.useEffect(() => {
    const dailyTotals = DAYS_OF_WEEK.reduce((acc, day) => ({ ...acc, [day]: 0 }), {} as Record<DayOfWeek, number>);
    
    scheduleData.forEach(row => {
      row.shifts.forEach(s => {
        if (s.shift === ShiftConst.Afternoon) {
          dailyTotals[s.day] += 1;
        }
      });
    });

    const overloadedDays = DAYS_OF_WEEK.filter(day => dailyTotals[day] > 2);
    if (overloadedDays.length > 0) {
      window.alert(`¡ALARMA! Hay más de 2 personas asignadas por la tarde los días: ${overloadedDays.join(', ')}`);
    }
  }, [scheduleData]);

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-screen-2xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-lg h-fit">
            <EmployeeManager 
                employees={employees}
                onAdd={handleAddEmployee}
                onUpdate={handleUpdateEmployee}
                onDelete={handleDeleteEmployee}
                onSetVacationWeek={handleSetVacationWeek}
                isFormOpen={isFormOpen}
                setIsFormOpen={setIsFormOpen}
            />
            <RequestsManager 
                employees={employees}
                requests={requests}
                onAdd={handleAddRequest}
                onDelete={handleDeleteRequest}
            />
        </div>
        <div className="lg:col-span-3 bg-white p-6 rounded-2xl shadow-lg">
             <ScheduleCalendar 
                startOfWeek={startOfWeek} 
                scheduleData={scheduleData}
                onChangeWeek={changeWeek}
                onExportExcel={handleExportExcel}
                onForceGenerate={handleForceGenerate}
            />
        </div>
      </div>
       <footer className="text-center mt-8 text-sm text-gray-500">
          <p>Hecho por Xisco</p>
      </footer>
    </div>
  );
}
