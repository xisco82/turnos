import React, { useState, useEffect, useMemo } from 'react';
import { AppConfig, ScheduleRequest, RequestType, DayOfWeek, ShiftPrefs } from '../types';
import { Sun, Sunset, Calendar, Send, CheckCircle2, User, ArrowLeft, MessageSquare, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { DAYS_OF_WEEK, cleanShiftPrefs, displayShift, effectiveRules, getMondayISO, shiftLegend, shiftStyle } from '../constants';
import { addDaysISO, getNightPlusForWeek, getPublicWeekSchedule } from '../scheduleService';

interface EmployeePortalProps {
  config: AppConfig;
  onBackToAdmin?: () => void;
  onRequestSubmitted?: (req: ScheduleRequest) => void;
  onPrefsSaved?: (employeeId: string, prefs: ShiftPrefs) => void;
}

interface PortalEmployee { id: string; name: string; canMorning?: boolean; canAfternoon?: boolean; workDays?: number }

interface PublicRow { employeeId: string; employeeName: string; shifts: { day: DayOfWeek; shift: string; label: string }[] }

const EMP_KEY = 'turnos_portal_employee';

export default function EmployeePortal({ config, onBackToAdmin, onRequestSubmitted, onPrefsSaved }: EmployeePortalProps) {
  const [tab, setTab] = useState<'turnos' | 'prefs' | 'pedir'>('turnos');
  const [employees, setEmployees] = useState<PortalEmployee[]>(
    () => config.employees.filter(e => e.active && e.name.trim()).map(e => ({
      id: e.id, name: e.name, canMorning: e.canMorning && !e.permanentNight, canAfternoon: e.canAfternoon && !e.permanentNight,
      workDays: effectiveRules(config, e).workDays,
    })));
  const [shiftLabels, setShiftLabels] = useState({ M: config.shifts.M.label, T: config.shifts.T.label });
  // preferencias de mañanas/tardes (null = sin preferencia)
  const [prefM, setPrefM] = useState<number | null>(null);
  const [prefT, setPrefT] = useState<number | null>(null);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [serverPrefs, setServerPrefs] = useState<Record<string, ShiftPrefs> | null>(null);
  const [managerName, setManagerName] = useState(config.managerName || 'el responsable');
  const [selectedId, setSelectedId] = useState<string>(() => { try { return localStorage.getItem(EMP_KEY) || ''; } catch { return ''; } });
  const [week, setWeek] = useState(getMondayISO());
  const [rows, setRows] = useState<PublicRow[]>([]);
  const [legend, setLegend] = useState(shiftLegend(config));
  const [loading, setLoading] = useState(false);
  const [nightPlus, setNightPlus] = useState<{ label: string; threshold: number; final?: boolean; closingDate?: string; to?: string; rows: { employeeId: string; hours: number; plus: boolean }[] } | null>(null);

  // formulario
  const [requestType, setRequestType] = useState<RequestType>('Vacaciones');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ScheduleRequest | null>(null);
  const [allRequests, setAllRequests] = useState<ScheduleRequest[]>(config.requests || []);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => { try { if (selectedId) localStorage.setItem(EMP_KEY, selectedId); } catch { /* */ } }, [selectedId]);

  useEffect(() => {
    fetch('/api/public/employees').then(r => (r.ok ? r.json() : null)).then(d => {
      if (d?.employees?.length) { setEmployees(d.employees); setManagerName(d.managerName || managerName); }
      if (d?.shiftLabels) setShiftLabels(d.shiftLabels);
    }).catch(() => {});
    fetch('/api/public/preferences').then(r => (r.ok ? r.json() : null)).then(d => { if (d && typeof d === 'object') setServerPrefs(d); }).catch(() => {});
    fetch('/api/requests').then(r => (r.ok ? r.json() : null)).then(d => { if (Array.isArray(d)) setAllRequests(d); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const local = () => {
      const data = getPublicWeekSchedule(config, week);
      return data.rows.map(r => ({ ...r, shifts: r.shifts.map(s => ({ ...s, label: displayShift(s.shift, config) })) }));
    };
    fetch(`/api/public/schedule?week=${week}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { if (!cancelled) { setRows(d.rows); if (d.legend) setLegend(d.legend); setNightPlus(d.nightPlus || null); } })
      .catch(() => {
        if (cancelled) return;
        setRows(local());
        setNightPlus(config.rules.nightPlus.enabled ? getNightPlusForWeek(config, week) : null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [week, config]);

  useEffect(() => {
    const p = cleanShiftPrefs(serverPrefs?.[selectedId] ?? config.employees.find(e => e.id === selectedId)?.shiftPrefs);
    setPrefM(p.mornings);
    setPrefT(p.afternoons);
    setPrefsMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, serverPrefs]);

  const selected = employees.find(e => e.id === selectedId);
  const maxDays = selected?.workDays ?? 5;
  const canM = selected?.canMorning !== false;
  const canT = selected?.canAfternoon !== false;
  const prefsOverflow = (canM ? prefM ?? 0 : 0) + (canT ? prefT ?? 0 : 0) > maxDays;

  const savePrefs = async () => {
    if (!selectedId) return setPrefsMsg({ ok: false, text: 'Selecciona tu nombre arriba.' });
    if (prefsOverflow) return setPrefsMsg({ ok: false, text: `Entre mañanas y tardes no pueden pasar de ${maxDays} días a la semana.` });
    setPrefsSaving(true);
    setPrefsMsg(null);
    const body = { employeeId: selectedId, mornings: canM ? prefM : null, afternoons: canT ? prefT : null };
    let saved: ShiftPrefs = { mornings: body.mornings, afternoons: body.afternoons, updatedAt: new Date().toISOString() };
    try {
      const res = await fetch('/api/public/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) saved = cleanShiftPrefs(await res.json());
      else if (res.status === 400) { const e = await res.json().catch(() => null); setPrefsSaving(false); return setPrefsMsg({ ok: false, text: e?.error || 'No se pudo guardar.' }); }
    } catch { /* sin servidor: se guarda en este navegador */ }
    setServerPrefs(prev => ({ ...(prev || {}), [selectedId]: saved }));
    onPrefsSaved?.(selectedId, saved);
    setPrefsSaving(false);
    setPrefsMsg({ ok: true, text: 'Guardado. Se tendrá en cuenta al preparar los próximos cuadrantes.' });
  };
  const myRow = rows.find(r => r.employeeId === selectedId);
  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const diff = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
    return diff > 0 ? diff : 0;
  }, [startDate, endDate]);
  const myRequests = allRequests.filter(r => r.employeeId === selectedId).sort((a, b) => b.startDate.localeCompare(a.startDate));

  const weekLabel = (() => {
    const fmt = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    return `${fmt(week)} – ${fmt(addDaysISO(week, 6))}`;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!selectedId) return setErrorMessage('Selecciona tu nombre arriba.');
    if (!startDate || !endDate) return setErrorMessage('Elige la fecha de inicio y la de fin.');
    if (startDate > endDate) return setErrorMessage('La fecha de fin no puede ser anterior a la de inicio.');
    setIsSubmitting(true);
    const newReq: ScheduleRequest = { id: Date.now().toString(), employeeId: selectedId, type: requestType, startDate, endDate, reason: reason.trim(), status: 'pending', createdAt: new Date().toISOString() };
    let saved = newReq;
    try {
      const res = await fetch('/api/requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newReq) });
      if (res.ok) saved = await res.json();
    } catch { /* sin servidor: queda en local */ }
    setSubmitted(saved);
    setAllRequests(prev => [...prev, saved]);
    onRequestSubmitted?.(saved);
    setIsSubmitting(false);
  };

  const whatsapp = (req: ScheduleRequest) => {
    const text = `Hola ${managerName}, soy ${selected?.name || 'un empleado'}. He solicitado ${req.type.toUpperCase()} del ${req.startDate} al ${req.endDate} (${totalDays} días)${req.reason ? `. Motivo: ${req.reason}` : ''}. ¿Me lo confirmas? ¡Gracias!`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="min-h-screen bg-zinc-100 py-6 px-4 font-sans text-zinc-800">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏨</span>
            <h1 className="text-lg font-black text-zinc-900">Mis turnos</h1>
          </div>
          {onBackToAdmin && (
            <button onClick={onBackToAdmin} type="button" className="flex items-center gap-1 text-xs font-bold text-zinc-600 bg-white border border-zinc-300 px-3 py-1.5 rounded-lg">
              <ArrowLeft className="w-3.5 h-3.5" /> Volver al panel
            </button>
          )}
        </div>

        <label className="block bg-white rounded-2xl border border-zinc-200 p-4 mb-4">
          <span className="text-xs font-black text-zinc-700 flex items-center gap-1.5 mb-2"><User className="w-3.5 h-3.5 text-teal-600" /> ¿Quién eres?</span>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="w-full px-3 py-2.5 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-sm font-bold">
            <option value="">Selecciona tu nombre…</option>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
        </label>

        <div className="flex gap-1 mb-4">
          {([['turnos', 'Turnos'], ['prefs', 'Mis preferencias'], ['pedir', 'Pedir días']] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`flex-1 py-2.5 rounded-xl text-sm font-black ${tab === id ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 border border-zinc-200'}`}>{label}</button>
          ))}
        </div>

        {tab === 'turnos' && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <button type="button" onClick={() => setWeek(addDaysISO(week, -7))} className="p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50" aria-label="Semana anterior"><ChevronLeft className="w-5 h-5" /></button>
              <div className="text-center">
                <div className="font-black text-zinc-900">{weekLabel}</div>
                <button type="button" onClick={() => setWeek(getMondayISO())} className="text-xs font-bold text-teal-700">Ir a esta semana</button>
              </div>
              <button type="button" onClick={() => setWeek(addDaysISO(week, 7))} className="p-2 rounded-lg border border-zinc-200 hover:bg-zinc-50" aria-label="Semana siguiente"><ChevronRight className="w-5 h-5" /></button>
            </div>

            {myRow && (
              <div className="grid grid-cols-7 gap-1.5 mb-5">
                {myRow.shifts.map((s, i) => (
                  <div key={s.day} className="text-center">
                    <div className="text-[11px] font-bold text-zinc-500">{s.day.slice(0, 3)}</div>
                    <div className="text-[11px] text-zinc-400 mb-1">{addDaysISO(week, i).slice(8)}</div>
                    <div className={`h-14 rounded-lg flex items-center justify-center font-black ${s.label.length > 3 ? 'text-xs' : 'text-xl'} ${shiftStyle(s.shift)}`}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
            {myRow && nightPlus && (() => {
              const p = nightPlus.rows.find(r => r.employeeId === selectedId);
              if (!p) return null;
              return (
                <div className={`mb-5 rounded-xl p-3 flex items-center justify-between gap-3 ${nightPlus.final && p.plus ? 'bg-indigo-700 text-white' : 'bg-indigo-50 text-indigo-950 border border-indigo-100'}`}>
                  <div>
                    <div className="text-xs font-bold opacity-80">{nightPlus.final ? `Horas nocturnas en todo ${nightPlus.label}` : `Horas nocturnas de ${nightPlus.label} hasta ahora`}</div>
                    <div className="text-2xl font-black">{p.hours} h</div>
                  </div>
                  <div className="text-right text-sm font-black">
                    {nightPlus.final
                      ? (p.plus ? 'Tienes plus de nocturnidad' : `Sin plus (desde ${nightPlus.threshold} h al mes)`)
                      : `Resultado del plus el ${new Date((nightPlus.closingDate || '') + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`}
                  </div>
                </div>
              );
            })()}
            {!selectedId && <p className="text-sm text-zinc-500 mb-4">Elige tu nombre arriba para ver tus turnos destacados.</p>}

            <div className={`overflow-x-auto ${loading ? 'opacity-50' : ''}`}>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left p-1.5 text-xs font-black text-zinc-600">Equipo</th>
                    {DAYS_OF_WEEK.map(d => <th key={d} className="p-1.5 text-xs font-black text-zinc-600">{d.slice(0, 2)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.employeeId} className={r.employeeId === selectedId ? 'bg-teal-50' : ''}>
                      <td className="p-1.5 font-bold text-zinc-900 whitespace-nowrap">{r.employeeName}</td>
                      {r.shifts.map(s => (
                        <td key={s.day} className="p-0.5">
                          <div className={`h-9 min-w-[2.25rem] rounded flex items-center justify-center font-black text-xs ${shiftStyle(s.shift)}`}>{s.label}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 text-xs text-zinc-600">
              {legend.map(l => <span key={l.code}><b className="text-zinc-900">{l.code}</b> {l.label}</span>)}
            </div>
          </div>
        )}

        {tab === 'prefs' && (
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-5">
            <div>
              <h2 className="text-lg font-black text-zinc-900">¿Cuántas mañanas y tardes prefieres?</h2>
              <p className="text-sm text-zinc-600 mt-1">Elige cuántos turnos de cada tipo te gustaría hacer <b>a la semana</b>. Es una preferencia: se intenta respetar, pero a veces la cobertura del hotel no lo permite.</p>
            </div>
            {!selectedId ? (
              <p className="text-sm font-bold text-zinc-500">Elige tu nombre arriba para indicar tus preferencias.</p>
            ) : (
              <>
                {([
                  { key: 'M', title: shiftLabels.M, icon: <Sun className="w-4 h-4 text-amber-600" />, value: prefM, set: setPrefM, allowed: canM, on: 'bg-amber-500 text-white border-amber-500' },
                  { key: 'T', title: shiftLabels.T, icon: <Sunset className="w-4 h-4 text-sky-600" />, value: prefT, set: setPrefT, allowed: canT, on: 'bg-sky-600 text-white border-sky-600' },
                ]).map(row => (
                  <div key={row.key} className={row.allowed ? '' : 'opacity-50'}>
                    <p className="text-sm font-black text-zinc-800 flex items-center gap-1.5 mb-2">{row.icon} {row.title}s por semana</p>
                    {!row.allowed && <p className="text-xs text-zinc-500 mb-2">No haces este turno.</p>}
                    <div className="flex flex-wrap gap-1.5">
                      <button type="button" disabled={!row.allowed} onClick={() => row.set(null)}
                        className={`px-3 py-2 rounded-xl text-sm font-bold border-2 ${row.value === null ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white border-zinc-200 text-zinc-700'}`}>Me da igual</button>
                      {Array.from({ length: maxDays + 1 }, (_, n) => (
                        <button key={n} type="button" disabled={!row.allowed} onClick={() => row.set(n)}
                          className={`w-11 py-2 rounded-xl text-sm font-black border-2 ${row.value === n ? row.on : 'bg-white border-zinc-200 text-zinc-700'}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                ))}
                <p className={`text-xs font-bold ${prefsOverflow ? 'text-rose-700' : 'text-zinc-500'}`}>
                  {prefsOverflow
                    ? `Entre mañanas y tardes no pueden pasar de ${maxDays} (tus días de trabajo a la semana).`
                    : `Trabajas ${maxDays} días a la semana. Los que no elijas los reparte el sistema.`}
                </p>
                {prefsMsg && (
                  <div className={`flex items-center gap-2 text-xs font-bold p-3 rounded-xl border ${prefsMsg.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {prefsMsg.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}{prefsMsg.text}
                  </div>
                )}
                <button type="button" onClick={savePrefs} disabled={prefsSaving || prefsOverflow}
                  className="w-full flex items-center justify-center gap-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-black py-3.5 rounded-xl">
                  <CheckCircle2 className="w-4 h-4" /> {prefsSaving ? 'Guardando…' : 'Guardar mis preferencias'}
                </button>
              </>
            )}
          </div>
        )}

        {tab === 'pedir' && (submitted ? (
          <div className="bg-white rounded-2xl border border-emerald-100 p-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
            <h2 className="text-xl font-black text-zinc-900 mb-1">Solicitud enviada</h2>
            <p className="text-sm text-zinc-600 mb-5">{submitted.type} del {submitted.startDate} al {submitted.endDate}. Ya cuenta en el cuadrante.</p>
            <a href={whatsapp(submitted)} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl mb-2">
              <MessageSquare className="w-5 h-5" /> Avisar a {managerName} por WhatsApp
            </a>
            <button type="button" onClick={() => { setSubmitted(null); setStartDate(''); setEndDate(''); setReason(''); }} className="w-full py-2.5 rounded-xl border border-zinc-300 font-bold text-zinc-700">Hacer otra solicitud</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-zinc-200 p-5 space-y-4">
            {errorMessage && <div className="flex items-center gap-2 bg-red-50 text-red-700 text-xs font-bold p-3 rounded-xl border border-red-200"><AlertTriangle className="w-4 h-4" />{errorMessage}</div>}
            <div className="grid grid-cols-2 gap-2">
              {([['Vacaciones', '🏖️'], ['Petición', '📝'], ['Festivo', '🎉'], ['Baja', '🩺']] as [RequestType, string][]).map(([t, icon]) => (
                <button key={t} type="button" onClick={() => setRequestType(t)} className={`p-3 rounded-xl border-2 text-left text-sm font-black ${requestType === t ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-zinc-200 text-zinc-700'}`}>
                  {icon} {t === 'Petición' ? 'Día libre' : t === 'Baja' ? 'Baja médica' : t}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-black text-zinc-700">Desde<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full px-3 py-2 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-sm font-bold" required /></label>
              <label className="text-xs font-black text-zinc-700">Hasta<input type="date" value={endDate} min={startDate} onChange={e => setEndDate(e.target.value)} className="mt-1 w-full px-3 py-2 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-sm font-bold" required /></label>
            </div>
            {totalDays > 0 && <p className="text-xs font-bold text-teal-800">{totalDays} {totalDays === 1 ? 'día' : 'días'}</p>}
            <label className="block text-xs font-black text-zinc-700">Motivo (opcional)
              <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Viaje, cita médica…" className="mt-1 w-full px-3 py-2 bg-zinc-50 border-2 border-zinc-200 rounded-xl text-sm" />
            </label>
            <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-black py-3.5 rounded-xl">
              <Send className="w-4 h-4" /> {isSubmitting ? 'Enviando…' : 'Enviar solicitud'}
            </button>
            {myRequests.length > 0 && (
              <div className="pt-3 border-t border-zinc-100">
                <p className="text-xs font-black text-zinc-700 mb-2 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Tus solicitudes</p>
                {myRequests.map(r => (
                  <div key={r.id} className="flex justify-between text-xs py-1.5 border-b border-zinc-50">
                    <span><b>{r.type}</b> {r.startDate} al {r.endDate}</span>
                    <span className={`font-bold ${r.status === 'rejected' ? 'text-rose-700' : 'text-emerald-700'}`}>{r.status === 'rejected' ? 'Rechazada' : 'Registrada'}</span>
                  </div>
                ))}
              </div>
            )}
          </form>
        ))}
      </div>
    </div>
  );
}
