import React, { useState, useEffect } from 'react';
import { X, Save, Moon, Sun, Coffee, Plus, Trash2 } from 'lucide-react';
import { Employee, Role, DayOfWeek, DAYS_ARRAY, ShiftCode, SpecialRule } from '../types.ts';
import { motion, AnimatePresence } from 'motion/react';

interface EmployeeFormProps {
  employee: Employee | null;
  onSave: (data: Omit<Employee, 'id'>) => Promise<void>;
  onClose: () => void;
}

export default function EmployeeForm({ employee, onSave, onClose }: EmployeeFormProps) {
  const [formData, setFormData] = useState<Omit<Employee, 'id'>>({
    name: '',
    role: Role.Recepcionista,
    postNightBehaviour: 'Off',
    isNightRotationMember: false,
    isWeekendRotationMember: false,
    fixedWeekendOff: false,
    specialRules: []
  });

  useEffect(() => {
    if (employee) {
      const { id, ...data } = employee;
      setFormData({
        ...data,
        specialRules: data.specialRules || []
      });
    }
  }, [employee]);

  const addRule = () => {
    const newRule: SpecialRule = {
      dia: 'Todos' as any,
      accion: 'SOLO',
      turno: ShiftCode.Morning
    };
    setFormData({
      ...formData,
      specialRules: [...(formData.specialRules || []), newRule]
    });
  };

  const removeRule = (index: number) => {
    const newRules = [...(formData.specialRules || [])];
    newRules.splice(index, 1);
    setFormData({ ...formData, specialRules: newRules });
  };

  const updateRule = (index: number, updates: Partial<SpecialRule>) => {
    const newRules = [...(formData.specialRules || [])];
    newRules[index] = { ...newRules[index], ...updates };
    setFormData({ ...formData, specialRules: newRules });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = {
      ...formData,
      name: formData.name.toUpperCase()
    };
    await onSave(dataToSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <h3 className="text-xl font-black text-slate-900">
            {employee ? 'Editar Empleado' : 'Nuevo Empleado'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-all">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nombre Completo</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-brand-primary focus:bg-white outline-none rounded-xl px-4 py-3 text-sm font-bold transition-all"
                  placeholder="Ej: Xisco Fernández"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Rol en Recepción</label>
                <select 
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-brand-primary focus:bg-white outline-none rounded-xl px-4 py-3 text-sm font-bold transition-all appearance-none"
                >
                  {[
                    Role.Jefe,
                    Role.Subjefe,
                    Role.Recepcionista,
                    Role.Ayudante,
                    Role.Conserje
                  ].map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Configuración Rápida</label>
                
                <div className="grid grid-cols-1 gap-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-transparent has-[:checked]:border-brand-primary has-[:checked]:bg-blue-50/50 cursor-pointer transition-all">
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={formData.isNightRotationMember}
                      onChange={(e) => setFormData({ ...formData, isNightRotationMember: e.target.checked })}
                    />
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${formData.isNightRotationMember ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                      <Moon size={16} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Rotación de Noche</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-transparent has-[:checked]:border-brand-primary has-[:checked]:bg-blue-50/50 cursor-pointer transition-all">
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={formData.isWeekendRotationMember}
                      onChange={(e) => setFormData({ ...formData, isWeekendRotationMember: e.target.checked })}
                    />
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${formData.isWeekendRotationMember ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                      <Sun size={16} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Rotación de Finde</span>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-transparent has-[:checked]:border-brand-primary has-[:checked]:bg-blue-50/50 cursor-pointer transition-all">
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={formData.fixedWeekendOff}
                      onChange={(e) => setFormData({ ...formData, fixedWeekendOff: e.target.checked })}
                    />
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${formData.fixedWeekendOff ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                      <Coffee size={16} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Finde Libre Fijo</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-brand-primary uppercase tracking-widest block">Reglas Especiales</label>
                <button 
                  type="button"
                  onClick={addRule}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-brand-primary rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 transition-all border border-blue-100"
                >
                  <Plus size={12} />
                  Añadir Regla
                </button>
              </div>

              <div className="space-y-3">
                {formData.specialRules?.length === 0 ? (
                  <div className="p-8 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sin reglas personalizadas</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {formData.specialRules?.map((rule, idx) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 relative"
                      >
                        <button 
                          onClick={() => removeRule(idx)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-red-100 text-red-500 rounded-full flex items-center justify-center shadow-sm hover:bg-red-50"
                        >
                          <Trash2 size={12} />
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 block">Día/Período</label>
                            <select 
                              value={rule.dia}
                              onChange={(e) => updateRule(idx, { dia: e.target.value as any })}
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold"
                            >
                              <option value="Todos">Lunes a Domingo</option>
                              <option value="Lunes a Sábado">Lunes a Sábado</option>
                              <option value="Lunes a Viernes">Lunes a Viernes</option>
                              <option value="Fin de semana">Fin de semana</option>
                              {DAYS_ARRAY.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 block">Acción</label>
                            <select 
                              value={rule.accion}
                              onChange={(e) => updateRule(idx, { accion: e.target.value as any })}
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold"
                            >
                              <option value="SOLO">Solo trabaja en...</option>
                              <option value="NUNCA">Nunca trabaja en...</option>
                              <option value="RESTRINGIR_HORAS">Restringir horas</option>
                              <option value="PREFERENCIA">Preferencia (Priorizar)</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 block">Turno</label>
                            <select 
                              value={rule.turno}
                              onChange={(e) => updateRule(idx, { turno: e.target.value as any })}
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-bold"
                            >
                              <option value={ShiftCode.Morning}>Mañana (M)</option>
                              <option value={ShiftCode.Afternoon}>Tarde (T)</option>
                              <option value={ShiftCode.Night}>Noche (N)</option>
                              <option value="DISPONIBLE">Libre / Según necesidad</option>
                            </select>
                          </div>
                          {rule.accion === 'RESTRINGIR_HORAS' && (
                            <div className="flex gap-1 items-end">
                              <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 block">Desde</label>
                                <input 
                                  type="text"
                                  value={rule.startTime || ''}
                                  onChange={(e) => updateRule(idx, { startTime: e.target.value })}
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold"
                                  placeholder="16:00"
                                />
                              </div>
                              <div className="pb-2 font-bold text-slate-300">-</div>
                              <div>
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1 block">Hasta</label>
                                <input 
                                  type="text"
                                  value={rule.endTime || ''}
                                  onChange={(e) => updateRule(idx, { endTime: e.target.value })}
                                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold"
                                  placeholder="21:00"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </div>
        </form>

        <div className="px-8 py-6 border-t border-slate-100 flex gap-3 flex-shrink-0">
           <button
             type="button"
             onClick={onClose}
             className="flex-1 px-6 py-4 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-all border border-slate-100"
           >
             Cancelar
           </button>
           <button
             onClick={(e) => handleSubmit(e as any)}
             className="flex-[2] px-6 py-4 rounded-2xl text-sm font-bold bg-slate-900 text-white hover:shadow-xl hover:shadow-slate-200 transition-all flex items-center justify-center gap-2"
           >
             <Save size={18} />
             Guardar Empleado
           </button>
        </div>
      </motion.div>
    </div>
  );
}
