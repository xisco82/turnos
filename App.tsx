
import React, { useState, useMemo, useEffect } from 'react';
import { AppConfig, DayOfWeek, Employee, ScheduleRow, Shift } from './types';
import { 
    DAYS_OF_WEEK, 
    ShiftConst,
    DEFAULT_CONFIG,
    getShiftDetails
} from './constants';
import { generateWeeklySchedule, getDateForDay, getPostNightSequenceDays } from './scheduleService';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { RefreshIcon, SuitcaseIcon, EditIcon } from './components/Icons';
import { ChevronLeft, ChevronRight, Settings, Download, MoreHorizontal, User, RotateCcw, CheckCircle2, AlertCircle, Moon } from 'lucide-react';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { Dialog, DialogTrigger } from './components/ui/dialog';
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
  const [customManualShift, setCustomManualShift] = useState('');

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
        
        // Filtrar a Lorena de ayudantes
        const rawAyudantes = parsed.ayudantes || DEFAULT_CONFIG.ayudantes;
        const cleanAyudantes = rawAyudantes.filter((name: string) => name.trim().toUpperCase() !== 'LORENA');

        const merged = {
          ...DEFAULT_CONFIG,
          ...parsed,
          conserje: parsed.conserje || DEFAULT_CONFIG.conserje,
          recepcionistas: parsed.recepcionistas || DEFAULT_CONFIG.recepcionistas,
          ayudantes: cleanAyudantes,
          extraEmployees: parsed.extraEmployees || [],
          fixedOffDays: {
            ...(DEFAULT_CONFIG.fixedOffDays || {}),
            ...(parsed.fixedOffDays || {})
          },
          fixedShifts: {
            ...(DEFAULT_CONFIG.fixedShifts || {}),
            ...(parsed.fixedShifts || {})
          },
          postNightBehaviour: parsed.postNightBehaviour || DEFAULT_CONFIG.postNightBehaviour || 'Afternoon',
          employeePostNightPreferences: parsed.employeePostNightPreferences || {},
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

  const conserjeOffDays = config.fixedOffDays?.['conserje'] || [];

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
          else if (val === 'T') data.cell.styles.fillColor = [224, 242, 254];
          else if (val === 'L') data.cell.styles.fillColor = [243, 244, 246];
          else if (val === 'N') {
            data.cell.styles.fillColor = [79, 70, 229];
            data.cell.styles.textColor = [255, 255, 255];
          }
          else if (val === 'BP') data.cell.styles.fillColor = [255, 228, 230];
          else if (val === 'V') data.cell.styles.fillColor = [209, 250, 229];
          else {
            data.cell.styles.fillColor = [204, 251, 241];
          }
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
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-6xl font-black italic tracking-tight uppercase leading-none text-zinc-900">
              Turnos<span className="text-zinc-300">.</span>
            </h1>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Reglas Activas (2L/Sem)
            </span>
            <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-950 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5">
              <Moon className="w-3 h-3 text-amber-600" /> Días a Cubrir Noche: {conserjeOffDays.length > 0 ? conserjeOffDays.join(', ') : 'Ninguno'}
            </span>
            <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1.5 ${
              (config.postNightBehaviour || 'Afternoon') === 'Afternoon'
                ? 'bg-sky-100 text-sky-900 border border-sky-200'
                : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
            }`}>
              <Moon className="w-3 h-3" /> Post-Noche: {(config.postNightBehaviour || 'Afternoon') === 'Afternoon' ? 'Turno de Tarde' : '2 Libres Consecutivos'}
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
        <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-zinc-300 shadow-2xl max-w-lg w-full p-6 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-start border-b border-zinc-200 pb-4 mb-4">
              <div>
                <h3 className="text-xl font-black uppercase text-zinc-900 tracking-tight">Cambiar Turno</h3>
                <p className="text-sm font-bold text-zinc-600 mt-1">
                  {editingCell.employeeName} — <span className="text-indigo-600">{editingCell.day}</span>
                </p>
              </div>
              <button 
                onClick={() => setEditingCell(null)}
                className="text-zinc-400 hover:text-zinc-900 text-2xl font-bold leading-none p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-sm font-medium text-zinc-600 mb-4">
              Selecciona el turno que deseas asignar a esta casilla:
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                type="button"
                onClick={() => handleApplyShiftOverride(ShiftConst.Morning)}
                className="p-3 bg-amber-100 hover:bg-amber-200 border-2 border-amber-300 text-amber-950 rounded-md text-left transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black w-8 text-center text-amber-900">M</span>
                  <div>
                    <div className="font-black text-sm uppercase">Mañana</div>
                    <div className="text-xs text-amber-800 font-medium">08:00 - 16:00</div>
                  </div>
                </div>
                {editingCell.currentShift === ShiftConst.Morning && <span className="text-base font-black">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => handleApplyShiftOverride(ShiftConst.Afternoon)}
                className="p-3 bg-sky-100 hover:bg-sky-200 border-2 border-sky-300 text-sky-950 rounded-md text-left transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black w-8 text-center text-sky-900">T</span>
                  <div>
                    <div className="font-black text-sm uppercase">Tarde</div>
                    <div className="text-xs text-sky-800 font-medium">16:00 - 00:00</div>
                  </div>
                </div>
                {editingCell.currentShift === ShiftConst.Afternoon && <span className="text-base font-black">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => handleApplyShiftOverride(ShiftConst.Night)}
                className="p-3 bg-indigo-700 hover:bg-indigo-800 border-2 border-indigo-900 text-white rounded-md text-left transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black w-8 text-center text-white">N</span>
                  <div>
                    <div className="font-black text-sm uppercase">Noche</div>
                    <div className="text-xs text-indigo-200 font-medium">00:00 - 08:00</div>
                  </div>
                </div>
                {editingCell.currentShift === ShiftConst.Night && <span className="text-base font-black">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => handleApplyShiftOverride(ShiftConst.Off)}
                className="p-3 bg-slate-200 hover:bg-slate-300 border-2 border-slate-300 text-slate-800 rounded-md text-left transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black w-8 text-center text-slate-600">L</span>
                  <div>
                    <div className="font-black text-sm uppercase">Libre</div>
                    <div className="text-xs text-slate-600 font-medium">Descanso</div>
                  </div>
                </div>
                {editingCell.currentShift === ShiftConst.Off && <span className="text-base font-black">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => handleApplyShiftOverride(ShiftConst.Vacation)}
                className="p-3 bg-emerald-100 hover:bg-emerald-200 border-2 border-emerald-300 text-emerald-950 rounded-md text-left transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black w-8 text-center text-emerald-900">V</span>
                  <div>
                    <div className="font-black text-sm uppercase">Vacaciones</div>
                    <div className="text-xs text-emerald-800 font-medium">Vacaciones</div>
                  </div>
                </div>
                {editingCell.currentShift === ShiftConst.Vacation && <span className="text-base font-black">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => handleApplyShiftOverride(ShiftConst.Paternity)}
                className="p-3 bg-rose-100 hover:bg-rose-200 border-2 border-rose-300 text-rose-950 rounded-md text-left transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black w-8 text-center text-rose-900">BP</span>
                  <div>
                    <div className="font-black text-sm uppercase">Baja Médica</div>
                    <div className="text-xs text-rose-800 font-medium">Incapacidad</div>
                  </div>
                </div>
                {editingCell.currentShift === ShiftConst.Paternity && <span className="text-base font-black">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => handleApplyShiftOverride(ShiftConst.Festive)}
                className="p-3 bg-orange-100 hover:bg-orange-200 border-2 border-orange-300 text-orange-950 rounded-md text-left transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black w-8 text-center text-orange-900">F</span>
                  <div>
                    <div className="font-black text-sm uppercase">Festivo</div>
                    <div className="text-xs text-orange-800 font-medium">Compensación</div>
                  </div>
                </div>
                {editingCell.currentShift === ShiftConst.Festive && <span className="text-base font-black">✓</span>}
              </button>
            </div>

            {/* AÑADIR HORARIO MANUAL PERSONALIZADO */}
            <div className="mt-2 pt-4 border-t border-zinc-200">
              <label className="block text-xs font-black uppercase text-zinc-800 tracking-wider mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="text-teal-600">✏️</span> Horario Manual / Turno Personalizado
                </span>
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-normal">Introduce horas libres</span>
              </label>
              <div className="flex gap-2 mb-2">
                <input 
                  type="text"
                  value={customManualShift}
                  onChange={(e) => setCustomManualShift(e.target.value)}
                  placeholder="Ej: 10-18, 09-17, 12-20, 07-15..."
                  className="flex-1 px-3 py-2 border-2 border-zinc-300 rounded-md text-sm font-black text-zinc-900 focus:outline-none focus:border-teal-600 uppercase"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customManualShift.trim()) {
                      handleApplyShiftOverride(customManualShift.trim() as Shift);
                    }
                  }}
                />
                <Button
                  type="button"
                  disabled={!customManualShift.trim()}
                  onClick={() => handleApplyShiftOverride(customManualShift.trim() as Shift)}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-black text-xs px-4 py-2 uppercase tracking-wider rounded-md"
                >
                  Asignar Horario
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-zinc-400 font-bold uppercase mr-1">Rápidos:</span>
                {['10-18', '09-17', '12-20', '07-15', '11-19', '14-22'].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setCustomManualShift(preset);
                      handleApplyShiftOverride(preset as Shift);
                    }}
                    className={`px-2 py-1 rounded text-xs font-black border transition ${
                      editingCell.currentShift === preset
                        ? 'bg-teal-600 text-white border-teal-700'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-200'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-zinc-200 pt-4 mt-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleApplyShiftOverride(null)}
                className="text-xs font-bold text-zinc-600 hover:text-zinc-900"
              >
                Restablecer a automático
              </Button>
              <Button
                type="button"
                onClick={() => setEditingCell(null)}
                className="bg-zinc-900 text-white text-sm font-bold px-6 py-2 rounded hover:bg-zinc-800"
              >
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* LEYENDA CLARA DE TURNOS CON LETRAS GRANDES */}
      <div className="mb-4 bg-white border border-zinc-200 p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-black uppercase tracking-wider text-zinc-400">Leyenda:</span>
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded bg-amber-100 border-2 border-amber-300 text-amber-950 font-black text-base flex items-center justify-center">M</span>
              <span className="text-xs font-bold text-zinc-700">Mañana (08-16)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded bg-sky-100 border-2 border-sky-300 text-sky-950 font-black text-base flex items-center justify-center">T</span>
              <span className="text-xs font-bold text-zinc-700">Tarde (16-00)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded bg-indigo-700 border-2 border-indigo-900 text-white font-black text-base flex items-center justify-center">N</span>
              <span className="text-xs font-bold text-zinc-700">Noche (00-08)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded bg-slate-200 border-2 border-slate-300 text-slate-700 font-black text-base flex items-center justify-center">L</span>
              <span className="text-xs font-bold text-zinc-700">Libre</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 h-8 rounded bg-teal-50 border-2 border-teal-400 text-teal-950 font-black text-xs flex items-center justify-center">10-18</span>
              <span className="text-xs font-bold text-zinc-700">Horario Manual</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 h-8 rounded bg-rose-100 border-2 border-rose-300 text-rose-950 font-black text-xs flex items-center justify-center">BP</span>
              <span className="text-xs font-bold text-zinc-700">Baja</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded bg-emerald-100 border-2 border-emerald-300 text-emerald-950 font-black text-base flex items-center justify-center">V</span>
              <span className="text-xs font-bold text-zinc-700">Vacaciones</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-10">
        <section>
          <div className="overflow-x-auto border-2 border-zinc-300 bg-white shadow-md">
            <Table className="border-collapse w-full">
              <TableHeader className="bg-zinc-100/90">
                <TableRow className="border-b-2 border-zinc-300 hover:bg-transparent">
                  <TableHead className="w-[230px] min-w-[210px] text-xs font-black uppercase tracking-wider text-zinc-700 py-6 px-4 border-r-2 border-zinc-300">
                    Empleado
                  </TableHead>
                  {DAYS_OF_WEEK.map(day => (
                    <TableHead key={day} className="text-center py-4 px-2 border-r-2 border-zinc-200">
                      <div className="text-xs md:text-sm font-black uppercase tracking-wider text-zinc-800">
                        {day}
                      </div>
                      <div className="mt-1 text-2xl md:text-3xl font-black text-zinc-950 tracking-tight">
                        {getDateForDay(startOfWeek, day).split('-')[2]}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="w-[100px] text-center text-xs font-black uppercase tracking-wider text-zinc-700 py-4 px-2">
                    Total L
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scheduleData.map((row) => {
                  const offCount = row.shifts.filter(s => s.shift === ShiftConst.Off).length;
                  const hasAbsence = row.shifts.some(s => [ShiftConst.Paternity, ShiftConst.Vacation].includes(s.shift as any));
                  const isExactTarget = hasAbsence ? true : offCount === 2;

                  return (
                    <TableRow key={row.employeeId} className="border-b-2 border-zinc-200 group hover:bg-zinc-50/70 transition-colors">
                      <TableCell className="border-r-2 border-zinc-300 bg-zinc-50/70 py-4 px-4">
                        <div className="flex flex-col">
                          <span className="text-base md:text-lg font-black uppercase tracking-tight text-zinc-950">
                            {row.employeeName}
                          </span>
                          <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide mt-0.5">
                            {row.role}
                          </span>
                        </div>
                      </TableCell>
                      {row.shifts.map((s, idx) => {
                        const isOverridden = Boolean(currentWeekOverrides[`${row.employeeId}-${s.day}`]);
                        
                        // Estilos de alto contraste, letras gigantes y colores muy vivos
                        const colorMap: Record<string, string> = {
                           'M': 'bg-amber-100 text-amber-950 border-2 border-amber-300 hover:bg-amber-200 shadow-xs',
                           'T': 'bg-sky-100 text-sky-950 border-2 border-sky-300 hover:bg-sky-200 shadow-xs',
                           'N': 'bg-indigo-700 text-white border-2 border-indigo-900 hover:bg-indigo-800 shadow-md font-black',
                           'L': 'bg-slate-100 text-slate-500 border-2 border-slate-200/90 hover:bg-slate-200',
                           'V': 'bg-emerald-100 text-emerald-950 border-2 border-emerald-300 hover:bg-emerald-200 shadow-xs',
                           'BP': 'bg-rose-100 text-rose-950 border-2 border-rose-300 hover:bg-rose-200 shadow-xs',
                           'P': 'bg-amber-200 text-amber-950 border-2 border-amber-400 hover:bg-amber-300 shadow-xs',
                           'F': 'bg-orange-100 text-orange-950 border-2 border-orange-300 hover:bg-orange-200 shadow-xs'
                        };
                        const technicalStyle = colorMap[s.shift] || "bg-teal-50 text-teal-950 border-2 border-teal-400 hover:bg-teal-100 shadow-xs";
                        
                        // Tamaño de letra adaptable para horarios manuales o estándar
                        const fontSizeClass = s.shift.length > 5
                          ? 'text-xs md:text-sm font-black px-1 text-center leading-tight'
                          : s.shift.length >= 3
                          ? 'text-sm md:text-base font-black px-1 text-center'
                          : s.shift === 'BP' 
                          ? 'text-xl md:text-2xl font-black'
                          : 'text-2xl md:text-3xl font-black';

                        return (
                          <TableCell 
                            key={idx} 
                            className="p-1 border-r-2 border-zinc-200 cursor-pointer relative select-none"
                            onClick={() => {
                              const isStandard = [ShiftConst.Morning, ShiftConst.Afternoon, ShiftConst.Night, ShiftConst.Off, ShiftConst.Vacation, ShiftConst.Paternity, ShiftConst.Festive].includes(s.shift as any);
                              setCustomManualShift(isStandard ? '' : s.shift);
                              setEditingCell({
                                employeeId: row.employeeId,
                                employeeName: row.employeeName,
                                day: s.day,
                                currentShift: s.shift
                              });
                            }}
                            title={`Clic para modificar turno o añadir horario manual para ${row.employeeName} el ${s.day}`}
                          >
                             <div className={`h-20 min-h-[76px] rounded-sm flex items-center justify-center transition-all ${fontSizeClass} ${technicalStyle}`}>
                                {s.shift}
                                {isOverridden && (
                                  <span className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white" title="Modificado manualmente"></span>
                                )}
                             </div>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center bg-zinc-50/70 border-l-2 border-zinc-300 p-2">
                        <span className={`inline-block px-3 py-1.5 rounded text-base md:text-lg font-black ${
                          isExactTarget 
                            ? 'text-zinc-800 bg-zinc-200 border border-zinc-300' 
                            : 'text-amber-800 bg-amber-100 border border-amber-300'
                        }`}>
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
        <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {DAYS_OF_WEEK.map(day => {
            const counts = scheduleData.reduce((acc, row) => {
              const shift = row.shifts.find(s => s.day === day)?.shift;
              if (shift === ShiftConst.Morning) acc.m++;
              if (shift === ShiftConst.Afternoon) acc.t++;
              if (shift === ShiftConst.Night) acc.n++;
              return acc;
            }, { m: 0, t: 0, n: 0 });

            const isWeekend = [DayOfWeek.Friday, DayOfWeek.Saturday, DayOfWeek.Sunday].includes(day);
            const targetM = isWeekend ? 4 : 3;
            const targetT = 2;

            const isMOk = counts.m <= targetM;
            const isTOk = counts.t <= targetT;
            const isNOk = counts.n === 1;

            return (
              <div key={day} className="bg-white border-2 border-zinc-300 p-4 transition-all shadow-sm rounded-sm">
                <div className="flex justify-between items-center mb-3">
                  <p className="text-xs md:text-sm font-black text-zinc-900 uppercase tracking-wider">{day}</p>
                  <span className={`w-3 h-3 rounded-full ${isMOk && isTOk && isNOk ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-rose-500 ring-2 ring-rose-200'}`} title={isMOk && isTOk && isNOk ? 'Cupos cumplidos' : 'Excede cupo máximo'}></span>
                </div>
                <div className="space-y-3">
                   <div className="flex justify-between items-baseline">
                      <span className="text-xs font-bold text-zinc-600 uppercase">M (Mañana)</span>
                      <span className={`text-2xl font-black ${!isMOk ? 'text-rose-600 font-black' : 'text-zinc-900'}`}>
                        {counts.m} <span className="text-xs font-bold text-zinc-400">/ máx {targetM}</span>
                      </span>
                   </div>
                   <div className="flex justify-between items-baseline">
                      <span className="text-xs font-bold text-zinc-600 uppercase">T (Tarde)</span>
                      <span className={`text-2xl font-black ${!isTOk ? 'text-rose-600 font-black' : 'text-zinc-900'}`}>
                        {counts.t} <span className="text-xs font-bold text-zinc-400">/ máx 2</span>
                      </span>
                   </div>
                   <div className="h-[2px] w-full bg-zinc-200"></div>
                   <div className="flex justify-between items-baseline">
                      <span className="text-xs font-bold text-zinc-600 uppercase">N (Noche)</span>
                      <span className={`text-2xl font-black ${!isNOk ? 'text-rose-600' : 'text-zinc-900'}`}>
                        {counts.n} <span className="text-xs font-bold text-zinc-400">/ 1</span>
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
              <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-400">Cupos Máximos</span>
              <span className="text-xs font-bold text-zinc-900 mt-1 italic">Máx 3M / 2T (L-J) — Máx 4M / 2T (V-D) + 1N</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-400">Libres por Empleado</span>
              <span className="text-xs font-bold text-zinc-900 mt-1 italic">2 Días Consecutivos (Rotación Semanal)</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-mono uppercase tracking-widest text-zinc-400">Edición</span>
              <span className="text-xs font-bold text-zinc-900 mt-1 italic">Haz clic en cualquier celda para asignar o crear horario manual</span>
            </div>
         </div>
         <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
           Sistema de Turnos Automatizado v3.0
         </p>
      </footer>
    </div>
  );
}
