import React, { useState, useEffect, useMemo } from 'react';
import { AppConfig, ScheduleRequest, RequestType } from '../types';
import { Calendar, Clock, Send, CheckCircle2, User, FileText, ArrowLeft, MessageSquare, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';

interface EmployeePortalProps {
  config: AppConfig;
  onBackToAdmin?: () => void;
  onRequestSubmitted?: (req: ScheduleRequest) => void;
}

export default function EmployeePortal({ config, onBackToAdmin, onRequestSubmitted }: EmployeePortalProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [requestType, setRequestType] = useState<RequestType>('Vacaciones');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedRequest, setSubmittedRequest] = useState<ScheduleRequest | null>(null);
  const [allRequests, setAllRequests] = useState<ScheduleRequest[]>(config.requests || []);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // List of active employees
  const cleanAyudantes = (config.ayudantes || []).filter(name => name.trim().toUpperCase() !== 'LORENA');
  const employees = useMemo(() => [
    { id: 'jefe', name: config.jefe, role: 'Jefe' },
    { id: 'subjefe', name: config.subjefe, role: '2º Jefe' },
    { id: 'conserje', name: config.conserje, role: 'Conserje' },
    ...config.recepcionistas.map((name, i) => ({ id: `rec-${i}`, name, role: 'Recepcionista' })),
    ...cleanAyudantes.map((name, i) => ({ id: `ayu-${i}`, name, role: 'Ayudante' })),
    ...config.extraEmployees.map(e => ({ id: e.id, name: e.name, role: e.role }))
  ].filter(e => e.name.trim() !== ''), [config]);

  // Load existing requests from server on mount
  useEffect(() => {
    fetch('/api/requests')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAllRequests(data);
        }
      })
      .catch(() => {
        // Fallback to config.requests
        setAllRequests(config.requests || []);
      });
  }, [config.requests]);

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);

  // Calculate days between dates
  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 0;
  }, [startDate, endDate]);

  // Employee's own requests
  const employeeRequests = useMemo(() => {
    if (!selectedEmployeeId) return [];
    return allRequests
      .filter(r => r.employeeId === selectedEmployeeId)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [allRequests, selectedEmployeeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedEmployeeId) {
      setErrorMessage('Por favor, selecciona tu nombre de la lista.');
      return;
    }
    if (!startDate) {
      setErrorMessage('Por favor, selecciona la fecha de inicio.');
      return;
    }
    if (!endDate) {
      setErrorMessage('Por favor, selecciona la fecha de fin.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setErrorMessage('La fecha de fin debe ser posterior o igual a la fecha de inicio.');
      return;
    }

    setIsSubmitting(true);

    const newReq: ScheduleRequest = {
      id: Date.now().toString(),
      employeeId: selectedEmployeeId,
      type: requestType,
      startDate,
      endDate,
      reason: reason.trim(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    try {
      // Send to server API
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReq)
      });

      if (res.ok) {
        const saved = await res.json();
        setSubmittedRequest(saved);
        setAllRequests(prev => [...prev, saved]);
        if (onRequestSubmitted) {
          onRequestSubmitted(saved);
        }
      } else {
        // Fallback local
        setSubmittedRequest(newReq);
        setAllRequests(prev => [...prev, newReq]);
        if (onRequestSubmitted) {
          onRequestSubmitted(newReq);
        }
      }
    } catch (err) {
      // Fallback local if server offline
      setSubmittedRequest(newReq);
      setAllRequests(prev => [...prev, newReq]);
      if (onRequestSubmitted) {
        onRequestSubmitted(newReq);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmittedRequest(null);
    setStartDate('');
    setEndDate('');
    setReason('');
    setErrorMessage(null);
  };

  // WhatsApp sharing URL
  const getWhatsAppUrl = (req: ScheduleRequest) => {
    const empName = selectedEmployee ? selectedEmployee.name : 'Un empleado';
    const text = `Hola Xisco, soy ${empName}. He solicitado ${req.type.toUpperCase()} desde el ${req.startDate} hasta el ${req.endDate} (${totalDays} días)${req.reason ? ` - Motivo: ${req.reason}` : ''}. ¿Me confirmas cuando puedas? ¡Gracias!`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100 to-zinc-200 py-6 px-4 sm:px-6 font-sans text-zinc-800">
      <div className="max-w-xl mx-auto">
        
        {/* TOP BAR */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏨</span>
            <div>
              <h1 className="text-lg font-black tracking-tight text-zinc-900 leading-none">TURNOS XISCO</h1>
              <p className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">Portal de Peticiones y Vacaciones</p>
            </div>
          </div>

          {onBackToAdmin && (
            <button
              onClick={onBackToAdmin}
              type="button"
              className="flex items-center gap-1 text-xs font-bold text-zinc-600 bg-white hover:bg-zinc-50 border border-zinc-300 px-3 py-1.5 rounded-lg shadow-sm transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Ver Cuadrante</span>
            </button>
          )}
        </div>

        {/* SUBMITTED SUCCESS CARD */}
        {submittedRequest ? (
          <div className="bg-white rounded-2xl shadow-xl border border-emerald-100 p-6 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h2 className="text-xl font-black text-zinc-900 mb-1">¡Solicitud Registrada con Éxito!</h2>
            <p className="text-sm text-zinc-600 mb-6">
              Tu solicitud ha quedado guardada en el sistema para que <span className="font-bold text-zinc-900">Xisco</span> la revise en el cuadrante.
            </p>

            {/* REQUEST DETAILS */}
            <div className="bg-zinc-50 rounded-xl p-4 text-left border border-zinc-200 mb-6 space-y-2 text-sm">
              <div className="flex justify-between items-center border-b border-zinc-200 pb-2">
                <span className="text-zinc-500 font-medium">Empleado:</span>
                <span className="font-black text-zinc-900">{selectedEmployee?.name}</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-200 pb-2">
                <span className="text-zinc-500 font-medium">Tipo:</span>
                <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {submittedRequest.type}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-200 pb-2">
                <span className="text-zinc-500 font-medium">Fechas:</span>
                <span className="font-black text-zinc-900">{submittedRequest.startDate} al {submittedRequest.endDate}</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-200 pb-2">
                <span className="text-zinc-500 font-medium">Duración:</span>
                <span className="font-bold text-teal-700">{totalDays} {totalDays === 1 ? 'día' : 'días'}</span>
              </div>
              {submittedRequest.reason && (
                <div className="flex justify-between items-start pt-1">
                  <span className="text-zinc-500 font-medium">Motivo:</span>
                  <span className="font-medium text-zinc-700 text-right max-w-[240px]">{submittedRequest.reason}</span>
                </div>
              )}
            </div>

            {/* WHATSAPP NOTIFICATION BUTTON */}
            <div className="space-y-3">
              <a
                href={getWhatsAppUrl(submittedRequest)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-4 rounded-xl shadow-md transition"
              >
                <MessageSquare className="w-5 h-5" />
                <span>Enviar aviso por WhatsApp a Xisco</span>
              </a>

              <Button
                type="button"
                variant="outline"
                onClick={handleResetForm}
                className="w-full py-2.5 rounded-xl text-zinc-700 border-zinc-300 font-bold"
              >
                Hacer otra solicitud
              </Button>
            </div>
          </div>
        ) : (
          /* REQUEST FORM */
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 overflow-hidden">
            <div className="bg-zinc-900 text-white p-5">
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-400" />
                <span>Solicitud de Vacaciones y Peticiones</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Completa el formulario para solicitar días de vacaciones, libranza o peticiones de turnos.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              
              {errorMessage && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 text-xs font-bold p-3 rounded-xl border border-red-200">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. SELECT EMPLOYEE */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 mb-2 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-teal-600" />
                  <span>1. ¿Quién eres? (Tu nombre) *</span>
                </label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:outline-none focus:border-teal-600 transition"
                  required
                >
                  <option value="">Selecciona tu nombre...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} — {emp.role}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. SELECT REQUEST TYPE */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-600" />
                  <span>2. Tipo de solicitud *</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRequestType('Vacaciones')}
                    className={`p-3 rounded-xl border-2 text-left transition flex items-center gap-2.5 ${
                      requestType === 'Vacaciones'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 font-black ring-2 ring-amber-400/20'
                        : 'border-zinc-200 bg-white text-zinc-700 font-semibold hover:bg-zinc-50'
                    }`}
                  >
                    <span className="text-xl">🏖️</span>
                    <div>
                      <div className="text-xs font-black">Vacaciones</div>
                      <div className="text-[10px] text-zinc-500 font-normal leading-tight">Días reglamentarios</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRequestType('Petición')}
                    className={`p-3 rounded-xl border-2 text-left transition flex items-center gap-2.5 ${
                      requestType === 'Petición'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-black ring-2 ring-indigo-400/20'
                        : 'border-zinc-200 bg-white text-zinc-700 font-semibold hover:bg-zinc-50'
                    }`}
                  >
                    <span className="text-xl">📝</span>
                    <div>
                      <div className="text-xs font-black">Petición Libre</div>
                      <div className="text-[10px] text-zinc-500 font-normal leading-tight">Día puntual / turno</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRequestType('Festivo')}
                    className={`p-3 rounded-xl border-2 text-left transition flex items-center gap-2.5 ${
                      requestType === 'Festivo'
                        ? 'border-purple-500 bg-purple-50 text-purple-900 font-black ring-2 ring-purple-400/20'
                        : 'border-zinc-200 bg-white text-zinc-700 font-semibold hover:bg-zinc-50'
                    }`}
                  >
                    <span className="text-xl">🎉</span>
                    <div>
                      <div className="text-xs font-black">Festivo</div>
                      <div className="text-[10px] text-zinc-500 font-normal leading-tight">Compensación / Asuntos</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRequestType('Baja')}
                    className={`p-3 rounded-xl border-2 text-left transition flex items-center gap-2.5 ${
                      requestType === 'Baja'
                        ? 'border-rose-500 bg-rose-50 text-rose-900 font-black ring-2 ring-rose-400/20'
                        : 'border-zinc-200 bg-white text-zinc-700 font-semibold hover:bg-zinc-50'
                    }`}
                  >
                    <span className="text-xl">🩺</span>
                    <div>
                      <div className="text-xs font-black">Baja Médica</div>
                      <div className="text-[10px] text-zinc-500 font-normal leading-tight">Incapacidad temporal</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 3. DATES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    <span>Fecha Inicio *</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:outline-none focus:border-teal-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-teal-600" />
                    <span>Fecha Fin *</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-sm font-bold text-zinc-900 focus:outline-none focus:border-teal-600"
                    required
                  />
                </div>
              </div>

              {/* DAYS COUNTER */}
              {totalDays > 0 && (
                <div className="flex items-center justify-between bg-teal-50 border border-teal-200 px-4 py-2.5 rounded-xl">
                  <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-teal-600" />
                    <span>Duración solicitada:</span>
                  </span>
                  <span className="text-xs font-black bg-teal-600 text-white px-2.5 py-1 rounded-lg">
                    {totalDays} {totalDays === 1 ? 'DÍA' : 'DÍAS'}
                  </span>
                </div>
              )}

              {/* 4. REASON / NOTE */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-700 mb-1 flex items-center gap-1">
                  <span>Motivo o Comentario (Opcional)</span>
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej: Viaje familiar, cita médica, asuntos personales..."
                  className="w-full px-3.5 py-2.5 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-sm text-zinc-800 focus:outline-none focus:border-teal-600"
                />
              </div>

              {/* SUBMIT BUTTON */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-black py-3.5 px-4 rounded-xl shadow-lg shadow-teal-700/20 text-sm tracking-wide transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Enviando petición...' : 'ENVIAR SOLICITUD A XISCO'}</span>
              </button>
            </form>
          </div>
        )}

        {/* EMPLOYEE HISTORY (If selected) */}
        {selectedEmployeeId && employeeRequests.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl border border-zinc-200 p-5 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-800 mb-3 flex items-center justify-between">
              <span>Tus solicitudes registradas ({selectedEmployee?.name})</span>
              <span className="text-teal-600 font-bold">{employeeRequests.length}</span>
            </h3>

            <div className="space-y-2">
              {employeeRequests.map((req) => (
                <div 
                  key={req.id} 
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-200 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-zinc-900">{req.type}</span>
                      <span className="text-zinc-400 font-normal">
                        ({req.startDate} al {req.endDate})
                      </span>
                    </div>
                    {req.reason && (
                      <p className="text-[11px] text-zinc-500 italic mt-0.5">{req.reason}</p>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 font-bold text-[10px] uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Registrada</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FOOTER */}
        <div className="mt-8 text-center text-[11px] text-zinc-400 font-medium">
          Sistema de Cuadrantes y Gestión de Personal • Turnos Xisco
        </div>

      </div>
    </div>
  );
}
