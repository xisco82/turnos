
import React, { useState, useMemo, useEffect } from 'react';
import { AppConfig, DayOfWeek, Employee, ScheduleRow, Shift } from './types';
import { 
    DAYS_OF_WEEK, 
    ShiftConst,
    DEFAULT_CONFIG,
    getShiftDetails
} from './constants';
import { generateWeeklySchedule, getDateForDay } from './scheduleService';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { RefreshIcon, SuitcaseIcon, EditIcon } from './components/Icons';
import { ChevronLeft, ChevronRight, Settings, Download, MoreHorizontal, User, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';
import SetupForm from './components/SetupForm';
import RequestsManager from './components/RequestsManager';
import ConfigDialog from './components/ConfigDialog';

// Extend jsPDF for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  d.setHours(0, 0, 0, 0);
  return new Date(d.setDate(diff));
};

const getWeekNumber = (d: Date): number => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
  return weekNo;
};

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showRequests, setShowRequests] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  // Modal para edición manual de turno puntual
  const [editingCell, setEditingCell] = useState<{
    employeeId: string;
    employeeName: string;
    day: DayOfWeek;
    currentShift: Shift;
  } | null>(null);

  // Overrides manuales guardados por semana: { "2026-week-38": { "rec-0-Lunes": "M" } }
  const [overridesByWeek, setOverridesByWeek] = useState<Record<string, Record<string, Shift>>>(() => {
    const saved = localStorage.getItem('turnos_manual_overrides');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing manual overrides", e);
      }
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem('turnos_manual_overrides', JSON.stringify(overridesByWeek));
  }, [overridesByWeek]);

  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('turnos_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        
        // Comprobar si necesitamos plantilla estándar
        const currentCount = (parsed.recepcionistas?.length || 0) + (parsed.ayudantes?.length || 0) + 3;
        const hasToniBP = parsed.requests?.some((r: any) => r.id === 'toni-baja-2026' || r.id === 'sample-bp-toni');
        if (currentCount < 11 || (parsed.ayudantes?.length < 3)) {
           return DEFAULT_CONFIG;
        }

        const merged = {
          ...DEFAULT_CONFIG,
          ...parsed,
          recepcionistas: parsed.recepcionistas || DEFAULT_CONFIG.recepcionistas,
          ayudantes: parsed.ayudantes || DEFAULT_CONFIG.ayudantes,
          extraEmployees: parsed.extraEmployees || [],
          fixedOffDays: parsed.fixedOffDays || {},
          requests: parsed.requests || []
        };
        // Inyectar baja de Toni si no existe
        if (!merged.requests.some((r: any) => r.employeeId === 'rec-1' && r.type === 'Baja')) {
          merged.requests.push(DEFAULT_CONFIG.requests[0]);
        }
        return merged;
      } catch (e) {
        console.error("Error parsing saved config", e);
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  });

  useEffect(() => {
    localStorage.setItem('turnos_config', JSON.stringify(config));
  }, [config]);

  const startOfWeek = useMemo(() => getStartOfWeek(currentDate), [currentDate]);
  const weekNumber = useMemo(() => getWeekNumber(startOfWeek), [startOfWeek]);
  const yearNumber = useMemo(() => startOfWeek.getFullYear(), [startOfWeek]);
  const currentWeekKey = `${yearNumber}-w${weekNumber}`;

  const currentWeekOverrides = useMemo(() => {
    return overridesByWeek[currentWeekKey] || {};
  }, [overridesByWeek, currentWeekKey]);

  const hasManualOverridesThisWeek = useMemo(() => {
    return Object.keys(currentWeekOverrides).length > 0;
  }, [currentWeekOverrides]);

  const scheduleData = useMemo<ScheduleRow[]>(() => {
    return generateWeeklySchedule(config, weekNumber, startOfWeek, currentWeekOverrides);
  }, [config, weekNumber, startOfWeek, currentWeekOverrides]);

  const handleApplyShiftOverride = (shift: Shift | null) => {
    if (!editingCell) return;
    const cellKey = `${editingCell.employeeId}-${editingCell.day}`;
    
    setOverridesByWeek(prev => {
      const weekMap = { ...(prev[currentWeekKey] || {}) };
      if (shift === null) {
        delete weekMap[cellKey];
      } else {
        weekMap[cellKey] = shift;
      }
      return {
        ...prev,
        [currentWeekKey]: weekMap
      };
    });
    setEditingCell(null);
  };

  const handleResetCurrentWeek = () => {
    setOverridesByWeek(prev => {
      const copy = { ...prev };
      delete copy[currentWeekKey];
      return copy;
    });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(20);
    doc.text(`Turnos de Recepción - Semana ${weekNumber} (${yearNumber})`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Jefe: ${config.jefe || 'XISCO'} | 2º Jefe: ${config.subjefe || 'ALIZ'} | Conserje: ${config.conserje || 'OSCAR'}`, 14, 28);

    const tableData = scheduleData.map(row => [
      row.employeeName,
      ...row.shifts.map(s => s.shift)
    ]);

    doc.autoTable({
      startY: 35,
      head: [['Empleado', ...DAYS_OF_WEEK]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [31, 41, 55] },
      didParseCell: (data: any) => {
        if (data.section === 'body') {
          const val = data.cell.raw;
          if (val === 'M') data.cell.styles.fillColor = [254, 249, 195];
          if (val === 'T') data.cell.styles.fillColor = [224, 242, 254];
          if (val === 'L') data.cell.styles.fillColor = [243, 244, 246];
          if (val === 'N') {
            data.cell.styles.fillColor = [79, 70, 229];
            data.cell.styles.textColor = [255, 255, 255];
          }
          if (val === '16-20') data.cell.styles.fillColor = [237, 233, 254];
          if (val === 'BP') data.cell.styles.fillColor = [255, 228, 230];
          if (val === 'V') data.cell.styles.fillColor = [209, 250, 229];
        }
      }
    });

    doc.save(`turnos-semana-${weekNumber}-${yearNumber}.pdf`);
  };

  const changeWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(startOfWeek);
    newDate.setDate(newDate.getDate() + (direction === 'prev' ? -7 : 7));
    setCurrentDate(newDate);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-slate-950 p-4 lg:p-10 font-sans selection:bg-zinc-900 selection:text-white">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between border-b border-zinc-200 pb-8 gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-6xl font-black italic tracking-tight uppercase leading-none text-zinc-900">
              Turnos<span className="text-zinc-300">.</span>
            </h1>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Reglas Activas (2L/Sem)
            </span>
          </div>
          
          <div className="mt-4 flex items-center gap-4">
             <div className="flex flex-col">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest leading-none">Semana</span>
                <span className="text-2xl font-bold font-mono tracking-tighter mt-1 text-zinc-900">{weekNumber}</span>
             </div>
             <div className="h-10 w-[1px] bg-zinc-200"></div>
             <div className="flex flex-col">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest leading-none">Fecha Inicio</span>
                <span className="text-2xl font-bold font-mono tracking-tighter mt-1 text-zinc-900">{startOfWeek.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase()}</span>
             </div>
             <div className="h-10 w-[1px] bg-zinc-200"></div>
             <div className="flex flex-col">
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest leading-none">Año</span>
                <span className="text-2xl font-bold font-mono tracking-tighter mt-1 text-zinc-900">{yearNumber}</span>
             </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasManualOverridesThisWeek && (
            <Button 
              variant="outline" 
              className="h-14 border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-bold uppercase tracking-wider px-4 rounded-none flex items-center gap-2"
              onClick={handleResetCurrentWeek}
              title="Restablece los turnos de esta semana al cálculo automático de reglas"
            >
              <RotateCcw className="h-4 w-4 text-amber-700" />
              Restablecer Semana
            </Button>
          )}

          <Button variant="ghost" className="h-14 w-14 border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 transition-all rounded-none" onClick={() => changeWeek('prev')}>
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button variant="ghost" className="h-14 w-14 border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 transition-all rounded-none" onClick={() => changeWeek('next')}>
            <ChevronRight className="h-6 w-6" />
          </Button>
          
          <div className="h-14 w-[1px] bg-zinc-200 mx-2 hidden md:block"></div>

          <Button variant="ghost" className="h-14 border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 uppercase font-mono text-[10px] tracking-widest px-6 rounded-none" onClick={() => setShowRequests(!showRequests)}>
            <RefreshIcon className="mr-2 h-3 w-3" /> Peticiones ({config.requests?.length || 0})
          </Button>

          <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" className="h-14 border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 uppercase font-mono text-[10px] tracking-widest px-6 rounded-none">
                <Settings className="mr-2 h-4 w-4" /> Ajustes
              </Button>
            </DialogTrigger>
            <ConfigDialog 
              config={config} 
              onSave={(newConfig) => {
                setConfig(newConfig);
                setIsConfigOpen(false);
              }} 
            />
          </Dialog>

          <Button className="h-14 bg-zinc-900 text-white font-black uppercase tracking-widest text-xs px-8 hover:bg-zinc-800 transition-all rounded-none ring-offset-white focus:ring-2 focus:ring-zinc-900" onClick={handleExportPDF}>
            Exportar PDF
          </Button>
        </div>
      </header>

      {showRequests && (
        <div className="mb-10 border border-blue-100 p-6 bg-white shadow-lg shadow-blue-900/5 animate-in fade-in zoom-in duration-300">
           <RequestsManager 
              config={config} 
              onUpdateRequests={(reqs) => setConfig({ ...config, requests: reqs })} 
            />
        </div>
      )}

      {showSetup && (
        <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-6">
           <div className="w-full max-w-2xl bg-white border border-zinc-200 p-10 relative shadow-2xl">
              <SetupForm 
                initialConfig={config}
                onSave={(newConfig) => {
                  setConfig(newConfig);
                  setShowSetup(false);
                }} 
              />
              <button 
                onClick={() => setShowSetup(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 transition"
              >
                ✕
              </button>
           </div>
        </div>
      )}

      {/* MODAL EDICIÓN RÁPIDA DE TURNO */}
      {editingCell && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-zinc-200 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start border-b border-zinc-100 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-black uppercase text-zinc-900 tracking-tight">Cambiar Turno</h3>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  {editingCell.employeeName} — {editingCell.day}
                </p>
              </div>
              <button 
                onClick={() => setEditingCell(null)}
                className="text-zinc-400 hover:text-zinc-900 text-lg leading-none p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-600 mb-4">
              Selecciona el turno que deseas asignar a esta casilla:
            </p>

            <div className="grid grid-cols-2 gap-2 mb-6">
              <button
                type="button"
                onClick={() => handleApplyShiftOverride(ShiftConst.Morning)}
                className="p-3 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 text-yellow-900 rounded text-left transition flex items-center justify-between"
              >
                <div>
                  <div className="font-black text-sm">M — Mañana</div>
                  <div className="text-[10px] text-yellow-700">08:00 - 16:00</div>
                </div>
                {editingCell.currentShift === ShiftConst.Morning && <span className="text-xs">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => handleApplyShiftOverride(ShiftConst.Afternoon)}
                className="p-3 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-900 rounded text-left transition flex items-center justify-between"
              >
                <div>
                  <div className="font-black text-sm">T — Tarde</div>
                  <div className="text-[10px] text-sky-700">16:00 - 00:00</div>
                </div>
                {editingCell.currentShift === ShiftConst.Afternoon && <span className="text-xs">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => handleApplyShiftOverride(ShiftConst.Night)}
                className="p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 rounded text-left transition flex items-center justify-between"
              >
                <div>
                  <div className="font-black text-sm">N — Noche</div>
                  <div className="text-[10px] text-indigo-700">00:00 - 08:00</div>
                </div>
                {editingCell.currentShift === ShiftConst.Night && <span className="text-xs">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => handleApplyShiftOverride(ShiftConst.Off)}
                className="p-3 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 text-zinc-900 rounded text-left transition flex items-center justify-between"
              >
                <div>
                  <div className="font-black text-sm">L — Libre</div>
                  <div className="text-[10px] text-zinc-600">Día de descanso</div>
                </div>
                {editingCell.currentShift === ShiftConst.Off && <span className="text-xs">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => handleApplyShiftOverride(ShiftConst.LorenaSpecial)}
                className="p-3 bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-900 rounded text-left transition flex items-center justify-between"
              >
                <div>
                  <div className="font-black text-sm">16-20 — Refuerzo</div>
                  <div className="text-[10px] text-violet-700">Tarde corta</div>
                </div>
                {editingCell.currentShift === ShiftConst.LorenaSpecial && <span className="text-xs">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => handleApplyShiftOverride(ShiftConst.Vacation)}
                className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 rounded text-left transition flex items-center justify-between"
              >
                <div>
                  <div className="font-black text-sm">V — Vacaciones</div>
                  <div className="text-[10px] text-emerald-700">Permiso retribuido</div>
                </div>
                {editingCell.currentShift === ShiftConst.Vacation && <span className="text-xs">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => handleApplyShiftOverride(ShiftConst.Paternity)}
                className="p-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-900 rounded text-left transition flex items-center justify-between"
              >
                <div>
                  <div className="font-black text-sm">BP — Baja</div>
                  <div className="text-[10px] text-rose-700">Incapacidad / Baja</div>
                </div>
                {editingCell.currentShift === ShiftConst.Paternity && <span className="text-xs">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => handleApplyShiftOverride(ShiftConst.Festive)}
                className="p-3 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-900 rounded text-left transition flex items-center justify-between"
              >
                <div>
                  <div className="font-black text-sm">F — Festivo</div>
                  <div className="text-[10px] text-orange-700">Compensación</div>
                </div>
                {editingCell.currentShift === ShiftConst.Festive && <span className="text-xs">✓</span>}
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleApplyShiftOverride(null)}
                className="text-xs text-zinc-500 hover:text-zinc-900"
              >
                Restaurar automático
              </Button>
              <Button
                type="button"
                onClick={() => setEditingCell(null)}
                className="bg-zinc-900 text-white text-xs px-6 rounded-none hover:bg-zinc-800"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-10">
        <section>
          <div className="overflow-x-auto border border-zinc-200 bg-white shadow-sm">
            <Table className="border-collapse">
              <TableHeader className="bg-zinc-50/80">
                <TableRow className="border-b border-zinc-200 hover:bg-transparent">
                  <TableHead className="w-[190px] text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 py-6 border-r border-zinc-200">Empleado</TableHead>
                  {DAYS_OF_WEEK.map(day => (
                    <TableHead key={day} className="text-center text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 border-r border-zinc-200/50">
                      {day.slice(0, 3)}
                      <div className="mt-2 text-xl font-bold text-zinc-900 tracking-tighter">
                        {getDateForDay(startOfWeek, day).split('-')[2]}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="w-[90px] text-center text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400">Total L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduleData.map((row) => {
                  const offCount = row.shifts.filter(s => s.shift === ShiftConst.Off).length;
                  const isLorena = row.employeeName.toUpperCase().includes('LORENA');
                  const hasAbsence = row.shifts.some(s => [ShiftConst.Paternity, ShiftConst.Vacation].includes(s.shift as any));
                  const isExactTarget = isLorena ? offCount === 4 : hasAbsence ? true : offCount === 2;

                  return (
                    <TableRow key={row.employeeId} className="border-b border-zinc-100 group transition-all duration-200">
                      <TableCell className="border-r border-zinc-200 bg-zinc-50/30 py-4 group-hover:bg-zinc-100/50">
                        <div className="flex flex-col">
                          <span className="text-sm font-black uppercase tracking-tight text-zinc-950">{row.employeeName}</span>
                          <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest mt-0.5">{row.role}</span>
                        </div>
                      </TableCell>
                      {row.shifts.map((s, idx) => {
                        const isOverridden = Boolean(currentWeekOverrides[`${row.employeeId}-${s.day}`]);
                        
                        const colorMap: Record<string, string> = {
                           'M': 'bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-100',
                           'T': 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100',
                           'N': 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700 font-black',
                           'L': 'bg-zinc-100 text-zinc-500 border-zinc-200 hover:bg-zinc-200',
                           'V': 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
                           'BP': 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100',
                           'P': 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
                           'F': 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100',
                           '16-20': 'bg-violet-50 text-violet-800 border-violet-200 hover:bg-violet-100'
                        };
                        const technicalStyle = colorMap[s.shift] || "bg-white text-zinc-400";
                        
                        return (
                          <TableCell 
                            key={idx} 
                            className="p-0 border-r border-zinc-100 cursor-pointer relative select-none"
                            onClick={() => setEditingCell({
                              employeeId: row.employeeId,
                              employeeName: row.employeeName,
                              day: s.day,
                              currentShift: s.shift
                            })}
                            title={`Clic para modificar turno de ${row.employeeName} el ${s.day}`}
                          >
                             <div className={`h-16 flex items-center justify-center text-xs font-black transition-all border-b border-transparent ${technicalStyle}`}>
                                {s.shift}
                                {isOverridden && (
                                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-500 rounded-full" title="Modificado manualmente"></span>
                                )}
                             </div>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center bg-zinc-50/30 font-mono text-lg font-black">
                        <span className={`px-2 py-0.5 rounded text-sm ${isExactTarget ? 'text-zinc-700 bg-zinc-100' : 'text-amber-600 bg-amber-50 font-bold'}`}>
                          {offCount} L
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Technical Summary Widgets */}
        <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {DAYS_OF_WEEK.map(day => {
            const counts = scheduleData.reduce((acc, row) => {
              const shift = row.shifts.find(s => s.day === day)?.shift;
              if (shift === ShiftConst.Morning) acc.m++;
              if (shift === ShiftConst.Afternoon) acc.t++;
              if (shift === ShiftConst.LorenaSpecial) acc.t += 0.5;
              if (shift === ShiftConst.Night) acc.n++;
              return acc;
            }, { m: 0, t: 0, n: 0 });

            const isWeekend = [DayOfWeek.Friday, DayOfWeek.Saturday, DayOfWeek.Sunday].includes(day);
            const targetM = isWeekend ? 4 : 3;
            const targetT = 2;

            const isMOk = counts.m >= targetM;
            const isTOk = counts.t >= targetT;
            const isNOk = counts.n === 1;

            return (
              <div key={day} className="bg-white border border-zinc-200 p-4 transition-all shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em] font-bold">{day}</p>
                  <span className={`w-2 h-2 rounded-full ${isMOk && isTOk && isNOk ? 'bg-emerald-500' : 'bg-amber-400'}`}></span>
                </div>
                <div className="space-y-3">
                   <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase">M (Mañanas)</span>
                      <span className={`text-lg font-black ${!isMOk ? 'text-rose-600' : 'text-zinc-900'}`}>
                        {counts.m} <span className="text-[9px] font-normal text-zinc-400">/ min {targetM}</span>
                      </span>
                   </div>
                   <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase">T (Tardes)</span>
                      <span className={`text-lg font-black ${!isTOk ? 'text-rose-600' : 'text-zinc-900'}`}>
                        {counts.t} <span className="text-[9px] font-normal text-zinc-400">/ 2</span>
                      </span>
                   </div>
                   <div className="h-[1px] w-full bg-zinc-100"></div>
                   <div className="flex justify-between items-baseline">
                      <span className="text-[10px] font-mono text-zinc-400 uppercase">N (Noches)</span>
                      <span className={`text-lg font-black ${!isNOk ? 'text-rose-600' : 'text-zinc-900'}`}>
                        {counts.n} <span className="text-[9px] font-normal text-zinc-400">/ 1</span>
                      </span>
                   </div>
                </div>
              </div>
            );
          })}
        </section>
      </div>

      <footer className="mt-16 border-t border-zinc-200 pt-8 flex flex-col md:flex-row justify-between items-center opacity-70 gap-6">
         <div className="flex flex-wrap items-center gap-8">
            <div className="flex flex-col">
              <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-400">Mínimos Requeridos</span>
              <span className="text-xs font-bold text-zinc-900 mt-1 italic">3M / 2T (L-J) — 4M / 2T (V-D) + 1N</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-400">Libres por Empleado</span>
              <span className="text-xs font-bold text-zinc-900 mt-1 italic">2 Días Consecutivos (Rotación Semanal)</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-400">Edición</span>
              <span className="text-xs font-bold text-zinc-900 mt-1 italic">Haz clic en cualquier celda para cambiar turno</span>
            </div>
         </div>
         <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
           Sistema de Turnos Automatizado v3.0
         </p>
      </footer>
    </div>
  );
}
