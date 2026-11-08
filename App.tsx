import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppConfig, DayOfWeek, Shift } from './types';
import { DAYS_OF_WEEK, DEFAULT_CONFIG, PDF_COLORS, displayShift, getMondayISO, mergeShiftPrefs, morningTeam, shiftLegend, shiftStyle } from './constants';
import { normalizeConfig, migrateOldOverrides } from './configMigration';
import { addDaysISO, getNightPlusForWeek, getWeekSchedule, nightHoursOfShift } from './scheduleService';
import { adminFetch, getStoredPin, setStoredPin } from './api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChevronLeft, ChevronRight, Settings, RotateCcw, CheckCircle2, AlertTriangle, AlertCircle, Moon, Smartphone, Lock, CalendarDays, Sun } from 'lucide-react';
import { Button } from './components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './components/ui/table';
import { Dialog, DialogTrigger } from './components/ui/dialog';
import ConfigDialog from './components/ConfigDialog';
import EmployeePortal from './components/EmployeePortal';
import SharePortalDialog from './components/SharePortalDialog';

const LOCAL_KEY = 'turnos_config';

/** Lee la configuración guardada en este navegador (y migra el formato antiguo). */
const loadLocalConfig = (): AppConfig => {
  try {
    const saved = localStorage.getItem(LOCAL_KEY);
    if (!saved) return normalizeConfig(structuredClone(DEFAULT_CONFIG));
    const parsed = JSON.parse(saved);
    const cfg = normalizeConfig(parsed);
    if (parsed?.version !== 2) {
      const oldOv = localStorage.getItem('turnos_manual_overrides');
      if (oldOv) cfg.overridesByWeek = migrateOldOverrides(JSON.parse(oldOv));
    }
    return cfg;
  } catch {
    return normalizeConfig(structuredClone(DEFAULT_CONFIG));
  }
};

const isPortalUrl = () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('portal') || window.location.pathname.includes('/portal') || window.location.pathname.includes('/peticiones');
};

type AuthState = 'checking' | 'locked' | 'ok';

