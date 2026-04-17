import React, { useState } from 'react';
import { AppConfig } from '../types';
import { UserIcon, PlusIcon } from './Icons';

interface SetupFormProps {
  onSave: (config: AppConfig) => void;
  initialConfig?: AppConfig;
}

export default function SetupForm({ onSave, initialConfig }: SetupFormProps) {
  const [config, setConfig] = useState<AppConfig>(initialConfig || {
    jefe: '',
    subjefe: '',
    recepcionistas: ['', '', '', ''],
    ayudantes: ['', ''],
    conserje: '',
    isConfigured: false,
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

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configuración Inicial</h1>
        <p className="text-gray-500 italic">Asigna los nombres para cada rol. Esta configuración se guardará permanentemente.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b pb-2">Dirección</h3>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Jefe de Recepción</label>
              <input 
                type="text" 
                value={config.jefe}
                onChange={(e) => setConfig({ ...config, jefe: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                placeholder="Nombre completo"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">2º Jefe de Recepción</label>
              <input 
                type="text" 
                value={config.subjefe}
                onChange={(e) => setConfig({ ...config, subjefe: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                placeholder="Nombre completo"
                required
              />
            </div>
            <div className="pt-4">
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b pb-2">Noche</h3>
               <label className="block text-sm font-semibold text-gray-700 mb-1 mt-4">Conserje de Noche</label>
               <input 
                 type="text" 
                 value={config.conserje}
                 onChange={(e) => setConfig({ ...config, conserje: e.target.value })}
                 className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                 placeholder="Nombre completo"
                 required
               />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b pb-2">Staff</h3>
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">Recepcionistas (4)</label>
              {config.recepcionistas.map((name, i) => (
                <input 
                  key={`rec-${i}`}
                  type="text" 
                  value={name}
                  onChange={(e) => updateRecepcionista(i, e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder={`Recepcionista ${i+1}`}
                  required
                />
              ))}
            </div>
            <div className="space-y-3 pt-2">
              <label className="block text-sm font-semibold text-gray-700">Ayudantes (2)</label>
              {config.ayudantes.map((name, i) => (
                <input 
                  key={`ayu-${i}`}
                  type="text" 
                  value={name}
                  onChange={(e) => updateAyudante(i, e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                  placeholder={`Ayudante ${i+1}`}
                  required
                />
              ))}
            </div>
          </div>
        </div>

        <button 
          type="submit"
          className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition transform active:scale-[0.98] shadow-lg flex items-center justify-center space-x-2"
        >
          <PlusIcon />
          <span>Guardar Configuración y Generar Turnos</span>
        </button>
      </form>
    </div>
  );
}
