import React, { useState, useEffect } from 'react';
import { Settings, Info, Bell, Shield, Database, CheckCircle2, Save, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { db } from '../lib/firebase-client.ts';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function ConfigManager() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const docSnap = await getDoc(doc(db, 'configuracion', 'reglasTurnos'));
        if (docSnap.exists()) {
          setConfig(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching config:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      await setDoc(doc(db, 'configuracion', 'reglasTurnos'), config);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving config:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand-primary" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando Configuración...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-text-main tracking-tight uppercase">Configuración</h2>
          <p className="text-text-muted font-medium">Parámetros del sistema y reglas globales.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
        >
          {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
          {success ? 'Guardado ✓' : 'Guardar Cambios'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card-bg rounded-2xl p-8 border border-border-main shadow-sm space-y-6">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 bg-slate-100 text-slate-900 rounded-xl flex items-center justify-center border border-border-main">
                <Shield size={18} />
             </div>
             <h3 className="text-lg font-extrabold text-text-main">Reglas de Capacidad</h3>
          </div>
          
          <div className="space-y-6">
             <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-border-main">
                <div>
                   <h4 className="text-xs font-black text-slate-900 uppercase">Control de Capacidad Estricto</h4>
                   <p className="text-[10px] font-bold text-slate-400">Si está encendido, el sistema forzará los límites definidos.</p>
                </div>
                <button 
                  onClick={() => setConfig({ ...config, strictCapacityControl: !config.strictCapacityControl })}
                  className="text-brand-primary transition-all p-1"
                >
                   {config?.strictCapacityControl ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-slate-300" />}
                </button>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-xl border-2 border-slate-100">
                   <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Lunes a Jueves</h4>
                   <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <span className="text-xs font-bold text-slate-600">Mañanas</span>
                         <input 
                           type="number" 
                           value={config?.capacidad?.["Lunes-Jueves"]?.manana || 3}
                           onChange={(e) => setConfig({
                             ...config,
                             capacidad: {
                               ...config.capacidad,
                               "Lunes-Jueves": { ...config.capacidad["Lunes-Jueves"], manana: parseInt(e.target.value) || 0 }
                             }
                           })}
                           className="w-12 text-center bg-slate-50 border-none font-black text-brand-primary"
                         />
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-xs font-bold text-slate-600">Tardes</span>
                         <input 
                           type="number" 
                           value={config?.capacidad?.["Lunes-Jueves"]?.tarde || 2}
                           onChange={(e) => setConfig({
                             ...config,
                             capacidad: {
                               ...config.capacidad,
                               "Lunes-Jueves": { ...config.capacidad["Lunes-Jueves"], tarde: parseInt(e.target.value) || 0 }
                             }
                           })}
                           className="w-12 text-center bg-slate-50 border-none font-black text-brand-primary"
                         />
                      </div>
                   </div>
                </div>

                <div className="p-4 bg-white rounded-xl border-2 border-slate-100">
                   <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-2">Viernes a Domingo</h4>
                   <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <span className="text-xs font-bold text-slate-600">Mañanas</span>
                         <input 
                           type="number" 
                           value={config?.capacidad?.["Viernes-Domingo"]?.manana || 4}
                           onChange={(e) => setConfig({
                             ...config,
                             capacidad: {
                               ...config.capacidad,
                               "Viernes-Domingo": { ...config.capacidad["Viernes-Domingo"], manana: parseInt(e.target.value) || 0 }
                             }
                           })}
                           className="w-12 text-center bg-slate-50 border-none font-black text-brand-primary"
                         />
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-xs font-bold text-slate-600">Tardes</span>
                         <input 
                           type="number" 
                           value={config?.capacidad?.["Viernes-Domingo"]?.tarde || 2}
                           onChange={(e) => setConfig({
                             ...config,
                             capacidad: {
                               ...config.capacidad,
                               "Viernes-Domingo": { ...config.capacidad["Viernes-Domingo"], tarde: parseInt(e.target.value) || 0 }
                             }
                           })}
                           className="w-12 text-center bg-slate-50 border-none font-black text-brand-primary"
                         />
                      </div>
                   </div>
                </div>
             </div>

             <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 text-purple-800">
                <h2 className="text-[10px] font-bold uppercase tracking-widest mb-1">Nota sobre Excepciones</h2>
                <p className="text-[10px] font-medium leading-relaxed">
                   Los empleados marcados como "Excepción de Capacidad" en su perfil de Personal no consumirán el cupo máximo de mañana o tarde cuando el control estricto esté activo.
                </p>
             </div>

             <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                   Listas de Prioridad (Firebase)
                </h3>
                <div className="grid grid-cols-1 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Orden Rotación Noches</label>
                      <input 
                        type="text" 
                        value={config?.listasPrioridad?.noches?.join(', ') || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          listasPrioridad: {
                            ...config.listasPrioridad,
                            noches: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '')
                          }
                        })}
                        placeholder="Nombre1, Nombre2..."
                        className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-bold text-brand-primary placeholder:text-slate-300"
                      />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Orden Rotación Finde</label>
                      <input 
                        type="text" 
                        value={config?.listasPrioridad?.findes?.join(', ') || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          listasPrioridad: {
                            ...config.listasPrioridad,
                            findes: e.target.value.split(',').map(s => s.trim()).filter(s => s !== '')
                          }
                        })}
                        placeholder="Nombre1, Nombre2..."
                        className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-bold text-brand-primary placeholder:text-slate-300"
                      />
                   </div>
                </div>
                <p className="text-[9px] font-bold text-slate-400">Separa los nombres con comas. El orden define quién tiene prioridad esta semana.</p>
             </div>
          </div>
        </div>

        <div className="space-y-6">
           <div className="bg-card-bg rounded-2xl p-8 border border-border-main shadow-sm">
             <div className="flex items-center gap-3 mb-6">
               <div className="w-10 h-10 bg-slate-100 text-slate-900 rounded-xl flex items-center justify-center border border-border-main">
                  <Database size={18} />
               </div>
               <h3 className="text-lg font-extrabold text-text-main">Base de Datos</h3>
             </div>
             <p className="text-xs font-medium text-text-muted mb-6 leading-relaxed">
               El sistema está conectado a Firebase Firestore. Todos los cambios realizados aquí se aplicarán a la próxima generación de cuadrantes.
             </p>
             <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-700">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-bold uppercase tracking-widest">En Línea y Conectado</span>
             </div>
           </div>

           <div className="bg-text-main rounded-2xl p-8 text-white shadow-lg overflow-hidden relative">
             <div className="flex items-center gap-3 mb-4">
               <Bell size={18} className="text-blue-400" />
               <h3 className="text-lg font-bold">Resumen de Generación</h3>
             </div>
             <p className="opacity-70 text-xs font-medium leading-relaxed">
                El motor determinista calcula los turnos respetando: <br/>
                1. Bajas y Vacaciones <br/>
                2. Patrones Semanales Fijos <br/>
                3. Noches de Conserje <br/>
                4. Rotaciones de Fin de Semana <br/>
                5. Reglas de Capacidad e Individuales
             </p>
             <Settings className="absolute -bottom-6 -right-6 text-white/5 w-32 h-32" />
           </div>
        </div>
      </div>
    </div>
  );
}
