import React, { useState } from 'react';
import { AppConfig, ScheduleRequest, RequestType } from '../types';
import { PlusIcon, TrashIcon, SuitcaseIcon, EditIcon } from './Icons';

interface RequestsManagerProps {
  config: AppConfig;
  onUpdateRequests: (requests: ScheduleRequest[]) => void;
}

export default function RequestsManager({ config, onUpdateRequests }: RequestsManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRequest, setNewRequest] = useState<Partial<ScheduleRequest>>({
    type: 'Vacaciones',
    startDate: '',
    endDate: '',
    employeeId: '',
  });

  const employees = [
    { id: 'jefe', name: config.jefe, role: 'Jefe' },
    { id: 'subjefe', name: config.subjefe, role: 'Subjefe' },
    ...config.recepcionistas.map((name, i) => ({ id: `rec-${i}`, name, role: 'Recepcionista' })),
    ...config.ayudantes.map((name, i) => ({ id: `ayu-${i}`, name, role: 'Ayudante' })),
    { id: 'conserje', name: config.conserje, role: 'Conserje' },
    ...config.extraEmployees.map(e => ({ id: e.id, name: e.name, role: e.role }))
  ].filter(e => e.name.trim() !== '');

  const handleSaveRequest = () => {
    if (!newRequest.employeeId || !newRequest.startDate || !newRequest.endDate) return;

    if (editingId) {
      const updatedRequests = config.requests.map(r => 
        r.id === editingId 
          ? { ...r, ...newRequest as ScheduleRequest, id: editingId } 
          : r
      );
      onUpdateRequests(updatedRequests);
      setEditingId(null);
    } else {
      const request: ScheduleRequest = {
        id: Date.now().toString(),
        employeeId: newRequest.employeeId,
        type: newRequest.type as RequestType,
        startDate: newRequest.startDate,
        endDate: newRequest.endDate,
      };
      onUpdateRequests([...(config.requests || []), request]);
    }

    setNewRequest({ ...newRequest, startDate: '', endDate: '', employeeId: '' });
  };

  const startEdit = (req: ScheduleRequest) => {
    setNewRequest({
      employeeId: req.employeeId,
      type: req.type,
      startDate: req.startDate,
      endDate: req.endDate
    });
    setEditingId(req.id);
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewRequest({ ...newRequest, startDate: '', endDate: '', employeeId: '' });
  };

  const removeRequest = (id: string) => {
    onUpdateRequests(config.requests.filter(r => r.id !== id));
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 bg-orange-100 rounded-xl text-orange-600">
          <SuitcaseIcon />
        </div>
        <div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight">Peticiones y Vacaciones</h2>
          <p className="text-xs text-gray-400 font-medium italic">El sistema asignará automáticamente libres a quien esté de vacaciones.</p>
        </div>
      </div>

      {/* ADD REQUEST FORM */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <div className="col-span-1 md:col-span-2">
          <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Empleado</label>
          <select 
            value={newRequest.employeeId}
            onChange={(e) => setNewRequest({ ...newRequest, employeeId: e.target.value })}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500 transition"
          >
            <option value="">Seleccionar...</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Desde</label>
          <input 
            type="date" 
            value={newRequest.startDate}
            onChange={(e) => setNewRequest({ ...newRequest, startDate: e.target.value })}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500 transition"
          />
        </div>
        <div>
          <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Hasta</label>
          <input 
            type="date" 
            value={newRequest.endDate}
            onChange={(e) => setNewRequest({ ...newRequest, endDate: e.target.value })}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500 transition"
          />
        </div>
        <div>
          <label className="block text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Tipo</label>
          <select 
            value={newRequest.type}
            onChange={(e) => setNewRequest({ ...newRequest, type: e.target.value as RequestType })}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500 transition"
          >
            <option value="Vacaciones">Vacaciones</option>
            <option value="Petición">Petición</option>
            <option value="Festivo">Festivo</option>
            <option value="Baja">Baja</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button 
            onClick={handleSaveRequest}
            className={`flex-1 h-[40px] ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'} text-white rounded-xl font-black text-xs transition active:scale-95 shadow-lg`}
          >
            {editingId ? 'GUARDAR' : 'AÑADIR'}
          </button>
          {editingId && (
            <button 
              onClick={cancelEdit}
              className="h-[40px] px-4 bg-gray-200 text-gray-600 rounded-xl font-black text-xs hover:bg-gray-300 transition active:scale-95"
            >
              CANCELAR
            </button>
          )}
        </div>
      </div>

      {/* REQUESTS LIST */}
      <div className="space-y-3">
        {config.requests.length === 0 ? (
          <div className="text-center py-10 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
            <p className="text-sm text-gray-400 italic font-medium">No hay peticiones registradas.</p>
          </div>
        ) : (
          config.requests.map(req => {
            const emp = employees.find(e => e.id === req.employeeId);
            return (
              <div key={req.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:border-orange-200 hover:shadow-md transition-all group">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 font-bold text-xs">
                    {emp?.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-black text-gray-900">{emp?.name}</div>
                    <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">{req.type}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-right mr-4">
                    <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Periodo</div>
                    <div className="text-xs font-bold text-gray-700">{req.startDate} alc{req.endDate}</div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={() => startEdit(req)}
                      className="p-2 text-gray-400 hover:text-blue-500 transition opacity-0 group-hover:opacity-100"
                      title="Editar"
                    >
                      <EditIcon />
                    </button>
                    <button 
                      onClick={() => removeRequest(req.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                      title="Eliminar"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