export default function App() {
  const [isEmployeePortal, setIsEmployeePortal] = useState(isPortalUrl);
  const [config, setConfig] = useState<AppConfig>(loadLocalConfig);
  const [auth, setAuth] = useState<AuthState>('checking');
  const [serverOnline, setServerOnline] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const loadedRef = useRef(false);

  const [week, setWeek] = useState(getMondayISO());
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [showSharePortalModal, setShowSharePortalModal] = useState(false);
  const [showRoles, setShowRoles] = useState(true);
  const [showNight, setShowNight] = useState(true);
  const [editingCell, setEditingCell] = useState<{ employeeId: string; employeeName: string; day: DayOfWeek; currentShift: Shift } | null>(null);
  const [customManualShift, setCustomManualShift] = useState('');

  // ── Acceso del administrador ──
  const loadFromServer = async (): Promise<boolean> => {
    const res = await adminFetch('/api/config');
    if (res.status === 401) return false;
    if (!res.ok) throw new Error('server');
    const data = await res.json();
    if (data) setConfig(normalizeConfig(data));
    loadedRef.current = true;
    return true;
  };

  useEffect(() => {
    if (isEmployeePortal) return;
    (async () => {
      try {
        const st = await fetch('/api/auth/status').then(r => (r.ok ? r.json() : Promise.reject()));
        setServerOnline(true);
        if (!st.pinRequired || getStoredPin()) {
          const ok = await loadFromServer();
          setAuth(ok ? 'ok' : 'locked');
          if (!ok) setStoredPin('');
        } else setAuth('locked');
      } catch {
        // Sin servidor: funciona sólo en este navegador.
        setServerOnline(false);
        loadedRef.current = true;
        const pin = loadLocalConfig().security.adminPin;
        setAuth(!pin || getStoredPin() === pin ? 'ok' : 'locked');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmployeePortal]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setStoredPin(pinInput);
    if (serverOnline) {
      try {
        if (await loadFromServer()) { setAuth('ok'); return; }
      } catch { /* cae al error */ }
    } else if (pinInput === config.security.adminPin) { setAuth('ok'); return; }
    setStoredPin('');
    setPinError('PIN incorrecto. Inténtalo de nuevo.');
  };

  // ── Guardado (navegador + servidor) ──
  useEffect(() => {
    if (auth !== 'ok' || !loadedRef.current) return;
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(config)); } catch { /* lleno */ }
    if (!serverOnline) return;
    const t = setTimeout(() => {
      adminFetch('/api/config', { method: 'POST', body: JSON.stringify(config) })
        .then(r => { if (r.ok) setStoredPin(config.security.adminPin); })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [config, auth, serverOnline]);

  // ── Peticiones enviadas desde el móvil ──
  useEffect(() => {
    if (auth !== 'ok') return;
    const pull = () => fetch('/api/requests').then(r => (r.ok ? r.json() : null)).then(list => {
      if (!Array.isArray(list)) return;
      setConfig(prev => {
        const map = new Map(prev.requests.map(r => [r.id, r]));
        let changed = false;
        list.forEach((r: any) => { if (!map.has(r.id)) { map.set(r.id, r); changed = true; } });
        return changed ? { ...prev, requests: [...map.values()] } : prev;
      });
    }).catch(() => {});
    const pullPrefs = () => fetch('/api/public/preferences').then(r => (r.ok ? r.json() : null)).then(map => {
      if (!map || typeof map !== 'object') return;
      setConfig(prev => {
        const employees = mergeShiftPrefs(prev.employees, map);
        return employees === prev.employees ? prev : { ...prev, employees };
      });
    }).catch(() => {});
    pull();
    pullPrefs();
    const i = setInterval(() => { pull(); pullPrefs(); }, 30000);
    return () => clearInterval(i);
  }, [auth]);

  const result = useMemo(() => getWeekSchedule(config, week), [config, week]);
  const nightPlusData = useMemo(() => (config.rules.nightPlus.enabled ? getNightPlusForWeek(config, week) : null), [config, week]);
  const nightPlus = showNight ? nightPlusData : null;
  const plusOf = (id: string) => nightPlus?.rows.find(r => r.employeeId === id);
  const weekNightHours = (id: string) => result.rows.find(r => r.employeeId === id)?.shifts.reduce((a, s) => a + nightHoursOfShift(s.shift, config), 0) || 0;
  const scheduleData = result.rows;
  const weekOverrides = config.overridesByWeek[week] || {};
  const hasOverrides = Object.keys(weekOverrides).length > 0;
  const errors = result.issues.filter(i => i.level === 'error');
  const warnings = result.issues.filter(i => i.level === 'warning');
  const prefNotes = result.issues.filter(i => i.rule === 'Preferencias');
  const nameOf = (id: string | null) => config.employees.find(e => e.id === id)?.name || '—';

  const applyOverride = (shift: Shift | null) => {
    if (!editingCell) return;
    const key = `${editingCell.employeeId}|${editingCell.day}`;
    setConfig(prev => {
      const wk = { ...(prev.overridesByWeek[week] || {}) };
      if (shift === null) delete wk[key]; else wk[key] = shift;
      const all = { ...prev.overridesByWeek };
      if (Object.keys(wk).length) all[week] = wk; else delete all[week];
      return { ...prev, overridesByWeek: all };
    });
    setEditingCell(null);
  };

  const resetWeek = () => setConfig(prev => {
    const all = { ...prev.overridesByWeek };
    delete all[week];
    return { ...prev, overridesByWeek: all };
  });

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    const end = addDaysISO(week, 6);
    doc.setFontSize(18);
    doc.text(`Turnos de recepción · ${week} al ${end}`, 14, 18);
    doc.setFontSize(9);
    doc.text(shiftLegend(config).map(l => `${l.code} ${l.label}`).join('   '), 14, 25);
    autoTable(doc, {
      startY: 30,
      head: [['Empleado', ...DAYS_OF_WEEK.map((d, i) => `${d} ${addDaysISO(week, i).slice(8)}`)]],
      body: scheduleData.map(r => [r.employeeName, ...r.shifts.map(s => displayShift(s.shift, config))]),
      theme: 'grid',
      headStyles: { fillColor: [31, 41, 55] },
      bodyStyles: { halign: 'center', fontStyle: 'bold' },
      columnStyles: { 0: { halign: 'left' } },
      didParseCell: (data: any) => {
        if (data.section !== 'body' || data.column.index === 0 || data.column.index > 7) return;
        const raw = scheduleData[data.row.index]?.shifts[data.column.index - 1]?.shift;
        const color = PDF_COLORS[raw] || [204, 251, 241];
        data.cell.styles.fillColor = color;
        if (raw === 'N') data.cell.styles.textColor = [255, 255, 255];
      },
    });
    doc.save(`turnos-${week}.pdf`);
  };

  // ── Vistas ──
  if (isEmployeePortal) {
    return (
      <EmployeePortal
        config={config}
        onBackToAdmin={auth === 'ok' ? () => {
          setIsEmployeePortal(false);
          window.history.pushState({}, '', window.location.pathname);
        } : undefined}
        onRequestSubmitted={req => setConfig(prev => ({ ...prev, requests: [...prev.requests, req] }))}
        onPrefsSaved={(employeeId, shiftPrefs) => setConfig(prev => ({ ...prev, employees: prev.employees.map(e => (e.id === employeeId ? { ...e, shiftPrefs } : e)) }))}
      />
    );
  }

  if (auth === 'checking') {
    return <div className="min-h-screen flex items-center justify-center text-zinc-500 font-bold">Cargando…</div>;
  }

  if (auth === 'locked') {
    return (
      <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-white border border-zinc-200 rounded-2xl shadow-xl p-8 w-full max-w-sm space-y-4">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 text-white flex items-center justify-center"><Lock className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-black text-zinc-900">Panel de turnos</h1>
            <p className="text-sm text-zinc-500">Introduce el PIN de administrador.</p>
          </div>
          <input autoFocus type="password" inputMode="numeric" value={pinInput} onChange={e => setPinInput(e.target.value)}
            className="w-full px-4 py-3 border-2 border-zinc-300 rounded-xl text-2xl font-black tracking-[0.4em] text-center focus:outline-none focus:border-zinc-900" aria-label="PIN" />
          {pinError && <p className="text-sm font-bold text-rose-700">{pinError}</p>}
          <button type="submit" className="w-full py-3 bg-zinc-900 text-white rounded-xl font-black">Entrar</button>
          <button type="button" onClick={() => { window.history.pushState({}, '', '?portal=empleado'); setIsEmployeePortal(true); }}
            className="w-full py-2 text-sm font-bold text-teal-700">Soy empleado: ver mis turnos</button>
        </form>
      </div>
    );
  }

  const fmtDay = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  return (
    <div className="min-h-screen bg-gray-50 text-slate-950 p-4 lg:p-10 font-sans">
      <header className="mb-6 flex flex-col xl:flex-row xl:items-end justify-between border-b border-zinc-200 pb-6 gap-6">
        <div>
          <h1 className="text-5xl md:text-6xl font-black italic tracking-tight uppercase leading-none text-zinc-900">Turnos<span className="text-zinc-300">.</span></h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-2xl font-black text-zinc-900">{fmtDay(week)} – {fmtDay(addDaysISO(week, 6))}</span>
            {week !== getMondayISO() && <button type="button" onClick={() => setWeek(getMondayISO())} className="text-xs font-bold text-teal-700 px-2 py-1 rounded hover:bg-teal-50">Ir a esta semana</button>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {config.rules.weekendRotation && (
              <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-full flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5" /> Libra el fin de semana: {nameOf(result.weekendOffEmployeeId)}
              </span>
            )}
            {config.rules.nightRotation.enabled && (
              <span className="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs font-bold rounded-full flex items-center gap-1.5">
                <Moon className="w-3.5 h-3.5" /> Noches rotativas: {result.nightRotationEmployeeIds.length ? result.nightRotationEmployeeIds.map(nameOf).join(', ') : 'no hacen falta'}
              </span>
            )}
            {!serverOnline && (
              <span className="px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold rounded-full">Sin servidor: los datos solo se guardan en este navegador</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasOverrides && (
            <Button variant="outline" className="h-12 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-bold px-4 rounded-lg" onClick={resetWeek} title="Quita los cambios manuales de esta semana">
              <RotateCcw className="h-4 w-4 mr-2" /> Quitar cambios manuales
            </Button>
          )}
          <Button variant="outline" className="h-12 w-12 rounded-lg" onClick={() => setWeek(addDaysISO(week, -7))} aria-label="Semana anterior"><ChevronLeft className="h-6 w-6" /></Button>
          <Button variant="outline" className="h-12 w-12 rounded-lg" onClick={() => setWeek(addDaysISO(week, 7))} aria-label="Semana siguiente"><ChevronRight className="h-6 w-6" /></Button>
          <label className="h-12 px-3 border border-zinc-200 bg-white rounded-lg flex items-center gap-2 text-sm font-bold cursor-pointer" title="Ir a una fecha">
            <CalendarDays className="w-4 h-4" />
            <input type="date" value={week} onChange={e => e.target.value && setWeek(getMondayISO(new Date(e.target.value + 'T12:00:00')))} className="bg-transparent outline-none w-[8.5rem]" />
          </label>
          <Button variant="outline" className="h-12 border-2 border-teal-600 bg-teal-50 text-teal-950 hover:bg-teal-100 text-xs font-black px-4 rounded-lg" onClick={() => setShowSharePortalModal(true)}>
            <Smartphone className="h-4 w-4 mr-2 text-teal-700" /> Enlace personal
          </Button>
          <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="h-12 text-xs font-bold px-4 rounded-lg"><Settings className="mr-2 h-4 w-4" /> Ajustes</Button>
            </DialogTrigger>
            <ConfigDialog config={config} onSave={c => { setConfig(c); setIsConfigOpen(false); }} />
          </Dialog>
          <Button className="h-12 bg-zinc-900 text-white font-black text-xs px-6 hover:bg-zinc-800 rounded-lg" onClick={handleExportPDF}>Exportar PDF</Button>
          {config.security.adminPin && (
            <Button variant="ghost" className="h-12 text-xs font-bold px-3 rounded-lg" onClick={() => { setStoredPin(''); setPinInput(''); setAuth('locked'); }} title="Cerrar sesión"><Lock className="h-4 w-4" /></Button>
          )}
        </div>
      </header>

      <SharePortalDialog isOpen={showSharePortalModal} onClose={() => setShowSharePortalModal(false)}
        onOpenPreview={() => { window.history.pushState({}, '', '?portal=empleado'); setIsEmployeePortal(true); }} />

      {/* ESTADO DE LAS NORMAS */}
      <section className={`mb-6 rounded-xl border-2 p-4 ${errors.length ? 'border-rose-300 bg-rose-50' : warnings.length ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}`}>
        {errors.length === 0 && warnings.length === 0 ? (
          <p className="flex items-center gap-2 font-black text-emerald-900"><CheckCircle2 className="w-5 h-5" /> Cuadrante válido: cumple todas las normas activas.</p>
        ) : (
          <div className="space-y-1.5">
            <p className={`flex items-center gap-2 font-black ${errors.length ? 'text-rose-900' : 'text-amber-900'}`}>
              {errors.length ? <AlertCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              {errors.length ? `${errors.length} ${errors.length === 1 ? 'norma no se cumple' : 'normas no se cumplen'}` : 'Avisos'}
            </p>
            <ul className="text-sm space-y-0.5 pl-7 list-disc">
              {[...errors, ...warnings].map((i, idx) => (
                <li key={idx} className={i.level === 'error' ? 'text-rose-900' : 'text-amber-900'}><b>{i.rule}:</b> {i.message}</li>
              ))}
            </ul>
          </div>
        )}
        {prefNotes.length > 0 && (
          <div className="mt-3 pt-3 border-t border-zinc-300/60">
            <p className="text-xs font-black text-zinc-700 mb-1">Preferencias de mañanas/tardes que no han cabido esta semana</p>
            <ul className="text-xs text-zinc-700 space-y-0.5 pl-5 list-disc">
              {prefNotes.map((i, idx) => <li key={idx}>{i.message}</li>)}
            </ul>
          </div>
        )}
      </section>

      {/* EDICIÓN MANUAL */}
      {editingCell && (
        <div className="fixed inset-0 z-50 bg-zinc-900/60 flex items-center justify-center p-4" onClick={() => setEditingCell(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="flex justify-between items-start border-b border-zinc-200 pb-3 mb-4">
              <div>
                <h3 className="text-xl font-black text-zinc-900">Cambiar turno</h3>
                <p className="text-sm font-bold text-zinc-600">{editingCell.employeeName} · {editingCell.day}</p>
              </div>
              <button onClick={() => setEditingCell(null)} className="text-zinc-400 hover:text-zinc-900 text-2xl font-bold leading-none p-1" aria-label="Cerrar">✕</button>
            </div>
            <p className="text-sm text-zinc-600 mb-3">El resto del equipo se reorganiza solo para seguir cumpliendo las normas.</p>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {([
                ['M', config.shifts.M.label], ['T', config.shifts.T.label], ['N', config.shifts.N.label], ['S', config.shifts.S.label],
                ['L', 'Libre'], ['V', 'Vacaciones'], ['BP', 'Baja'], ['P', 'Petición'], ['F', 'Festivo'],
              ] as [string, string][]).map(([code, label]) => (
                <button key={code} type="button" onClick={() => applyOverride(code)}
                  className={`p-2.5 rounded-lg text-left ${shiftStyle(code)} ${editingCell.currentShift === code ? 'ring-4 ring-zinc-900/30' : ''}`}>
                  <div className="text-lg font-black leading-none">{displayShift(code, config)}</div>
                  <div className="text-xs font-bold mt-1 opacity-80">{label}</div>
                </button>
              ))}
            </div>
            <label className="block text-xs font-black text-zinc-800 mb-1">Horario manual</label>
            <div className="flex gap-2 mb-2">
              <input type="text" value={customManualShift} onChange={e => setCustomManualShift(e.target.value)} placeholder="Ej: 09-17"
                className="flex-1 px-3 py-2 border-2 border-zinc-300 rounded-lg text-sm font-black uppercase focus:outline-none focus:border-teal-600"
                onKeyDown={e => { if (e.key === 'Enter' && customManualShift.trim()) applyOverride(customManualShift.trim()); }} />
              <Button type="button" disabled={!customManualShift.trim()} onClick={() => applyOverride(customManualShift.trim())} className="bg-teal-700 hover:bg-teal-800 text-white text-xs px-4 rounded-lg">Asignar</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['09-17', '12-20', '07-15', '11-19', '14-22'].map(p => (
                <button key={p} type="button" onClick={() => applyOverride(p)} className="px-2 py-1 rounded text-xs font-black border bg-zinc-100 hover:bg-zinc-200 border-zinc-200">{p}</button>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-zinc-200 pt-4 mt-5">
              <Button type="button" variant="ghost" onClick={() => applyOverride(null)} className="text-xs font-bold">Volver a automático</Button>
              <Button type="button" onClick={() => setEditingCell(null)} className="bg-zinc-900 text-white text-sm px-6 rounded-lg">Cerrar</Button>
            </div>
          </div>
        </div>
      )}

      {/* LEYENDA */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {shiftLegend(config).map(l => (
            <span key={l.code} className="flex items-center gap-1.5 text-xs font-bold text-zinc-700">
              <span className={`min-w-7 h-7 px-1 rounded flex items-center justify-center font-black text-xs ${shiftStyle(l.code === displayShift('S', config) ? 'S' : l.code)}`}>{l.code}</span>
              {l.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs font-bold text-zinc-600 cursor-pointer">
            <input type="checkbox" checked={showRoles} onChange={e => setShowRoles(e.target.checked)} className="accent-zinc-900" /> Ver roles (solo tú)
          </label>
          {config.rules.nightPlus.enabled && (
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-600 cursor-pointer">
              <input type="checkbox" checked={showNight} onChange={e => setShowNight(e.target.checked)} className="accent-zinc-900" /> Ver plus de nocturnidad (solo tú)
            </label>
          )}
        </div>
      </div>

      {/* CUADRANTE */}
      <section className="overflow-x-auto border-2 border-zinc-300 bg-white shadow-md rounded-lg">
        <Table className="border-collapse w-full">
          <TableHeader className="bg-zinc-100">
            <TableRow className="border-b-2 border-zinc-300 hover:bg-transparent">
              <TableHead className="w-[200px] min-w-[170px] text-xs font-black uppercase text-zinc-700 py-4 px-4 border-r-2 border-zinc-300">Empleado</TableHead>
              {DAYS_OF_WEEK.map((day, i) => (
                <TableHead key={day} className="text-center py-3 px-2 border-r border-zinc-200">
                  <div className="text-xs md:text-sm font-black uppercase text-zinc-800">{day}</div>
                  <div className="mt-1 text-2xl font-black text-zinc-950">{addDaysISO(week, i).slice(8)}</div>
                </TableHead>
              ))}
              {nightPlus && (
                <TableHead className="text-center py-3 px-2 min-w-[130px] bg-indigo-50">
                  <div className="text-xs font-black uppercase text-indigo-950">Plus nocturnidad</div>
                  {nightPlus.final ? (
                    <div className="text-[11px] font-bold text-indigo-800 normal-case">Resultado de {nightPlus.label}<br />(cierre {fmtDay(nightPlus.closingDate!)})</div>
                  ) : (
                    <div className="text-[11px] font-bold text-indigo-800 normal-case">Acumulado de {nightPlus.label}<br />hasta el {fmtDay(nightPlus.to)}</div>
                  )}
                  <div className="text-[11px] text-indigo-700 normal-case">plus desde {nightPlus.threshold} h al mes</div>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {scheduleData.map(row => (
              <TableRow key={row.employeeId} className="border-b border-zinc-200 hover:bg-zinc-50/70">
                <TableCell className="border-r-2 border-zinc-300 bg-zinc-50/70 py-3 px-4">
                  <div className="text-base md:text-lg font-black uppercase text-zinc-950">{row.employeeName}</div>
                  {showRoles && <div className="text-xs font-bold text-zinc-500">{row.role}</div>}
                </TableCell>
                {row.shifts.map(s => {
                  const overridden = Boolean(weekOverrides[`${row.employeeId}|${s.day}`]);
                  const label = displayShift(s.shift, config);
                  return (
                    <TableCell key={s.day} className="p-1 border-r border-zinc-200 cursor-pointer relative select-none"
                      onClick={() => { setCustomManualShift(['M', 'T', 'N', 'S', 'L', 'V', 'BP', 'P', 'F'].includes(s.shift) ? '' : s.shift); setEditingCell({ employeeId: row.employeeId, employeeName: row.employeeName, day: s.day, currentShift: s.shift }); }}
                      title={`Cambiar el turno de ${row.employeeName} el ${s.day}`}>
                      <div className={`h-16 rounded flex items-center justify-center font-black ${label.length > 3 ? 'text-sm' : 'text-2xl md:text-3xl'} ${shiftStyle(s.shift)}`}>
                        {label}
                        {overridden && <span className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white" title="Cambio manual" />}
                      </div>
                    </TableCell>
                  );
                })}
                {nightPlus && (() => {
                  const p = plusOf(row.employeeId);
                  if (!p) {
                    return (
                      <TableCell className="text-center bg-indigo-50/50 px-2">
                        <span className="text-xs font-bold text-zinc-500">No aplica<br />(conserje de noche)</span>
                      </TableCell>
                    );
                  }
                  const hours = p.hours;
                  return (
                    <TableCell className="text-center bg-indigo-50/50 px-2" title={`${hours} h nocturnas en ${nightPlus.label}`}>
                      <div className="text-[11px] text-zinc-500 font-bold">{nightPlus.final ? 'Mes completo' : 'Llevas este mes'}</div>
                      <div className="text-2xl font-black text-zinc-950 leading-none">{hours} h</div>
                      <div className="text-[11px] text-zinc-500 mt-1">esta semana {weekNightHours(row.employeeId)} h</div>
                      {nightPlus.final ? (
                        <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-black ${p.plus ? 'bg-indigo-700 text-white' : 'bg-zinc-200 text-zinc-600'}`}>
                          {p.plus ? 'Sí tiene plus' : 'No tiene plus'}
                        </span>
                      ) : (
                        <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white border border-indigo-200 text-indigo-800">
                          Resultado el {fmtDay(nightPlus.closingDate!)}
                        </span>
                      )}
                    </TableCell>
                  );
                })()}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {/* RESUMEN POR DÍA */}
      <section className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {DAYS_OF_WEEK.map((day, d) => {
          const cov = config.coverage[day];
          const count = (code: string) => scheduleData.filter(r => r.shifts[d].shift === code).length;
          const team = morningTeam(config, day, count('M'), count('S'));
          const autoS = team - count('M');
          const items: [string, number, string, boolean][] = [
            [autoS > 0 ? `${config.shifts.M.label} (${autoS} de ${displayShift('S', config)})` : config.shifts.M.label, team, cov.M.min === cov.M.max ? `${cov.M.min}` : `${cov.M.min}-${cov.M.max}`, team >= cov.M.min && team <= cov.M.max],
            [config.shifts.T.label, count('T'), cov.T.min === cov.T.max ? `${cov.T.min}` : `${cov.T.min}-${cov.T.max}`, count('T') >= cov.T.min && count('T') <= cov.T.max],
            [config.shifts.N.label, count('N'), `${cov.N}`, count('N') >= cov.N],
            ...(cov.S.enabled ? [[displayShift('S', config), count('S'), `${cov.S.min}`, count('S') >= cov.S.min] as [string, number, string, boolean]] : []),
          ];
          const ok = items.every(i => i[3]);
          return (
            <div key={day} className="bg-white border-2 border-zinc-200 p-3 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-black text-zinc-900">{day}</p>
                <span className={`w-3 h-3 rounded-full ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`} title={ok ? 'Cubierto' : 'Revisar'} />
              </div>
              {items.map(([label, n, target, good]) => (
                <div key={label} className="flex justify-between items-baseline text-sm">
                  <span className="font-bold text-zinc-600">{label}</span>
                  <span className={`font-black ${good ? 'text-zinc-900' : 'text-rose-600'}`}>{n}<span className="text-xs text-zinc-400 font-bold"> / {target}</span></span>
                </div>
              ))}
            </div>
          );
        })}
      </section>

      <footer className="mt-12 border-t border-zinc-200 pt-6 text-xs text-zinc-500 flex flex-wrap justify-between gap-4">
        <span>Haz clic en cualquier casilla para cambiarla; el resto del cuadrante se reorganiza solo.</span>
        <span>Turnos · generación automática</span>
      </footer>
    </div>
  );
}
