import React from 'react';
import { Settings, Info, Bell, Shield, Database, CheckCircle2 } from 'lucide-react';

export default function ConfigManager() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-text-main tracking-tight">Configuración</h2>
          <p className="text-text-muted font-medium">Parámetros del sistema y reglas globales.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card-bg rounded-2xl p-8 border border-border-main shadow-sm space-y-6">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-10 h-10 bg-slate-100 text-slate-900 rounded-xl flex items-center justify-center border border-border-main">
                <Shield size={18} />
             </div>
             <h3 className="text-lg font-extrabold text-text-main">Reglas Deterministas</h3>
          </div>
          
          <div className="space-y-4">
             <div className="p-4 bg-slate-50 rounded-xl border border-border-main">
                <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Mínimos de Personal</h4>
                <p className="text-sm font-bold text-text-main">Lunes a Jueves: 3 M / 2 T</p>
                <p className="text-sm font-bold text-text-main">Viernes a Domingo: 4 M / 2 T</p>
             </div>

             <div className="p-4 bg-slate-50 rounded-xl border border-border-main">
                <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Restricciones de Tarde</h4>
                <p className="text-xs font-bold text-text-muted leading-relaxed">
                   • Mínimo 1 Recepcionista presente.<br />
                   • Nunca dos Ayudantes solos.<br />
                   • Máximo 2 personas en Tarde.
                </p>
             </div>

             <div className="p-4 bg-slate-50 rounded-xl border border-border-main">
                <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Jefatura - Libres Fijos</h4>
                <p className="text-sm font-bold text-text-main">Jefe: Viernes y Sábado</p>
                <p className="text-sm font-bold text-text-main">2ª Jefa: Domingo y Lunes</p>
             </div>

             <div className="p-4 bg-slate-50 rounded-xl border border-border-main">
                <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">Carga de Trabajo Semanal</h4>
                <p className="text-sm font-bold text-text-main">Meta: 5 días trabajados / 2 días libres</p>
                <p className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
                   <CheckCircle2 size={12} /> Días libres siempre consecutivos
                </p>
                <p className="text-xs font-bold text-text-muted mt-1 leading-relaxed">
                   El sistema asignará "Refuerzos" automáticamente para que todos cumplan su cuota de 5 días.
                </p>
             </div>

             <div className="p-4 bg-slate-50 rounded-xl border border-border-main text-blue-800 bg-blue-50 border-blue-100">
                <h2 className="text-[10px] font-bold uppercase tracking-widest mb-1">Sustitución Concierge</h2>
                <p className="text-sm font-bold">Lunes y Martes: 1 Recepcionista (Rotativo)</p>
                <p className="text-[10px] opacity-70 mt-1">Sustituye a Oscar durante sus descansos.</p>
             </div>

             <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 text-purple-800">
                <h2 className="text-[10px] font-bold uppercase tracking-widest mb-1">Reglas Especiales por Persona</h2>
                <div className="space-y-2 mt-2">
                   <div className="text-[11px] font-bold">
                      <span className="text-purple-900">• Lorena:</span> Viernes de 16:00 a 20:00. Fines de semana según necesidad.
                   </div>
                   <div className="text-[11px] font-bold">
                      <span className="text-purple-900">• Inés:</span> Solo tardes de Lunes a Viernes.
                   </div>
                </div>
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
               El sistema está conectado a Firebase Firestore en la región <span className="text-text-main font-bold">europe-west3</span>. Todos los cambios se sincronizan en tiempo real.
             </p>
             <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-700">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-bold uppercase tracking-widest">En Línea</span>
             </div>
           </div>

           <div className="bg-text-main rounded-2xl p-8 text-white shadow-lg">
             <div className="flex items-center gap-3 mb-4">
               <Bell size={18} className="text-blue-400" />
               <h3 className="text-lg font-bold">Ayuda</h3>
             </div>
             <p className="opacity-70 text-xs font-medium leading-relaxed">
               Los cambios en la lógica determinista requieren actualización en el servicio de generación backend.
             </p>
           </div>
        </div>
      </div>
    </div>
  );
}
