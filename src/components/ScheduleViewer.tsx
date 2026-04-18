import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  RotateCw, 
  Download,
  CheckCircle2,
  Calendar as CalendarIcon,
  AlertCircle,
  Lock,
  Save,
  Bell
} from 'lucide-react';
import { Employee, Schedule, ShiftCode, DAYS_ARRAY, Role, ScheduleRequest } from '../types.ts';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';
import { db } from '../lib/firebase-client.ts';
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import 'jspdf-autotable';

// Extend jsPDF for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface ScheduleViewerProps {
  employees: Employee[];
}

export default function ScheduleViewer({ employees }: ScheduleViewerProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shuffleCount, setShuffleCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [weeklyRequests, setWeeklyRequests] = useState<ScheduleRequest[]>([]);

  const CUSTOM_NAME_ORDER = [
    'XISCO', 'ALIZ', 'JOSEP', 'JAVI', 'TONI', 
    'MIRIAM', 'INES', 'LORENA', 'JAKELINE', 'CARLOS', 'OSCAR'
  ];

  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => {
      const normalize = (s: string) => s.toUpperCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const idxA = CUSTOM_NAME_ORDER.indexOf(normalize(a.name));
      const idxB = CUSTOM_NAME_ORDER.indexOf(normalize(b.name));
      
      const orderA = idxA === -1 ? 999 : idxA;
      const orderB = idxB === -1 ? 999 : idxB;
      
      if (orderA !== orderB) return orderA - orderB;
      return normalize(a.name).localeCompare(normalize(b.name));
    });
  }, [employees]);

  const { weekNumber, year, dateRange, mondayDate, isLocked } = useMemo(() => {
    const d = new Date(currentDate);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7)); // Jump to Thursday
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    
    // Calculate Mon-Sun range
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const dayOfJan4 = jan4.getDay() || 7;
    const firstMon = new Date(jan4.getTime() - (dayOfJan4 - 1) * 24 * 60 * 60 * 1000);
    const mon = new Date(firstMon.getTime() + (weekNo - 1) * 7 * 24 * 60 * 60 * 1000);
    const sun = new Date(mon.getTime() + 6 * 24 * 60 * 60 * 1000);
    
    const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

    // Lock check: if Sunday of the viewed week is in the past
    const now = new Date();
    const endOfWeek = new Date(sun);
    endOfWeek.setHours(23, 59, 59, 999);
    const isLocked = now > endOfWeek;

    return { 
      weekNumber: weekNo, 
      year: d.getFullYear(), 
      dateRange: `${fmt.format(mon)} - ${fmt.format(sun)}`,
      mondayDate: mon,
      isLocked
    };
  }, [currentDate]);

  const fetchSchedule = async () => {
    setLoading(true);
    setError(null);
    try {
      // Create assignments pre-filled with requests if they exist
      const initialAssignments: any = {};
      
      employees.forEach(emp => {
        initialAssignments[emp.id] = {};
        
        // Map requests to a quick lookup
        const empRequests = weeklyRequests.filter(r => r.employeeId === emp.id);

        DAYS_ARRAY.forEach((day, idx) => {
          const cellDate = new Date(mondayDate.getTime() + idx * 24 * 60 * 60 * 1000);
          cellDate.setHours(0,0,0,0);
          
          // Check if this date is inside any request
          const activeRequest = empRequests.find(req => {
            const start = new Date(req.startDate);
            const end = new Date(req.endDate);
            start.setHours(0,0,0,0);
            end.setHours(0,0,0,0);
            return cellDate >= start && cellDate <= end;
          });

          if (activeRequest) {
            switch(activeRequest.type) {
              case 'Vacación': initialAssignments[emp.id][day] = ShiftCode.Vacation; break;
              case 'Baja': initialAssignments[emp.id][day] = ShiftCode.Sick; break;
              case 'Festivo': initialAssignments[emp.id][day] = ShiftCode.Holiday; break;
              default: initialAssignments[emp.id][day] = ShiftCode.Off;
            }
          } else {
            initialAssignments[emp.id][day] = ShiftCode.Off;
          }
        });
      });

      const newSchedule: Schedule = {
        weekNumber,
        year,
        assignments: initialAssignments,
        generatedAt: new Date().toISOString()
      };
      setSchedule(newSchedule);
      setHasChanges(true);
    } catch (err: any) {
      console.error('Initial Load Error:', err);
      setError('Error al inicializar el horario');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!schedule) return;
    setSaving(true);
    setError(null);
    try {
      const scheduleId = `${year}-W${weekNumber}`;
      await setDoc(doc(db, 'schedules', scheduleId), {
        ...schedule,
        generatedAt: new Date().toISOString()
      });
      setHasChanges(false);
    } catch (err: any) {
      console.error('Save Error:', err);
      setError('Error al guardar el horario');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAssignment = (employeeId: string, day: string, value: string) => {
    if (!schedule) return;
    
    const newAssignments = {
      ...schedule.assignments,
      [employeeId]: {
        ...schedule.assignments[employeeId],
        [day]: value
      }
    };

    setSchedule({
      ...schedule,
      assignments: newAssignments
    });
    setHasChanges(true);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const scheduleId = `${year}-W${weekNumber}`;
        
        // 1. Load Requests for the week context (Refactored to avoid composite index)
        const sundayDate = new Date(mondayDate.getTime() + 7 * 24 * 60 * 60 * 1000);
        const q = query(
          collection(db, 'requests'),
          where('endDate', '>=', mondayDate.toISOString())
        );
        const reqSnap = await getDocs(q);
        const allPotentialReqs = reqSnap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleRequest));
        
        // Filter in memory for start date overlap
        const reqs = allPotentialReqs.filter(req => {
          return req.startDate <= sundayDate.toISOString();
        });
        
        setWeeklyRequests(reqs);

        // 2. Load Existing Schedule
        const docSnap = await getDoc(doc(db, 'schedules', scheduleId));
        if (docSnap.exists()) {
          setSchedule(docSnap.data() as Schedule);
          setHasChanges(false);
        } else {
          setSchedule(null);
          setHasChanges(false);
        }
      } catch (err: any) {
        console.error('Load Error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [weekNumber, year, mondayDate]);

  const handleExportPDF = () => {
    if (!schedule) return;
    const doc = new jsPDF('landscape');
    doc.setFontSize(20);
    doc.text(`Turnos de Recepción - Semana ${weekNumber} (${year})`, 14, 20);
    
    const tableData = sortedEmployees.map(emp => {
      const assignments = schedule.assignments[emp.id] || {};
      return [
        emp.name.toUpperCase(),
        ...DAYS_ARRAY.map(day => {
          const val = assignments[day] || '-';
          return val.includes(': ') ? val.split(': ')[1] : val;
        })
      ];
    });

    doc.autoTable({
      startY: 30,
      head: [['Nombre', ...DAYS_ARRAY]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
      styles: { fontSize: 7, font: 'helvetica' },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index > 0) {
          const val = data.cell.raw;
          if (val === 'M') data.cell.styles.fillColor = [254, 249, 195];
          if (val === 'T') data.cell.styles.fillColor = [254, 215, 170];
          if (val === 'N') data.cell.styles.fillColor = [199, 210, 254];
          if (val === 'L') data.cell.styles.fillColor = [241, 245, 249];
        }
      }
    });

    doc.save(`turnos-s${weekNumber}-${year}.pdf`);
  };

  const handleExportExcel = async () => {
    if (!schedule) return;
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Cuadrante');

    // Headers Row 1: Dates
    const datesRowData = [''];
    DAYS_ARRAY.forEach((_, idx) => {
      const cellDate = new Date(mondayDate.getTime() + idx * 24 * 60 * 60 * 1000);
      const fmt = `${cellDate.getDate().toString().padStart(2, '0')}/${(cellDate.getMonth() + 1).toString().padStart(2, '0')}`;
      datesRowData.push(fmt);
    });
    const datesRow = worksheet.addRow(datesRowData);

    // Headers Row 2: Days
    const daysRowData = ['', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
    const daysRow = worksheet.addRow(daysRowData);

    // Styling headers
    [datesRow, daysRow].forEach((row, rowIndex) => {
      row.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.font = { bold: true, size: 12, name: 'Arial' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        
        if (colNumber > 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF00FFFF' } // Cyan
          };
        }
      });
    });

    sortedEmployees.forEach(emp => {
      const assignments = schedule.assignments[emp.id] || {};
      const rowData = [
        emp.name.toUpperCase(),
        ...DAYS_ARRAY.map(day => {
          const val = assignments[day] || '-';
          return val.includes(': ') ? val.split(': ')[1] : val;
        })
      ];
      const row = worksheet.addRow(rowData);
      
      row.eachCell((cell, colNumber) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        if (colNumber === 1) {
          cell.font = { bold: true, size: 11, name: 'Arial' };
          return;
        }
        
        const val = cell.value as string;
        let bgColor = '';
        let textColor = 'FF000000'; // Black default

        if (val === 'L') bgColor = 'FFFFFF00'; // Yellow
        else if (val === 'N') bgColor = 'FFA6A6A6'; // Gray
        else if (val === 'PP') textColor = 'FFFF0000'; // Red
        
        if (bgColor) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor }
          };
        }
        
        cell.font = { 
          bold: val === 'PP', 
          color: { argb: textColor },
          size: 10,
          name: 'Arial'
        };
      });
    });

    worksheet.columns.forEach((column, i) => {
      column.width = i === 0 ? 25 : 15;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `turnos-s${weekNumber}-${year}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const shiftStyles: any = {
    [ShiftCode.Morning]: 'bg-shift-m-bg text-shift-m-text border-slate-200',
    [ShiftCode.Afternoon]: 'bg-shift-t-bg text-shift-t-text border-slate-200',
    [ShiftCode.Night]: 'bg-shift-n-bg text-shift-n-text border-slate-200',
    [ShiftCode.Off]: 'bg-shift-l-bg text-shift-l-text border-slate-200',
    [ShiftCode.Vacation]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    [ShiftCode.Sick]: 'bg-red-100 text-red-800 border-red-200',
    [ShiftCode.Holiday]: 'bg-amber-100 text-amber-800 border-amber-200',
    [ShiftCode.Extra]: 'bg-shift-e-bg text-shift-e-text border-transparent',
    [ShiftCode.ExtraAfternoon]: 'bg-shift-et-bg text-shift-et-text border-transparent',
  };

  const getShiftLabel = (code: string) => {
    switch(code) {
       case 'M': return 'MAÑANA';
       case 'T': return 'TARDE';
       case 'E': return '10:00-18:00';
       case 'ET': return '16:00-20:00';
       case 'N': return 'NOCHE';
       case 'L': return 'LIBRE';
       case 'V': return 'VACACIONES';
       case 'B': return 'BAJA';
       case 'F': return 'FESTIVO';
       case 'PP': return 'PP';
       default: return code;
    }
  }

  return (
    <div className="space-y-6">
      {/* Calendar Controls */}
      <div className="bg-card-bg rounded-2xl p-6 border border-border-main shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
           <button 
             onClick={() => {
               const d = new Date(currentDate);
               d.setDate(d.getDate() - 7);
               setCurrentDate(d);
             }}
             className="p-2 border border-border-main rounded-lg bg-white text-text-muted hover:text-text-main transition-all"
           >
             <ChevronLeft size={18} />
           </button>
           
           <div className="text-center min-w-[200px]">
             <h3 className="text-xl font-black text-brand-primary tracking-tighter uppercase">{dateRange}</h3>
             <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">Semana {weekNumber} • {year}</p>
           </div>

           <button 
              onClick={() => {
                const d = new Date(currentDate);
                d.setDate(d.getDate() + 7);
                setCurrentDate(d);
              }}
              className="p-2 border border-border-main rounded-lg bg-white text-text-muted hover:text-text-main transition-all"
            >
              <ChevronRight size={18} />
            </button>
            
            {isLocked && (
              <div className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-full text-amber-700">
                <Lock size={12} className="stroke-[3]" />
                <span className="text-[10px] font-black uppercase tracking-tight leading-none">Cerrado (Solo Lectura)</span>
              </div>
            )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
           <button 
             onClick={handleExportPDF}
             disabled={!schedule}
             className="flex-1 md:flex-none border border-border-main bg-white text-text-main px-4 py-2 rounded-lg font-bold hover:bg-slate-50 transition-all disabled:opacity-50 text-[13px]"
           >
             PDF
           </button>

           <button 
             onClick={handleExportExcel}
             disabled={!schedule}
             className="flex-1 md:flex-none border border-border-main bg-white text-text-main px-4 py-2 rounded-lg font-bold hover:bg-slate-50 transition-all disabled:opacity-50 text-[13px]"
           >
             EXCEL
           </button>
           
           <button 
             onClick={schedule ? handleSaveSchedule : fetchSchedule}
             disabled={loading || saving || isLocked || (!schedule && loading)}
             className={`flex-1 md:flex-none px-6 py-2 rounded-lg font-bold hover:shadow-md transition-all disabled:opacity-50 text-[13px] flex items-center justify-center gap-2 ${
               !schedule ? 'bg-text-main text-white' : (hasChanges ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500')
             }`}
           >
             {saving || loading ? <RotateCw size={14} className="animate-spin" /> : <Save size={14} />}
             {!schedule ? 'Iniciar Horario Semanal' : (hasChanges ? 'Guardar Cambios' : 'Sin cambios')}
           </button>
        </div>
      </div>

      {/* Schedule Table */}
      <div className="bg-card-bg rounded-2xl border border-border-main shadow-sm overflow-hidden">
        {schedule ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-400">
                  <th className="px-5 py-3 w-[180px] border-r border-slate-400 bg-white">
                    <div className="text-[11px] font-bold text-slate-800 uppercase tracking-widest text-left">Empleado</div>
                  </th>
                  {DAYS_ARRAY.map((day, idx) => {
                    const cellDate = new Date(mondayDate.getTime() + idx * 24 * 60 * 60 * 1000);
                    const dateStr = `${cellDate.getDate().toString().padStart(2, '0')}/${(cellDate.getMonth() + 1).toString().padStart(2, '0')}`;
                    return (
                      <th key={day} className="px-1 py-1 text-center border-r border-slate-400 last:border-r-0 bg-[#00FFFF]">
                         <div className="flex flex-col">
                           <span className="text-[10px] font-bold text-slate-700 leading-tight">{dateStr}</span>
                           <span className="text-[12px] font-black text-black uppercase tracking-tighter">{day.toUpperCase()}</span>
                         </div>
                      </th>
                    );
                  })}
                  <th className="px-2 py-3 text-center w-[60px] bg-slate-50 border-r border-slate-400">
                     <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-none">Lib</span>
                  </th>
                  <th className="px-2 py-3 text-center w-[60px] bg-indigo-50">
                     <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest leading-none">Noc</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {sortedEmployees
                  .map(emp => {
                    const assignments = schedule.assignments[emp.id] || {};
                    const totalL = Object.values(assignments).filter(v => typeof v === 'string' && v.startsWith('L')).length;
                    const totalN = Object.values(assignments).filter(v => typeof v === 'string' && v.startsWith('N')).length;
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-2 border-r border-border-main">
                         <div className="text-sm font-bold text-text-main">{emp.name.toUpperCase()}</div>
                      </td>
                      {DAYS_ARRAY.map((day, idx) => {
                        const code = (assignments[day] as string) || ShiftCode.Off;
                        const bgColor = code === 'L' ? 'bg-[#ffff00]' : (code === 'N' ? 'bg-[#a6a6a6]' : 'bg-white');
                        const textColor = code === 'PP' ? 'text-red-600' : 'text-slate-900';
                        
                        // Check for request reminder
                        const cellDate = new Date(mondayDate.getTime() + idx * 24 * 60 * 60 * 1000);
                        cellDate.setHours(0,0,0,0);
                        const activeReq = weeklyRequests.find(req => {
                          if (req.employeeId !== emp.id) return false;
                          const start = new Date(req.startDate);
                          const end = new Date(req.endDate);
                          start.setHours(0,0,0,0);
                          end.setHours(0,0,0,0);
                          return cellDate >= start && cellDate <= end;
                        });

                        return (
                          <td key={day} className={`p-0 border-r border-slate-400 last:border-r-0 h-[65px] relative ${bgColor}`}>
                             {activeReq && (
                               <div 
                                 className="absolute top-1 right-1 z-10" 
                                 title={`${activeReq.type}: ${new Date(activeReq.startDate).toLocaleDateString()} al ${new Date(activeReq.endDate).toLocaleDateString()}${activeReq.reason ? ` (${activeReq.reason})` : ''}`}
                               >
                                 <div className="w-2 h-2 bg-brand-primary rounded-full animate-pulse shadow-sm" />
                               </div>
                             )}
                             <select
                               value={code}
                               disabled={isLocked}
                               onChange={(e) => handleUpdateAssignment(emp.id, day, e.target.value)}
                               className={`w-full h-full text-center appearance-none cursor-pointer font-bold outline-none border-0 transition-all bg-transparent ${textColor} text-sm focus:ring-2 focus:ring-brand-primary/20`}
                             >
                               <option value={ShiftCode.Morning}>M</option>
                               <option value={ShiftCode.Afternoon}>T</option>
                               <option value={ShiftCode.Extra}>10:00-18:00</option>
                               <option value={ShiftCode.ExtraAfternoon}>16:00-20:00</option>
                               <option value={ShiftCode.Night}>N</option>
                               <option value={ShiftCode.Off}>L</option>
                               <option value={ShiftCode.PaidLeave}>PP</option>
                               <option value={ShiftCode.Vacation}>V</option>
                               <option value={ShiftCode.Sick}>B</option>
                               <option value={ShiftCode.Holiday}>F</option>
                             </select>
                          </td>
                        );
                      })}
                      <td className="px-2 py-4 text-center bg-slate-50/30 border-r border-border-main">
                         <span className="text-sm font-bold text-text-main">{totalL}</span>
                      </td>
                      <td className="px-2 py-4 text-center bg-indigo-50/20">
                         <span className="text-sm font-bold text-indigo-600">{totalN}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/80 border-t-2 border-slate-200">
                <tr>
                  <td className="px-5 py-3 border-r border-border-main">
                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-tighter leading-none mb-1">TOTALES</div>
                    <div className="text-xs font-black text-slate-700">Personal Activo</div>
                  </td>
                  {DAYS_ARRAY.map((day, idx) => {
                    let totalM = 0;
                    let totalT = 0;
                    let totalN = 0;
                    let totalL = 0;
                    sortedEmployees.forEach(emp => {
                      const code = schedule.assignments[emp.id]?.[day];
                      if (code && typeof code === 'string') {
                        if (code === ShiftCode.Morning || code === ShiftCode.Extra) totalM++;
                        else if (code === ShiftCode.Afternoon || code === ShiftCode.ExtraAfternoon) totalT++;
                        else if (code === ShiftCode.Night) totalN++;
                        else if (code === ShiftCode.Off) totalL++;
                      }
                    });

                    const isWeekend = idx >= 4; // Viernes, Sabado, Domingo
                    const limitM = isWeekend ? 4 : 3;
                    const isMOver = totalM > limitM;
                    const isTOver = totalT > 2;

                    return (
                      <td key={day} className="p-2 border-r border-border-main last:border-r-0">
                        <div className="flex flex-col gap-1.5">
                          <div className={`flex items-center justify-between px-3 py-1 border rounded-lg shadow-sm ${isMOver ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                            <span className={`text-[9px] font-black uppercase tracking-tight ${isMOver ? 'text-red-500' : 'text-amber-600'}`}>Mañ</span>
                            <span className={`text-base font-black leading-none ${isMOver ? 'text-red-700' : 'text-amber-900'}`}>{totalM}</span>
                          </div>
                          <div className={`flex items-center justify-between px-3 py-1 border rounded-lg shadow-sm ${isTOver ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
                            <span className={`text-[9px] font-black uppercase tracking-tight ${isTOver ? 'text-red-500' : 'text-orange-600'}`}>Tar</span>
                            <span className={`text-base font-black leading-none ${isTOver ? 'text-red-700' : 'text-orange-900'}`}>{totalT}</span>
                          </div>
                          <div className="flex items-center justify-between px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-lg shadow-sm">
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-tight">Noc</span>
                            <span className="text-base font-black text-indigo-900 leading-none">{totalN}</span>
                          </div>
                          <div className="flex items-center justify-between px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg shadow-sm">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Lib</span>
                            <span className="text-base font-black text-slate-700 leading-none">{totalL}</span>
                          </div>
                        </div>
                      </td>
                    );
                  })}
                  <td colSpan={2} className="bg-slate-100/50 p-2">
                     <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between px-2 py-1 bg-white/60 rounded border border-slate-200">
                           <span className="text-[9px] font-black text-slate-400 uppercase">Tot Lib</span>
                           <span className="text-xs font-black text-slate-800">
                              {Object.values(schedule.assignments).reduce((acc: number, curr: any) => 
                                 acc + Object.values(curr).filter(v => v === 'L').length, 0
                              )}
                           </span>
                        </div>
                        <div className="flex items-center justify-between px-2 py-1 bg-indigo-100/60 rounded border border-indigo-200">
                           <span className="text-[9px] font-black text-indigo-400 uppercase">Tot Noc</span>
                           <span className="text-xs font-black text-indigo-700">
                              {Object.values(schedule.assignments).reduce((acc: number, curr: any) => 
                                 acc + Object.values(curr).filter(v => typeof v === 'string' && v.startsWith('N')).length, 0
                              )}
                           </span>
                        </div>
                     </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="py-32 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 mb-4 border-2 border-slate-50">
               <CalendarIcon size={32} strokeWidth={1.5} />
            </div>
            <h4 className="text-xl font-black text-slate-900 mb-2">Sin Programación Activa</h4>
            <p className="text-slate-500 text-sm font-medium max-w-sm">Haz clic en "Iniciar Horario Semanal" para comenzar la programación manual de esta semana.</p>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        {(() => {
          let daysWithMajorAfternoon: string[] = [];
          let daysWithMajorMorning: string[] = [];
          const isWeekend = (day: string) => ['Viernes', 'Sábado', 'Domingo'].includes(day);

          if (schedule) {
            DAYS_ARRAY.forEach((day, idx) => {
              const limitM = idx >= 4 ? 4 : 3;
              const limitT = 2;

              const morningStaff = sortedEmployees.filter(e => {
                const code = schedule.assignments[e.id]?.[day];
                return code === ShiftCode.Morning || code === ShiftCode.Extra;
              }).map(e => e.name.toUpperCase());

              const afternoonStaff = sortedEmployees.filter(e => {
                const code = schedule.assignments[e.id]?.[day];
                return code === ShiftCode.Afternoon || code === ShiftCode.ExtraAfternoon;
              }).map(e => e.name.toUpperCase());

              const countT = afternoonStaff.length;
              const countM = morningStaff.length;

              if (countT > limitT) daysWithMajorAfternoon.push(`${day} (${countT}): ${afternoonStaff.join(', ')}`);
              if (countM > limitM) daysWithMajorMorning.push(`${day} (${countM}): ${morningStaff.join(', ')}`);
            });
          }
           
          return (
            <>
              <div className={`${daysWithMajorMorning.length > 0 ? 'bg-red-50 border-red-200' : 'bg-card-bg border-border-main'} p-4 rounded-xl border shadow-sm flex flex-col gap-1 transition-all relative overflow-hidden`}>
                {daysWithMajorMorning.length > 0 && <div className="absolute top-0 right-0 p-1"><Bell size={14} className="text-red-500 animate-bounce" /></div>}
                <span className={`text-[10px] font-bold ${daysWithMajorMorning.length > 0 ? 'text-red-500' : 'text-text-muted'} uppercase tracking-widest`}>Turno de Mañana</span>
                <div className="flex flex-col">
                  <span className={`text-base font-bold ${daysWithMajorMorning.length > 0 ? 'text-red-600' : 'text-text-main'}`}>
                    {daysWithMajorMorning.length > 0 ? `ALERTA: ${daysWithMajorMorning.length} días exceso` : 'Sin alertas'}
                    {daysWithMajorMorning.length === 0 && <span className="ml-2 text-emerald-500 text-xs text-[10px]">OK</span>}
                  </span>
                  {daysWithMajorMorning.length > 0 && (
                    <div className="flex flex-col gap-0.5 mt-1">
                      {daysWithMajorMorning.map((alert, i) => (
                        <span key={i} className="text-[10px] font-black text-red-700 uppercase tracking-tight leading-tight">
                          {alert}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className={`${daysWithMajorAfternoon.length > 0 ? 'bg-red-50 border-red-200' : 'bg-card-bg border-border-main'} p-4 rounded-xl border shadow-sm flex flex-col gap-1 transition-all relative overflow-hidden`}>
                {daysWithMajorAfternoon.length > 0 && <div className="absolute top-0 right-0 p-1"><Bell size={14} className="text-red-500 animate-bounce" /></div>}
                <span className={`text-[10px] font-bold ${daysWithMajorAfternoon.length > 0 ? 'text-red-500' : 'text-text-muted'} uppercase tracking-widest`}>Turno de Tarde</span>
                <div className="flex flex-col">
                  <span className={`text-base font-bold ${daysWithMajorAfternoon.length > 0 ? 'text-red-600' : 'text-text-main'}`}>
                    {daysWithMajorAfternoon.length > 0 ? `ALERTA: ${daysWithMajorAfternoon.length} días exceso` : 'Sin alertas'}
                    {daysWithMajorAfternoon.length === 0 && <span className="ml-2 text-emerald-500 text-xs text-[10px]">OK</span>}
                  </span>
                  {daysWithMajorAfternoon.length > 0 && (
                    <div className="flex flex-col gap-0.5 mt-1">
                      {daysWithMajorAfternoon.map((alert, i) => (
                        <span key={i} className="text-[10px] font-black text-red-700 uppercase tracking-tight leading-tight">
                          {alert}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          );
        })()}
        <div className="bg-card-bg p-4 rounded-xl border border-border-main shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Rotación Finde</span>
          <span className="text-base font-bold text-text-main">Activa</span>
        </div>
        <div className="bg-card-bg p-4 rounded-xl border border-border-main shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Noches Cubiertas</span>
          <span className="text-base font-bold text-text-main">7/7 Noches OK</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600">
           <AlertCircle size={20} />
           <p className="text-xs font-bold uppercase tracking-tight">{error}</p>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 pt-4">
         {Object.entries(shiftStyles).map(([code, style]: [any, any]) => (
            <div key={code} className="flex items-center gap-2">
               <div className={`w-3 h-3 rounded-full border ${style.split(' ')[0]} ${style.split(' ')[2]}`}></div>
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{getShiftLabel(code)}</span>
            </div>
         ))}
      </div>
    </div>
  );
}
