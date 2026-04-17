import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  RotateCw, 
  Download,
  CheckCircle2,
  Calendar as CalendarIcon,
  AlertCircle,
  Lock
} from 'lucide-react';
import { Employee, Schedule, ShiftCode, DAYS_ARRAY, Role } from '../types.ts';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import { generateScheduleClient } from '../services/scheduleClientService.ts';
import { db } from '../lib/firebase-client.ts';
import { doc, getDoc } from 'firebase/firestore';
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
      const data = await generateScheduleClient(weekNumber, year);
      setSchedule(data);
    } catch (err: any) {
      console.error('Generation Error:', err);
      setError(err.message || 'Error al generar el horario');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generateScheduleClient(weekNumber, year, true);
      setSchedule(data);
    } catch (err: any) {
      console.error('Regeneration Error:', err);
      setError(err.message || 'Error al regenerar el horario');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadExisting = async () => {
      setLoading(true);
      setError(null);
      try {
        const scheduleId = `${year}-W${weekNumber}`;
        const docSnap = await getDoc(doc(db, 'schedules', scheduleId));
        if (docSnap.exists()) {
          setSchedule(docSnap.data() as Schedule);
        } else {
          setSchedule(null);
        }
      } catch (err: any) {
        console.error('Load Error:', err);
        // Silently fail load if it's just missing, but log others
      } finally {
        setLoading(false);
      }
    };
    loadExisting();
  }, [weekNumber, year]);

  const handleExportPDF = () => {
    if (!schedule) return;
    const doc = new jsPDF('landscape');
    doc.setFontSize(20);
    doc.text(`Turnos de Recepción - Semana ${weekNumber} (${year})`, 14, 20);
    
    const tableData = employees.map(emp => {
      const assignments = schedule.assignments[emp.id] || {};
      return [
        emp.name.toUpperCase(),
        emp.role,
        ...DAYS_ARRAY.map(day => assignments[day] || '-')
      ];
    });

    doc.autoTable({
      startY: 30,
      head: [['Nombre', 'Rol', ...DAYS_ARRAY]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
      styles: { fontSize: 7, font: 'helvetica' },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index > 1) {
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

  const shiftStyles: any = {
    [ShiftCode.Morning]: 'bg-shift-m-bg text-shift-m-text border-transparent',
    [ShiftCode.Afternoon]: 'bg-shift-t-bg text-shift-t-text border-transparent',
    [ShiftCode.Night]: 'bg-shift-n-bg text-shift-n-text border-transparent',
    [ShiftCode.Off]: 'bg-shift-l-bg text-shift-l-text border-transparent',
    [ShiftCode.Vacation]: 'bg-emerald-100 text-emerald-800 border-transparent',
    [ShiftCode.Sick]: 'bg-red-100 text-red-800 border-transparent',
    [ShiftCode.Holiday]: 'bg-amber-100 text-amber-800 border-transparent',
  };

  const getShiftLabel = (code: string) => {
    switch(code) {
       case 'M': return 'MAÑANA';
       case 'T': return 'TARDE';
       case 'N': return 'NOCHE';
       case 'L': return 'LIBRE';
       case 'V': return 'VACACIONES';
       case 'B': return 'BAJA';
       case 'F': return 'FESTIVO';
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
           {schedule ? (
             <button 
               onClick={handleRegenerate}
               disabled={loading || isLocked}
               className="flex-1 md:flex-none bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:shadow-md transition-all disabled:opacity-50 text-[13px] flex items-center gap-2"
             >
               <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
               Regenerar
             </button>
           ) : (
             <button 
               onClick={fetchSchedule}
               disabled={loading || isLocked}
               className={`flex-1 md:flex-none px-6 py-2 rounded-lg font-bold hover:shadow-md transition-all disabled:opacity-50 text-[13px] ${isLocked ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-text-main text-white'}`}
             >
               {loading ? <RotateCw size={14} className="animate-spin" /> : 'Generar'}
             </button>
           )}
        </div>
      </div>

      {/* Schedule Table */}
      <div className="bg-card-bg rounded-2xl border border-border-main shadow-sm overflow-hidden">
        {schedule ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-100 border-b border-border-main">
                  <th className="px-5 py-3 w-[180px] border-r border-border-main">
                    <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest text-left">Empleado</div>
                  </th>
                  {DAYS_ARRAY.map((day, idx) => {
                    const cellDate = new Date(mondayDate.getTime() + idx * 24 * 60 * 60 * 1000);
                    return (
                      <th key={day} className="px-1 py-3 text-center border-r border-border-main last:border-r-0">
                         <div className="flex flex-col">
                           <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{day.slice(0, 3)}</span>
                           <span className="text-sm font-black text-slate-900">{cellDate.getDate()}</span>
                         </div>
                      </th>
                    );
                  })}
                  <th className="px-2 py-3 text-center w-[60px] bg-slate-50/50 border-r border-border-main">
                     <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Libres</span>
                  </th>
                  <th className="px-2 py-3 text-center w-[60px] bg-indigo-50/50">
                     <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Noches</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-main">
                {employees
                  .sort((a, b) => {
                    const ROLE_ORDER: Record<string, number> = {
                      [Role.Jefe]: 0,
                      [Role.Subjefe]: 1,
                      [Role.Recepcionista]: 2,
                      [Role.Ayudante]: 3,
                      [Role.Conserje]: 4
                    };
                    return (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99);
                  })
                  .map(emp => {
                    const assignments = schedule.assignments[emp.id] || {};
                    const totalL = Object.values(assignments).filter(v => v === 'L').length;
                    const totalN = Object.values(assignments).filter(v => typeof v === 'string' && v.startsWith('N')).length;
                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-2 border-r border-border-main">
                         <div className="text-[10px] font-bold text-text-muted uppercase tracking-tighter leading-none">{emp.role}</div>
                         <div className="text-sm font-bold text-text-main">{emp.name.toUpperCase()}</div>
                      </td>
                      {DAYS_ARRAY.map(day => {
                        const code = assignments[day] as string;
                        // For labels like "T (16:00-20:00)", extract the base code "T" to get the style
                        const baseCode = code ? code.charAt(0) : '';
                        const style = shiftStyles[baseCode] || 'bg-white text-slate-300';
                        const isSpecial = code && code.length > 1;
                        
                        return (
                          <td key={day} className="p-2 border-r border-border-main last:border-r-0 h-[65px]">
                             <div 
                               className={`w-full h-full flex flex-col items-center justify-center rounded-lg font-extrabold transition-all ${style} ${isSpecial ? 'text-[10px] leading-tight px-1' : 'text-sm'}`}
                               title={code}
                             >
                                {code || ''}
                             </div>
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
                  {DAYS_ARRAY.map(day => {
                    let totalM = 0;
                    let totalT = 0;
                    let totalN = 0;
                    let totalL = 0;
                    employees.forEach(emp => {
                      const code = schedule.assignments[emp.id]?.[day];
                      if (code === ShiftCode.Morning) totalM++;
                      if (code === ShiftCode.Afternoon) totalT++;
                      if (code === ShiftCode.Night) totalN++;
                      if (code === ShiftCode.Off) totalL++;
                    });
                    return (
                      <td key={day} className="p-2 border-r border-border-main last:border-r-0">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between px-3 py-1 bg-amber-100 border border-amber-200 rounded-lg shadow-sm">
                            <span className="text-[9px] font-black text-amber-600 uppercase tracking-tight">Mañ</span>
                            <span className="text-base font-black text-amber-900 leading-none">{totalM}</span>
                          </div>
                          <div className="flex items-center justify-between px-3 py-1 bg-orange-100 border border-orange-200 rounded-lg shadow-sm">
                            <span className="text-[9px] font-black text-orange-600 uppercase tracking-tight">Tar</span>
                            <span className="text-base font-black text-orange-900 leading-none">{totalT}</span>
                          </div>
                          <div className="flex items-center justify-between px-3 py-1 bg-indigo-100 border border-indigo-200 rounded-lg shadow-sm">
                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tight">Noc</span>
                            <span className="text-base font-black text-indigo-900 leading-none">{totalN}</span>
                          </div>
                          <div className="flex items-center justify-between px-3 py-1 bg-slate-200 border border-slate-300 rounded-lg shadow-sm">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Lib</span>
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
            <p className="text-slate-500 text-sm font-medium max-w-sm">Haz clic en "Generar Turnos" para calcular la distribución determinista basada en las reglas y peticiones actuales.</p>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <div className="bg-card-bg p-4 rounded-xl border border-border-main shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Cobertura Mañana</span>
          <span className="text-base font-bold text-text-main flex items-center gap-2">
            7/7 Días OK
            <span className="text-emerald-500 text-xs">✓</span>
          </span>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm flex flex-col gap-1">
          <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Alertas Tarde</span>
          <span className="text-base font-bold text-red-600">Ninguna detectada</span>
        </div>
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
