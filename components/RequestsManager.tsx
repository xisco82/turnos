import React, { useState } from 'react';
import { AppConfig, ScheduleRequest, RequestType } from '../types';
import { TrashIcon, SuitcaseIcon, EditIcon } from './Icons';
import { adminFetch } from '../api';

interface RequestsManagerProps {
  config: AppConfig;
  onUpdateRequests: (requests: ScheduleRequest[]) => void;
  onOpenSharePortal?: () => void;
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  approved: { text: 'Aprobada', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  pending: { text: 'Pendiente (se aplica)', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  rejected: { text: 'Rechazada', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
};

export default function RequestsManager({ config, onUpdateRequests, onOpenSharePortal }: RequestsManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const empty: Partial<ScheduleRequest> = { type: 'Vacaciones', startDate: '', endDate: '', employeeId: '', reason: '' };
  const [form, setForm] = useState<Partial<ScheduleRequest>>(empty);

  const employees = config.employees.filter(e => e.name.trim());
  const nameOf = (id: string) => employees.find(e => e.id === id)?.name || '¿?';

  const persist = (list: ScheduleRequest[]) => {
    onUpdateRequests(list);
    adminFetch('/api/requests', { method: 'PUT', body: JSON.stringify(list) }).catch(() => {});
  };

  const handleSave = () => {
    if (!form.employeeId || !form.startDate || !form.endDate) return;
    if (form.endDate < form.startDate) return;
    const list = editingId
      ? config.requests.map(r => (r.id === editingId ? { ...r, ...form } as ScheduleRequest : r))
      : [...config.requests, { ...form, id: Date.now().toString(), status: 'approved', createdAt: new Date().toISOString() } as ScheduleRequest];
    persist(list);
    setEditingId(null);
    setForm(empty);
  };

  const setStatus = (id: string, status: string) => persist(config.requests.map(r => (r.id === id ? { ...r, status } : r)));

  const removeRequest = (id: string) => {
    onUpdateRequests(config.requests.filter(r => r.id !== id));
    adminFetch(`/api/requests/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  const sorted = [...config.requests].sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-xl text-orange-600"><SuitcaseIcon /></div>
          <div>
            <h2 className="text-xl font-black text-gray-900">Peticiones y vacaciones</h2>
            <p className="text-xs text-gray-500">Se aplican solas al cuadrante. Las rechazadas no cuentan.</p>
          </div>
        </div>
        {onOpenSharePortal && (
          <button type="button" onClick={onOpenSharePortal} className="flex items-center gap-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border-2 border-teal-300 font-black text-xs px-4 py-2.5 rounded-xl">
            📲 Compartir enlace con el personal
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
        <label className="md:col-span-2 text-xs font-bold text-gray-600">Empleado
          <select value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="mt-1 w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium">
            <option value="">Seleccionar…</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold text-gray-600">Desde
          <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="mt-1 w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm" />
        </label>
        <label className="text-xs font-bold text-gray-600">Hasta
          <input type="date" value={form.endDate} min={form.startDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="mt-1 w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm" />
        </label>
        <label className="text-xs font-bold text-gray-600">Tipo
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as RequestType })} className="mt-1 w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm">
            <option value="Vacaciones">Vacaciones</option>
            <option value="Petición">Petición</option>
            <option value="Festivo">Festivo</option>
            <option value="Baja">Baja</option>
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button type="button" onClick={handleSave} className={`flex-1 h-[40px] ${editingId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'} text-white rounded-xl font-black text-xs`}>
            {editingId ? 'Guardar' : 'Añadir'}
          </button>
          {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(empty); }} className="h-[40px] px-3 bg-gray-200 text-gray-700 rounded-xl font-black text-xs">Cancelar</button>}
        </div>
      </div>

      <div className="space-y-2">
        {sorted.length === 0 ? (
          <p className="text-center py-10 text-sm text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">No hay peticiones. Añade una arriba o comparte el enlace con el personal.</p>
        ) : sorted.map(req => {
          const st = STATUS_LABEL[req.status || 'approved'] || STATUS_LABEL.approved;
          return (
            <div key={req.id} className={`flex flex-wrap items-center justify-between gap-3 p-3 border rounded-2xl ${req.status === 'rejected' ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-gray-100'}`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 font-bold text-xs">{nameOf(req.employeeId).charAt(0)}</div>
                <div>
                  <div className="text-sm font-black text-gray-900">{nameOf(req.employeeId)} <span className="font-bold text-orange-600 text-xs ml-1">{req.type}</span></div>
                  <div className="text-xs text-gray-600">{req.startDate} al {req.endDate}{req.reason ? ` · ${req.reason}` : ''}</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.cls}`}>{st.text}</span>
                {req.status !== 'approved' && <button type="button" onClick={() => setStatus(req.id, 'approved')} className="text-xs font-bold px-2 py-1 rounded-lg text-emerald-700 hover:bg-emerald-50">Aprobar</button>}
                {req.status !== 'rejected' && <button type="button" onClick={() => setStatus(req.id, 'rejected')} className="text-xs font-bold px-2 py-1 rounded-lg text-rose-700 hover:bg-rose-50">Rechazar</button>}
                <button type="button" onClick={() => { setForm({ employeeId: req.employeeId, type: req.type, startDate: req.startDate, endDate: req.endDate, reason: req.reason }); setEditingId(req.id); }} className="p-2 text-gray-400 hover:text-blue-600" title="Editar"><EditIcon /></button>
                <button type="button" onClick={() => removeRequest(req.id)} className="p-2 text-gray-400 hover:text-red-600" title="Eliminar"><TrashIcon /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
