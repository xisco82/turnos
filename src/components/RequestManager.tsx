import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Plane as Vacation, 
  Stethoscope as Sick, 
  Star as Holiday, 
  Calendar as Manual, 
  Trash,
  Info,
  Edit2,
  X,
  Save
} from 'lucide-react';
import { Employee, ScheduleRequest } from '../types.ts';
import { db } from '../lib/firebase-client.ts';
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface RequestManagerProps {
  employees: Employee[];
  requests: ScheduleRequest[];
}

export default function RequestManager({ employees, requests }: RequestManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<ScheduleRequest, 'id'>>({
    employeeId: '',
    startDate: '',
    endDate: '',
    type: 'Vacación',
    reason: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.startDate || !formData.endDate) return;
    
    if (editingId) {
      await updateDoc(doc(db, 'requests', editingId), formData);
      setEditingId(null);
    } else {
      await addDoc(collection(db, 'requests'), formData);
    }
    
    setFormData({ employeeId: '', startDate: '', endDate: '', type: 'Vacación', reason: '' });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Eliminar esta petición?')) {
      await deleteDoc(doc(db, 'requests', id));
    }
  };

  const startEdit = (req: ScheduleRequest) => {
    setEditingId(req.id);
    setFormData({
      employeeId: req.employeeId,
      startDate: req.startDate,
      endDate: req.endDate,
      type: req.type,
      reason: req.reason || ''
    });
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ employeeId: '', startDate: '', endDate: '', type: 'Vacación', reason: '' });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'Vacación': return <Vacation size={16} className="text-emerald-500" />;
      case 'Baja': return <Sick size={16} className="text-red-500" />;
      case 'Festivo': return <Holiday size={16} className="text-amber-500" />;
      default: return <Manual size={16} className="text-slate-500" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1">
        <div className={`bg-card-bg rounded-2xl p-8 border shadow-sm sticky top-24 transition-all ${editingId ? 'border-brand-primary border-2 ring-4 ring-blue-50' : 'border-border-main'}`}>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-extrabold text-text-main">
              {editingId ? 'Editar Petición' : 'Añadir Petición'}
            </h2>
            {editingId && (
              <button 
                onClick={cancelEdit}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <p className="text-text-muted text-[13px] font-medium mb-8">
            {editingId ? 'Modificando una petición existente.' : 'Bloquea fechas para vacaciones o ausencias.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest block mb-1">Empleado</label>
              <select 
                required
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                className="w-full bg-slate-50 border border-border-main focus:border-brand-primary outline-none rounded-lg px-4 py-2 text-[13px] font-bold transition-all"
              >
                <option value="">Seleccionar empleado...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tipo de Ausencia</label>
              <div className="grid grid-cols-2 gap-2">
                {['Vacación', 'Baja', 'Festivo', 'Manual'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, type: type as any })}
                    className={`px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border-2 flex items-center justify-center gap-2 ${
                      formData.type === type 
                        ? 'bg-slate-900 border-slate-900 text-white' 
                        : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                    }`}
                  >
                    {getIcon(type)}
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Desde</label>
                <input 
                  required
                  type="date" 
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-brand-primary focus:bg-white outline-none rounded-xl px-4 py-3 text-sm font-bold transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Hasta</label>
                <input 
                  required
                  type="date" 
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full bg-slate-50 border-2 border-transparent focus:border-brand-primary focus:bg-white outline-none rounded-xl px-4 py-3 text-sm font-bold transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Motivo (Opcional)</label>
              <textarea 
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full bg-slate-50 border-2 border-transparent focus:border-brand-primary focus:bg-white outline-none rounded-xl px-4 py-3 text-sm font-bold transition-all min-h-[80px]"
                placeholder="Escribe el motivo..."
              />
            </div>

            <div className="flex gap-2">
              {editingId && (
                <button 
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
              )}
              <button 
                type="submit"
                className={`flex-1 py-4 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 ${editingId ? 'bg-blue-600 shadow-lg shadow-blue-200' : 'bg-brand-primary hover:shadow-xl hover:shadow-blue-200'}`}
              >
                {editingId ? <Save size={18} /> : <Plus size={18} />}
                {editingId ? 'Guardar Cambios' : 'Registrar Petición'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="bg-card-bg rounded-2xl p-8 border border-border-main shadow-sm min-h-[500px]">
          <h2 className="text-xl font-extrabold text-text-main mb-6">Peticiones Registradas</h2>
          
          <div className="space-y-2">
             <AnimatePresence>
                {requests.map((req) => {
                  const emp = employees.find(e => e.id === req.employeeId);
                  const isEditing = editingId === req.id;
                  return (
                    <motion.div
                      key={req.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`p-3 rounded-xl border flex items-center justify-between group transition-all ${isEditing ? 'bg-blue-50 border-brand-primary ring-2 ring-blue-100' : 'bg-slate-50 border-border-main'}`}
                    >
                      <div className="flex items-center gap-4">
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                           req.type === 'Vacación' ? 'bg-emerald-100' : 
                           req.type === 'Baja' ? 'bg-red-100' : 
                           req.type === 'Festivo' ? 'bg-amber-100' : 'bg-slate-200'
                         }`}>
                           {getIcon(req.type)}
                         </div>
                         <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{emp?.name || 'Empleado Eliminado'}</span>
                              <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${
                                req.type === 'Vacación' ? 'text-emerald-600 bg-emerald-50' : 
                                req.type === 'Baja' ? 'text-red-600 bg-red-50' : 
                                req.type === 'Festivo' ? 'text-amber-600 bg-amber-50' : 'text-slate-500 bg-white'
                              }`}>
                                {req.type}
                              </span>
                            </div>
                            <p className="text-xs font-bold text-slate-400">
                              {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                            </p>
                            {req.reason && <p className="text-[10px] text-slate-500 font-medium mt-1 italic">"{req.reason}"</p>}
                         </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button 
                          onClick={() => startEdit(req)}
                          className={`p-2 rounded-lg transition-all ${isEditing ? 'text-blue-600 bg-white shadow-sm' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50'}`}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(req.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
             </AnimatePresence>
             {requests.length === 0 && (
               <div className="py-20 flex flex-col items-center justify-center text-slate-300 gap-3">
                  <Info size={40} strokeWidth={1.5} />
                  <p className="font-bold uppercase tracking-widest text-sm">No hay peticiones activas</p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
