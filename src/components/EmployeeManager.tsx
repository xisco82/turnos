import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  UserPlus,
  Shield,
  HelpCircle,
  Stethoscope as Sick,
  Coffee,
  Sun,
  Moon,
  Users,
  Settings2
} from 'lucide-react';
import { Employee, Role } from '../types.ts';
import { db } from '../lib/firebase-client.ts';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import EmployeeForm from './EmployeeForm.tsx';
import { motion, AnimatePresence } from 'motion/react';

interface EmployeeManagerProps {
  employees: Employee[];
}

export default function EmployeeManager({ employees }: EmployeeManagerProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [search, setSearch] = useState('');

  const ROLE_ORDER: Record<string, number> = {
    [Role.Jefe]: 0,
    [Role.Subjefe]: 1,
    [Role.Recepcionista]: 2,
    [Role.Ayudante]: 3,
    [Role.Conserje]: 4
  };

  const filteredEmployees = employees
    .filter(emp => 
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.role.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99));

  const handleSave = async (data: Omit<Employee, 'id'>) => {
    if (editingEmployee) {
      await updateDoc(doc(db, 'employees', editingEmployee.id), data as any);
    } else {
      await addDoc(collection(db, 'employees'), data);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar a este empleado?')) {
      await deleteDoc(doc(db, 'employees', id));
    }
  };

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case Role.Jefe: return <Shield className="text-amber-500" size={16} />;
      case Role.Subjefe: return <Shield className="text-blue-500" size={16} />;
      case Role.Ayudante: return <HelpCircle className="text-emerald-500" size={16} />;
      default: return <Users className="text-slate-400" size={16} />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Personal</h2>
          <p className="text-slate-500 font-medium">Gestiona el equipo y sus preferencias de turno.</p>
        </div>
        <button 
          onClick={() => { setEditingEmployee(null); setIsFormOpen(true); }}
          className="flex items-center justify-center gap-2 bg-brand-primary text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg hover:bg-blue-700 transition-all active:scale-95"
        >
          <UserPlus size={20} />
          Añadir Empleado
        </button>
      </div>

      <div className="bg-card-bg rounded-2xl border border-border-main shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border-main flex items-center gap-3 bg-slate-50/50">
          <Search size={16} className="text-text-muted" />
          <input 
            type="text" 
            placeholder="Buscar por nombre o rol..."
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder:text-text-muted"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-100 border-b border-border-main">
                <th className="px-6 py-3 text-[11px] font-bold text-text-muted uppercase tracking-widest">Empleado</th>
                <th className="px-6 py-3 text-[11px] font-bold text-text-muted uppercase tracking-widest">Rol</th>
                <th className="px-6 py-3 text-[11px] font-bold text-text-muted uppercase tracking-widest text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-main">
              <AnimatePresence>
                {filteredEmployees.map((emp) => (
                  <motion.tr 
                    key={emp.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900">{emp.name.toUpperCase()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full w-fit">
                        {getRoleIcon(emp.role)}
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{emp.role}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {emp.isNightRotationMember && (
                          <div className="w-6 h-6 rounded bg-indigo-50 text-indigo-500 flex items-center justify-center" title="Rotación Noche">
                            <Moon size={14} />
                          </div>
                        )}
                        {emp.isWeekendRotationMember && (
                          <div className="w-6 h-6 rounded bg-amber-50 text-amber-500 flex items-center justify-center" title="Rotación Finde">
                            <Sun size={14} />
                          </div>
                        )}
                        {emp.fixedWeekendOff && (
                          <div className="w-6 h-6 rounded bg-emerald-50 text-emerald-500 flex items-center justify-center" title="Finde Libre Fijo">
                            <Coffee size={14} />
                          </div>
                        )}
                        {emp.specialRules && emp.specialRules.length > 0 && (
                          <div className="w-6 h-6 rounded bg-purple-50 text-purple-500 flex items-center justify-center" title="Reglas Especiales">
                            <Settings2 size={14} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button 
                          onClick={() => { setEditingEmployee(emp); setIsFormOpen(true); }}
                          className="p-2 text-slate-400 hover:text-brand-primary hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(emp.id)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredEmployees.length === 0 && (
            <div className="py-20 text-center">
              <p className="font-bold text-slate-300 uppercase tracking-widest text-sm">No se encontraron empleados</p>
            </div>
          )}
        </div>
      </div>

      {isFormOpen && (
        <EmployeeForm 
          employee={editingEmployee} 
          onSave={handleSave} 
          onClose={() => setIsFormOpen(false)} 
        />
      )}
    </div>
  );
}
