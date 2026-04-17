import React, { useState, useEffect } from 'react';
import { Employee, Rule, DayOfWeek, Shift, Role } from '../types';
import { DAYS_OF_WEEK, STANDARD_SHIFTS, getShiftDetails, ShiftConst } from '../constants';

interface EmployeeFormProps {
  employee: Employee | null;
  onSave: (employee: Employee | Omit<Employee, 'id'>) => void;
  onClose: () => void;
}

const defaultRules: Rule = DAYS_OF_WEEK.reduce((acc, day) => ({ ...acc, [day]: ShiftConst.Off }), {} as Rule);

export default function EmployeeForm({ employee, onSave, onClose }: EmployeeFormProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('Otro');
  const [rules, setRules] = useState<Rule>(defaultRules);
  const [wantsPostNightRest, setWantsPostNightRest] = useState(false);
  const [postNightBehaviour, setPostNightBehaviour] = useState<PostNightBehaviour>('Off');
  const [isNightRotationMember, setIsNightRotationMember] = useState(false);
  const [isWeekendRotationMember, setIsWeekendRotationMember] = useState(false);
  const [fixedWeekendOff, setFixedWeekendOff] = useState(false);

  useEffect(() => {
    if (employee) {
      setName(employee.name);
      setRules(employee.rules);
      setRole(employee.role);
      setWantsPostNightRest(employee.wantsPostNightRest);
      setPostNightBehaviour(employee.postNightBehaviour || 'Off');
      setIsNightRotationMember(employee.isNightRotationMember || false);
      setIsWeekendRotationMember(employee.isWeekendRotationMember || false);
      setFixedWeekendOff(employee.fixedWeekendOff || false);
    } else {
      setName('');
      setRules(defaultRules);
      setRole('Otro');
      setWantsPostNightRest(false);
      setPostNightBehaviour('Off');
      setIsNightRotationMember(false);
      setIsWeekendRotationMember(false);
      setFixedWeekendOff(false);
    }
  }, [employee]);

  const handleRuleChange = (day: DayOfWeek, shift: Shift) => {
    setRules(prev => ({ ...prev, [day]: shift }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() === '') return;

    if (employee) {
      onSave({ 
        ...employee, 
        name, 
        role, 
        rules, 
        wantsPostNightRest, 
        postNightBehaviour,
        isNightRotationMember,
        isWeekendRotationMember,
        fixedWeekendOff
      });
    } else {
      const newEmployee: Omit<Employee, 'id'> = { 
        name, 
        role, 
        rules, 
        wantsPostNightRest, 
        postNightBehaviour,
        isNightRotationMember,
        isWeekendRotationMember,
        fixedWeekendOff
      };
      onSave(newEmployee);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">{employee ? 'Editar Empleado' : 'Añadir Empleado'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">Nombre del Empleado</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ej: Oscar"
              required
            />
          </div>

          <div className="mb-6">
             <label className="block text-sm font-medium text-gray-700 mb-2">Rol del Empleado (para lógica interna)</label>
             <div className="flex space-x-2">
                {(['Recepcionista', 'Ayudante', 'Otro'] as Role[]).map(r => (
                    <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${role === r ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                        {r}
                    </button>
                ))}
             </div>
          </div>
          
          <div className="mb-6 bg-gray-50 p-4 rounded-lg space-y-4">
             <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wider mb-2">Comportamiento y Rotaciones</h3>
             
             <div className="flex items-center justify-between">
                <div>
                   <span className="block text-sm font-medium text-gray-700">Turno tras Noche</span>
                   <span className="block text-xs text-gray-500">¿Qué hace tras lunes/martes noche?</span>
                </div>
                <div className="flex space-x-1">
                    {(['Off', 'Afternoon'] as PostNightBehaviour[]).map(b => (
                        <button
                            key={b}
                            type="button"
                            onClick={() => setPostNightBehaviour(b)}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${postNightBehaviour === b ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                        >
                            {b === 'Off' ? 'Libre (L)' : 'Tarde (T)'}
                        </button>
                    ))}
                </div>
             </div>

             <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Rotación de Noche (L/M)</span>
                <input type="checkbox" className="w-5 h-5 text-blue-600 rounded" checked={isNightRotationMember} onChange={() => setIsNightRotationMember(!isNightRotationMember)} />
             </label>

             <label className="flex items-center justify-between cursor-pointer border-t pt-2 mt-2">
                <div>
                    <span className="text-sm font-medium text-gray-700">Sábado y Domingo LIBRE</span>
                    <span className="block text-xs text-gray-500">¿Siempre libre los fines de semana?</span>
                </div>
                <input type="checkbox" className="w-5 h-5 text-blue-600 rounded" checked={fixedWeekendOff} onChange={() => setFixedWeekendOff(!fixedWeekendOff)} />
             </label>

             <label className="flex items-center justify-between cursor-pointer border-t pt-2 mt-2">
                <div>
                    <span className="text-sm font-medium text-gray-700">Rotación Finde</span>
                    <span className="block text-xs text-gray-500 italic">Un compañero libre cada finde (S/D)</span>
                </div>
                <input type="checkbox" className="w-5 h-5 text-blue-600 rounded" checked={isWeekendRotationMember} onChange={() => setIsWeekendRotationMember(!isWeekendRotationMember)} />
             </label>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-700 mb-3">Reglas de Horario Semanal</h3>
            <div className="space-y-4">
              {DAYS_OF_WEEK.map(day => (
                <div key={day} className="grid grid-cols-3 items-center gap-4">
                  <span className="text-gray-600 font-medium col-span-1">{day}</span>
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={rules[day]}
                      onChange={(e) => handleRuleChange(day, e.target.value)}
                      className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm mb-2"
                    />
                    <div className="flex flex-wrap gap-1">
                      {STANDARD_SHIFTS.map(shift => {
                          const details = getShiftDetails(shift);
                          return (
                            <button
                                key={shift}
                                type="button"
                                onClick={() => handleRuleChange(day, shift)}
                                className={`px-2 py-0.5 text-xs font-semibold rounded-md transition ${rules[day] === shift ? `${details.color} ${details.textColor} shadow-sm` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            >
                                {shift}
                            </button>
                          )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-4 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              {employee ? 'Guardar Cambios' : 'Crear Empleado'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}