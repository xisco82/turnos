import React, { useState } from 'react';
import { Employee, ScheduleRequest, RequestType } from '../types';
import { PlusIcon, TrashIcon, CalendarIcon } from './Icons';

interface RequestsManagerProps {
  employees: Employee[];
  requests: ScheduleRequest[];
  onAdd: (request: Omit<ScheduleRequest, 'id'>) => void;
  onDelete: (id: string) => void;
}

export default function RequestsManager({ employees, requests, onAdd, onDelete }: RequestsManagerProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState<RequestType>('Libre');
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !startDate || !endDate) return;
    
    onAdd({
      employeeId,
      startDate,
      endDate,
      type,
      reason
    });

    setEmployeeId('');
    setStartDate('');
    setEndDate('');
    setReason('');
  };

  return (
    <div className="mt-8 pt-8 border-t border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
        <span className="mr-2 p-2 bg-purple-100 text-purple-600 rounded-full"><CalendarIcon /></span>
        Peticiones y Vacaciones
      </h2>
      
      <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Empleado</label>
            <select 
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-sm"
              required
            >
              <option value="">Seleccionar...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div>
             <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Tipo</label>
             <div className="flex space-x-2">
                {(['Libre', 'Vacaciones'] as RequestType[]).map(t => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${type === t ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-300'}`}
                    >
                        {t}
                    </button>
                ))}
             </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Desde</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Hasta</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Motivo (opcional)</label>
          <input 
            type="text" 
            value={reason}
             onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Boda, Cita médica..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <button 
          type="submit"
          className="w-full py-2 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 transition flex items-center justify-center space-x-2 shadow-sm"
        >
          <PlusIcon />
          <span>Registrar Petición</span>
        </button>
      </form>

      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
        {requests.sort((a,b) => b.startDate.localeCompare(a.startDate)).map(req => {
          const emp = employees.find(e => e.id === req.employeeId);
          return (
            <div key={req.id} className="bg-white p-3 rounded-lg border border-gray-100 shadow-sm flex items-center justify-between">
              <div className="flex-grow">
                <div className="flex items-center space-x-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${req.type === 'Vacaciones' ? 'bg-green-500' : 'bg-purple-500'}`}></span>
                  <span className="font-bold text-gray-800">{emp?.name || 'Desconocido'}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${req.type === 'Vacaciones' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                    {req.type}
                  </span>
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  {new Date(req.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} - {new Date(req.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                </div>
                {req.reason && <div className="text-[11px] text-gray-400 italic mt-1 leading-tight">{req.reason}</div>}
              </div>
              <button 
                onClick={() => onDelete(req.id)}
                className="text-gray-300 hover:text-red-500 transition p-2"
              >
                <TrashIcon />
              </button>
            </div>
          );
        })}
        {requests.length === 0 && (
          <div className="text-center py-8 text-gray-400 italic text-sm">
            No hay peticiones registradas.
          </div>
        )}
      </div>
    </div>
  );
}
