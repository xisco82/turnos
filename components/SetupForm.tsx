import React, { useState } from 'react';
import { AppConfig, DayOfWeek } from '../types';
import { PlusIcon, UserIcon, TrashIcon } from './Icons';
import { DAYS_OF_WEEK, DEFAULT_CONFIG } from '../constants';

interface SetupFormProps {
  onSave: (config: AppConfig) => void;
  initialConfig?: AppConfig;
}

export default function SetupForm({ onSave, initialConfig }: SetupFormProps) {
  const [config, setConfig] = useState<AppConfig>(() => {
    if (initialConfig) {
      return {
        ...DEFAULT_CONFIG,
        ...initialConfig,
        recepcionistas: initialConfig.recepcionistas || DEFAULT_CONFIG.recepcionistas,
        ayudantes: initialConfig.ayudantes || DEFAULT_CONFIG.ayudantes,
        extraEmployees: initialConfig.extraEmployees || [],
        fixedOffDays: initialConfig.fixedOffDays || {},
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

  const toggleFixedOffDay = (empId: string, day: DayOfWeek) => {
    const currentDays = config.fixedOffDays[empId] || [];
    let newDays: DayOfWeek[];
    
    if (currentDays.includes(day)) {
      newDays = currentDays.filter(d => d !== day);
    } else {
      if (currentDays.length >= 2) return; // Max 2 days
      newDays = [...currentDays, day];
    }

    setConfig({
      ...config,
      fixedOffDays: {
        ...config.fixedOffDays,
        [empId]: newDays
      }
    });
  };

  const renderFixedOffSelector = (id: string, label: string) => {
    const selected = config.fixedOffDays[id] || [];
    return (
      <div className="mt-2">
        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Días Libres Fijos (Máx 2)</label>
        <div className="flex flex-wrap gap-1">
          {DAYS_OF_WEEK.map(day => {
            const isSelected = selected.includes(day);
            return (
              <button
                key={`${id}-${day}`}
                type="button"
                onClick={() => toggleFixedOffDay(id, day)}
                className={`text-[9px] px-1.5 py-0.5 rounded-md border font-bold transition-all ${
                  isSelected 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'bg-white border-gray-200 text-gray-400 hover:border-blue-300'
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
            
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <label className="block text-sm font-bold text-gray-700 mb-2">Jefe de Recepción</label>
              <input 
                type="text" 
                value={config.jefe}
                onChange={(e) => setConfig({ ...config, jefe: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition font-medium"
                placeholder="Nombre del Jefe"
                required
              />
              <p className="text-[10px] text-gray-400 mt-2 italic font-medium">* Libre fijo: Viernes y Sábado</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <label className="block text-sm font-bold text-gray-700 mb-2">2º Jefe de Recepción</label>
              <input 
                type="text" 
                value={config.subjefe}
                onChange={(e) => setConfig({ ...config, subjefe: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition font-medium"
                placeholder="Nombre del Subjefe"
                required
              />
              <p className="text-[10px] text-gray-400 mt-2 italic font-medium">* Libre fijo: Domingo y Lunes</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <label className="block text-sm font-bold text-gray-700 mb-2">Conserje de Noche</label>
              <input 
                type="text" 
                value={config.conserje}
                onChange={(e) => setConfig({ ...config, conserje: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition font-medium"
                placeholder="Nombre del Conserje"
                required
              />
              {renderFixedOffSelector('conserje', 'Conserje')}
            </div>
          </div>

          {/* STAFF */}
          <div className="space-y-6">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100 pb-2">Empleados</h3>
            
            <div className="space-y-4">
              <label className="block text-sm font-bold text-gray-700">Recepcionistas ({config.recepcionistas.length})</label>
              {config.recepcionistas.map((name, i) => (
                <div key={`rec-container-${i}`} className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => updateRecepcionista(i, e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-sm font-medium"
                    placeholder={`Nombre Recepcionista ${i+1}`}
                    required
                  />
                  {renderFixedOffSelector(`rec-${i}`, name)}
                </div>
              ))}
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
