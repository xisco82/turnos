import React, { useState } from 'react';
import { AppConfig, DayOfWeek } from '../types';
import { PlusIcon, UserIcon, TrashIcon } from './Icons';
import { DAYS_OF_WEEK, DEFAULT_CONFIG } from '../constants';
import { getPostNightSequenceDays } from '../scheduleService';

interface SetupFormProps {
  onSave: (config: AppConfig) => void;
  initialConfig?: AppConfig;
}

export default function SetupForm({ onSave, initialConfig }: SetupFormProps) {
  const [config, setConfig] = useState<AppConfig>(() => {
    if (initialConfig) {
      const mergedFixedOff = {
        jefe: [DayOfWeek.Friday, DayOfWeek.Saturday],
        subjefe: [DayOfWeek.Sunday, DayOfWeek.Monday],
        ...(DEFAULT_CONFIG.fixedOffDays || {}),
        ...(initialConfig.fixedOffDays || {})
      };
      const mergedFixedShifts = {
        ...(DEFAULT_CONFIG.fixedShifts || {}),
        ...(initialConfig.fixedShifts || {})
      };
      return {
        ...DEFAULT_CONFIG,
        ...initialConfig,
        recepcionistas: initialConfig.recepcionistas || DEFAULT_CONFIG.recepcionistas,
        ayudantes: (initialConfig.ayudantes || DEFAULT_CONFIG.ayudantes).filter(name => name.trim().toUpperCase() !== 'LORENA'),
        extraEmployees: initialConfig.extraEmployees || [],
        fixedOffDays: mergedFixedOff,
        fixedShifts: mergedFixedShifts,
        postNightBehaviour: initialConfig.postNightBehaviour || DEFAULT_CONFIG.postNightBehaviour || 'Afternoon',
        employeePostNightPreferences: initialConfig.employeePostNightPreferences || {},
        requests: initialConfig.requests || []
      };
    }
    return DEFAULT_CONFIG;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...config, isConfigured: true });
  };

  const updateRecepcionista = (index: number, name: string) => {
    const newRecs = [...config.recepcionistas];
    newRecs[index] = name;
    setConfig({ ...config, recepcionistas: newRecs });
  };

  const updateAyudante = (index: number, name: string) => {
    const newAyudantes = [...config.ayudantes];
    newAyudantes[index] = name;
    setConfig({ ...config, ayudantes: newAyudantes });
  };

  const setEmployeePostNight = (empId: string, pref: 'Afternoon' | 'Off') => {
    setConfig({
      ...config,
      employeePostNightPreferences: {
        ...(config.employeePostNightPreferences || {}),
        [empId]: pref
      }
    });
  };

  const addExtraEmployee = () => {
    setConfig({
      ...config,
      extraEmployees: [...config.extraEmployees, { id: `extra-${Date.now()}`, name: '', role: 'Extra' }]
    });
  };

  const updateExtraEmployee = (id: string, field: 'name' | 'role', value: string) => {
    setConfig({
      ...config,
      extraEmployees: config.extraEmployees.map(e => e.id === id ? { ...e, [field]: value } : e)
    });
  };

  const removeExtraEmployee = (id: string) => {
    setConfig({
      ...config,
      extraEmployees: config.extraEmployees.filter(e => e.id !== id)
    });
  };

  const conserjeOffDays = config.fixedOffDays?.['conserje'] || [];
  const postNightDays = getPostNightSequenceDays(conserjeOffDays);
  const day1Name = postNightDays[0];
  const day2Name = postNightDays[1];
  const day3Name = postNightDays[2];

  const afternoonDesc = day1Name && day2Name && day3Name
    ? `${day1Name} entra de Tarde (16:00 - 00:00) y libra ${day2Name} y ${day3Name}.`
    : 'Entra de Tarde tras el turno de noche y tiene 2 días libres consecutivos.';

  const offDesc = day1Name && day2Name
    ? `${day1Name} y ${day2Name} libres directos tras salir del turno de noche.`
    : '2 días libres consecutivos directos tras salir del turno de noche.';

  const toggleFixedOffDay = (empId: string, day: DayOfWeek) => {
    const currentDays = config.fixedOffDays[empId] || [];
    let newDays: DayOfWeek[];
    
    if (currentDays.includes(day)) {
      newDays = currentDays.filter(d => d !== day);
    } else {
      if (currentDays.length >= 2) {
        newDays = [currentDays[1], day];
      } else {
        newDays = [...currentDays, day];
      }
    }

    // Sincronizar también con fixedShifts si tenía o no turno
    const currentShifts = { ...(config.fixedShifts?.[empId] || {}) };
    if (!currentDays.includes(day)) {
      currentShifts[day] = 'L';
    } else if (currentShifts[day] === 'L') {
      delete currentShifts[day];
    }

    setConfig({
      ...config,
      fixedOffDays: {
        ...config.fixedOffDays,
        [empId]: newDays
      },
      fixedShifts: {
        ...(config.fixedShifts || {}),
        [empId]: currentShifts
      }
    });
  };

  const setEmployeeFixedShift = (empId: string, day: DayOfWeek, shift: string) => {
    const currentEmpShifts = { ...(config.fixedShifts?.[empId] || {}) };
    let updatedFixedOff = { ...(config.fixedOffDays || {}) };
    const empOffDays = updatedFixedOff[empId] || [];

    if (!shift) {
      delete currentEmpShifts[day];
    } else {
      currentEmpShifts[day] = shift;
      if (shift === 'L') {
        if (!empOffDays.includes(day)) {
          updatedFixedOff[empId] = empOffDays.length >= 2 ? [empOffDays[1], day] : [...empOffDays, day];
        }
      } else {
        if (empOffDays.includes(day)) {
          updatedFixedOff[empId] = empOffDays.filter(d => d !== day);
        }
      }
    }

    setConfig({
      ...config,
      fixedOffDays: updatedFixedOff,
      fixedShifts: {
        ...(config.fixedShifts || {}),
        [empId]: currentEmpShifts
      }
    });
  };

  const clearEmployeeFixedShifts = (empId: string) => {
    const nextFixedShifts = { ...(config.fixedShifts || {}) };
    delete nextFixedShifts[empId];
    setConfig({
      ...config,
      fixedShifts: nextFixedShifts
    });
  };

  const renderFixedOffSelector = (id: string, label: string) => {
    const selected = config.fixedOffDays[id] || [];
    return (
      <div className="mt-2.5">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-tight">
            Días Libres Fijos (L)
          </label>
          <span className="text-[9px] text-blue-600 font-bold">
            {selected.length > 0 ? selected.map(d => d.substring(0, 3)).join(', ') : 'Ninguno fijo'}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {DAYS_OF_WEEK.map(day => {
            const isSelected = selected.includes(day);
            return (
              <button
                key={`${id}-${day}`}
                type="button"
                onClick={() => toggleFixedOffDay(id, day)}
                className={`text-[10px] px-2 py-0.5 rounded-md border font-black transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs' 
                    : 'bg-white border-gray-200 text-gray-500 hover:border-blue-300'
                }`}
              >
                {day.substring(0, 2)}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderFixedShiftsSelector = (id: string, label: string) => {
    const empShifts = config.fixedShifts?.[id] || {};
    const hasAny = Object.keys(empShifts).length > 0;

    return (
      <div className="mt-3 pt-2.5 border-t border-gray-200/70">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-[10px] font-black uppercase text-zinc-700 tracking-tight flex items-center gap-1">
            <span>⚡</span> Turnos Fijos en Días Concretos:
          </label>
          {hasAny && (
            <button
              type="button"
              onClick={() => clearEmployeeFixedShifts(id)}
              className="text-[9px] text-rose-600 hover:text-rose-800 font-bold transition cursor-pointer"
              title="Restablecer turnos fijos a automático"
            >
              Borrar fijos
            </button>
          )}
        </div>
        <p className="text-[10px] text-zinc-500 mb-2 leading-tight">
          Asigna un turno específico (M, T, N, L) para un día concreto, o déjalo en Auto:
        </p>

        <div className="grid grid-cols-7 gap-1 bg-white/80 p-1.5 rounded-xl border border-gray-200">
          {DAYS_OF_WEEK.map(day => {
            const currentShift = empShifts[day] || '';
            const dayShort = day.substring(0, 2).toUpperCase();

            return (
              <div key={`${id}-shift-${day}`} className="flex flex-col items-center">
                <span className="text-[9px] font-black text-zinc-500 uppercase mb-1">
                  {dayShort}
                </span>
                <select
                  value={currentShift}
                  onChange={(e) => setEmployeeFixedShift(id, day, e.target.value)}
                  className={`w-full text-center text-[11px] font-black py-1 px-0.5 rounded-md border transition cursor-pointer ${
                    currentShift === 'M'
                      ? 'bg-amber-100 text-amber-950 border-amber-400 ring-1 ring-amber-300'
                      : currentShift === 'T'
                      ? 'bg-sky-100 text-sky-950 border-sky-400 ring-1 ring-sky-300'
                      : currentShift === 'N'
                      ? 'bg-indigo-700 text-white border-indigo-900'
                      : currentShift === 'L'
                      ? 'bg-zinc-200 text-zinc-800 border-zinc-400'
                      : 'bg-white text-zinc-400 border-zinc-200 hover:border-zinc-400'
                  }`}
                  title={`${day}: ${currentShift ? `Turno fijo: ${currentShift}` : 'Automático'}`}
                >
                  <option value="">Auto</option>
                  <option value="M">M</option>
                  <option value="T">T</option>
                  <option value="N">N</option>
                  <option value="L">L</option>
                </select>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPostNightSelector = (id: string, empName: string) => {
    const effectivePref: 'Afternoon' | 'Off' = config.employeePostNightPreferences?.[id] || config.postNightBehaviour || 'Afternoon';
    const isAfternoonActive = effectivePref === 'Afternoon';

    return (
      <div className="mt-2.5 pt-2 border-t border-gray-200/70">
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span className="text-[10px] font-black uppercase tracking-tight text-zinc-700 flex items-center gap-1">
            <span>🌙</span> Tras 2 Noches (N):
          </span>
          <button
            type="button"
            onClick={() => setEmployeePostNight(id, isAfternoonActive ? 'Off' : 'Afternoon')}
            className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider transition-all cursor-pointer ${
              isAfternoonActive
                ? 'bg-sky-100 text-sky-900 border border-sky-300 hover:bg-sky-200'
                : 'bg-indigo-100 text-indigo-950 border border-indigo-300 hover:bg-indigo-200'
            }`}
            title="Haz clic para activar o desactivar turno de tarde tras noche"
          >
            {isAfternoonActive ? '✓ Turno Tarde Activo' : '✓ 2 Libres Activo'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setEmployeePostNight(id, 'Afternoon')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isAfternoonActive
                ? 'bg-sky-500 border-2 border-sky-600 text-white shadow-xs ring-2 ring-sky-200'
                : 'bg-white border-2 border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300'
            }`}
          >
            <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-black ${
              isAfternoonActive ? 'bg-white text-sky-800' : 'bg-sky-100 text-sky-900'
            }`}>
              T
            </span>
            <span>Turno Tarde</span>
            {isAfternoonActive && <span className="font-black text-xs">✓</span>}
          </button>

          <button
            type="button"
            onClick={() => setEmployeePostNight(id, 'Off')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              !isAfternoonActive
                ? 'bg-indigo-700 border-2 border-indigo-800 text-white shadow-xs ring-2 ring-indigo-200'
                : 'bg-white border-2 border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300'
            }`}
          >
            <span className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-black ${
              !isAfternoonActive ? 'bg-white text-indigo-800' : 'bg-indigo-100 text-indigo-900'
            }`}>
              L
            </span>
            <span>2 Libres</span>
            {!isAfternoonActive && <span className="font-black text-xs">✓</span>}
          </button>
        </div>
        <p className="text-[9px] text-zinc-500 mt-1 italic leading-tight">
          {isAfternoonActive
            ? `${day1Name || 'Día 1'} entra de Tarde (16:00-00:00) y libra ${day2Name || 'Día 2'} y ${day3Name || 'Día 3'}.`
            : `${day1Name || 'Día 1'} y ${day2Name || 'Día 2'} libres directos tras salir de noche.`}
        </p>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-black text-gray-900 mb-2 tracking-tight">Configuración del Equipo</h1>
        <p className="text-gray-500 font-medium italic">Asigna nombres y define si alguien tiene días libres fijos específicos.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-6">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100 pb-2">Empleados</h3>
            
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/80 space-y-2">
              <label className="block text-sm font-black text-gray-800 uppercase tracking-tight">Jefe de Recepción</label>
              <input 
                type="text" 
                value={config.jefe}
                onChange={(e) => setConfig({ ...config, jefe: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition font-medium bg-white"
                placeholder="Nombre del Jefe"
                required
              />
              {renderFixedOffSelector('jefe', 'Jefe')}
              {renderFixedShiftsSelector('jefe', 'Jefe')}
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200/80 space-y-2">
              <label className="block text-sm font-black text-gray-800 uppercase tracking-tight">2º Jefe de Recepción</label>
              <input 
                type="text" 
                value={config.subjefe}
                onChange={(e) => setConfig({ ...config, subjefe: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition font-medium bg-white"
                placeholder="Nombre del 2º Jefe"
                required
              />
              {renderFixedOffSelector('subjefe', '2º Jefe')}
              {renderFixedShiftsSelector('subjefe', '2º Jefe')}
            </div>

            {/* CONSERJE DE NOCHE Y COBERTURA DINÁMICA */}
            <div className="bg-gradient-to-br from-amber-50/80 to-indigo-50/60 p-5 rounded-2xl border-2 border-amber-300 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-black text-zinc-900 uppercase tracking-tight flex items-center gap-2">
                  <span>🌙</span> Conserje de Noche & Cobertura Automática
                </label>
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200/80 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">
                  Detección Dinámica
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1.5">Nombre del Conserje</label>
                <input 
                  type="text" 
                  value={config.conserje}
                  onChange={(e) => setConfig({ ...config, conserje: e.target.value })}
                  className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition font-medium"
                  placeholder="Nombre del Conserje"
                  required
                />
              </div>

              {/* Selector de Días Libres del Conserje */}
              <div className="pt-2 border-t border-amber-200/60">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-black uppercase tracking-tight text-zinc-800">
                    Días libres del conserje de noche:
                  </label>
                  <span className="text-[11px] text-zinc-500 font-semibold">
                    (Haz clic para marcar o desmarcar)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
                  {DAYS_OF_WEEK.map(day => {
                    const isSelected = conserjeOffDays.includes(day);
                    return (
                      <button
                        key={`conserje-day-${day}`}
                        type="button"
                        onClick={() => toggleFixedOffDay('conserje', day)}
                        className={`p-2 rounded-xl border-2 font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 border-amber-600 text-white shadow-sm ring-2 ring-amber-200'
                            : 'bg-white border-zinc-200 text-zinc-700 hover:border-amber-300 hover:bg-amber-50/50'
                        }`}
                      >
                        <span className="text-sm">{isSelected ? '☑' : '☐'}</span>
                        <span className="mt-0.5 text-[11px] uppercase tracking-tight">{day}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DÍAS A CUBRIR = DÍAS LIBRES DEL CONSERJE (DETECCIÓN AUTOMÁTICA) */}
              <div className="bg-white p-4 rounded-xl border-2 border-indigo-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse"></span>
                    <span className="text-xs font-black uppercase text-indigo-950 tracking-wider">
                      Días que necesitan cobertura:
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    Regla principal: Días a cubrir = días libres seleccionados del conserje de noche.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {conserjeOffDays.length > 0 ? (
                    conserjeOffDays.map(day => (
                      <span
                        key={`badge-cobertura-${day}`}
                        className="px-3 py-1 bg-indigo-700 text-white text-xs font-black rounded-lg shadow-xs flex items-center gap-1.5"
                      >
                        <span>🌙</span> {day}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs italic text-amber-800 font-semibold px-2.5 py-1 bg-amber-50 rounded-lg border border-amber-200">
                      Sin días libres (cubre toda la semana)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* REGLA GENERAL TRAS TRABAJAR DE NOCHE */}
            <div className="bg-indigo-50/80 p-5 rounded-2xl border-2 border-indigo-200">
              <label className="block text-sm font-black text-indigo-950 uppercase tracking-tight mb-1">
                🌙 Regla General al terminar turnos de noche
              </label>
              <p className="text-xs text-indigo-800 font-medium mb-4">
                Comportamiento por defecto. Abajo en cada empleado puedes activar o desactivar individualmente el Turno de Tarde (T) o 2 Libres:
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, postNightBehaviour: 'Afternoon' })}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    config.postNightBehaviour === 'Afternoon'
                      ? 'bg-white border-sky-500 shadow-md ring-2 ring-sky-300'
                      : 'bg-white/70 border-zinc-200 text-zinc-600 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-7 h-7 rounded bg-sky-100 text-sky-900 font-black text-sm flex items-center justify-center">T</span>
                    <span className="font-bold text-xs uppercase text-zinc-900">Turno de Tarde</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-snug">
                    {afternoonDesc}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setConfig({ ...config, postNightBehaviour: 'Off' })}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    config.postNightBehaviour === 'Off'
                      ? 'bg-white border-indigo-600 shadow-md ring-2 ring-indigo-300'
                      : 'bg-white/70 border-zinc-200 text-zinc-600 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-7 h-7 rounded bg-indigo-700 text-white font-black text-sm flex items-center justify-center">L</span>
                    <span className="font-bold text-xs uppercase text-zinc-900">2 Libres Consecutivos</span>
                  </div>
                  <p className="text-[11px] text-zinc-600 leading-snug">
                    {offDesc}
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* STAFF */}
          <div className="space-y-6">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100 pb-2">Empleados</h3>
            
            <div className="space-y-4">
              <label className="block text-sm font-bold text-gray-700">Recepcionistas ({config.recepcionistas.length})</label>
              {config.recepcionistas.map((name, i) => {
                const recId = `rec-${i}`;
                const specificPref = config.employeePostNightPreferences?.[recId];

                return (
                  <div key={`rec-container-${i}`} className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => updateRecepcionista(i, e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-medium"
                      placeholder={`Nombre Recepcionista ${i+1}`}
                      required
                    />
                    {renderFixedOffSelector(recId, name)}
                    {renderFixedShiftsSelector(recId, name)}
                    {renderPostNightSelector(recId, name)}
                  </div>
                );
              })}
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-100">
              <label className="block text-sm font-bold text-gray-700">Ayudantes ({config.ayudantes.length})</label>
              {config.ayudantes.map((name, i) => (
                <div key={`ayu-container-${i}`} className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => updateAyudante(i, e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-medium"
                    placeholder={`Nombre Ayudante ${i+1}`}
                    required
                  />
                  {renderFixedOffSelector(`ayu-${i}`, name)}
                  {renderFixedShiftsSelector(`ayu-${i}`, name)}
                  {renderPostNightSelector(`ayu-${i}`, name)}
                </div>
              ))}
            </div>

            {/* EXTRA CATEGORIES */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-bold text-gray-700">Otras Categorías / Extras</label>
                <button 
                  type="button" 
                  onClick={addExtraEmployee}
                  className="text-[10px] font-black text-blue-600 hover:text-blue-800 transition"
                >
                  + AÑADIR
                </button>
              </div>
              {config.extraEmployees.map((extra) => (
                <div key={extra.id} className="p-3 bg-blue-50/30 rounded-2xl border border-blue-100 relative group">
                  <button 
                    type="button" 
                    onClick={() => removeExtraEmployee(extra.id)}
                    className="absolute -top-1 -right-1 bg-white p-1 rounded-full border border-gray-200 text-gray-400 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition"
                  >
                    <TrashIcon />
                  </button>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input 
                      type="text" 
                      value={extra.role}
                      onChange={(e) => updateExtraEmployee(extra.id, 'role', e.target.value)}
                      className="px-2 py-1 border border-gray-200 rounded-lg text-[10px] font-bold uppercase tracking-widest text-blue-400 outline-none focus:ring-1 focus:ring-blue-400 transition"
                      placeholder="Rol (ej: Valet)"
                      required
                    />
                    <input 
                      type="text" 
                      value={extra.name}
                      onChange={(e) => updateExtraEmployee(extra.id, 'name', e.target.value)}
                      className="px-2 py-1 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 outline-none focus:ring-1 focus:ring-blue-400 transition"
                      placeholder="Nombre"
                      required
                    />
                  </div>
                  {renderFixedOffSelector(extra.id, extra.name)}
                </div>
              ))}
            </div>
          </div>
        </div>

        <button 
          type="submit"
          className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-lg hover:bg-blue-700 transition transform active:scale-[0.98] shadow-2xl flex items-center justify-center space-x-3"
        >
          <PlusIcon />
          <span>GUARDAR Y GENERAR CUADRANTE</span>
        </button>
      </form>
    </div>
  );
}
