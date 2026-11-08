import React, { useState } from 'react';
import { AppConfig, DayOfWeek, EmployeeConfig, PersonalRules, RoleKind, Shift, Tri, WorkShift } from '../types';
import { DAYS_OF_WEEK, countPersonalRules, defaultPersonalRules, effectiveRules, newEmployee } from '../constants';
import { normalizeConfig } from '../configMigration';
import { mondayOfISO, nightHoursOfShift } from '../scheduleService';
import { ChevronDown, ChevronUp, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface SetupFormProps {
  onSave: (config: AppConfig) => void;
  initialConfig: AppConfig;
}

type Tab = 'equipo' | 'normas' | 'cobertura' | 'horarios' | 'roles' | 'seguridad';
const TABS: { id: Tab; label: string }[] = [
  { id: 'equipo', label: 'Equipo' },
  { id: 'normas', label: 'Normas generales' },
  { id: 'cobertura', label: 'Personal por día' },
  { id: 'horarios', label: 'Horarios' },
  { id: 'roles', label: 'Roles' },
  { id: 'seguridad', label: 'Seguridad' },
];

// ─────────────── piezas pequeñas ───────────────

const Toggle = ({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) => (
  <label className="flex items-start gap-3 py-2 cursor-pointer select-none">
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`mt-0.5 relative shrink-0 w-10 h-6 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-zinc-900 ${on ? 'bg-emerald-600' : 'bg-zinc-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
    </button>
    <span>
      <span className="block text-sm font-bold text-zinc-900">{label}</span>
      {hint && <span className="block text-xs text-zinc-500 leading-snug mt-0.5">{hint}</span>}
    </span>
  </label>
);

const NumberInput = ({ value, onChange, min = 0, max = 99, className = '' }: { value: number; onChange: (v: number) => void; min?: number; max?: number; className?: string }) => (
  <input
    type="number"
    min={min}
    max={max}
    value={value}
    onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
    className={`w-14 px-1.5 py-1 border border-zinc-300 rounded-md text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-zinc-900 ${className}`}
  />
);

const Section = ({ title, children, hint }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="bg-white border border-zinc-200 rounded-xl p-4 space-y-1">
    <h3 className="text-base font-black text-zinc-900">{title}</h3>
    {hint && <p className="text-xs text-zinc-500 pb-1">{hint}</p>}
    {children}
  </section>
);

/** Selector de norma por empleado: como la general, sí o no. */
const TriSelect = ({ value, general, onChange, label, children }: { value: Tri; general: boolean; onChange: (v: Tri) => void; label: string; children?: React.ReactNode }) => (
  <div className="py-2 border-b border-zinc-100 last:border-0">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className={`text-sm font-bold ${value === 'default' ? 'text-zinc-700' : 'text-indigo-900'}`}>{label}</span>
      <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-xs font-bold">
        {([['default', `General (${general ? 'sí' : 'no'})`], ['on', 'Sí'], ['off', 'No']] as [Tri, string][]).map(([v, l]) => (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={`px-2.5 py-1.5 ${value === v ? (v === 'default' ? 'bg-zinc-700 text-white' : 'bg-indigo-700 text-white') : 'bg-white text-zinc-600 hover:bg-zinc-50'}`}>{l}</button>
        ))}
      </div>
    </div>
    {children}
  </div>
);

// ─────────────── formulario ───────────────

export default function SetupForm({ onSave, initialConfig }: SetupFormProps) {
  const [config, setConfig] = useState<AppConfig>(() => normalizeConfig(structuredClone(initialConfig)));
  const [tab, setTab] = useState<Tab>('equipo');
  const [openEmp, setOpenEmp] = useState<string | null>(null);

  const set = (patch: Partial<AppConfig>) => setConfig(c => ({ ...c, ...patch }));
  const setRules = (patch: Partial<AppConfig['rules']>) => setConfig(c => ({ ...c, rules: { ...c.rules, ...patch } }));
  const updateEmp = (id: string, patch: Partial<EmployeeConfig>) =>
    setConfig(c => ({ ...c, employees: c.employees.map(e => (e.id === id ? { ...e, ...patch } : e)) }));
  const moveEmp = (id: string, dir: -1 | 1) => setConfig(c => {
    const list = [...c.employees];
    const i = list.findIndex(e => e.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return c;
    [list[i], list[j]] = [list[j], list[i]];
    return { ...c, employees: list };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...config, isConfigured: true, rotationStartDate: mondayOfISO(config.rotationStartDate) });
  };

  const roleName = (id: string) => config.roles.find(r => r.id === id)?.name || 'Sin rol';

  // ── EQUIPO ──
  const renderEmployee = (emp: EmployeeConfig, index: number) => {
    const open = openEmp === emp.id;
    const flags = [
      emp.permanentNight && 'Noche fija',
      emp.nightRotation && 'Rota noches',
      emp.weekendRotation && 'Rota fin de semana',
      emp.morningOnlyDays.length === 7 ? 'Siempre de mañana' : emp.morningOnlyDays.length > 0 && `Mañana: ${DAYS_OF_WEEK.filter(d => emp.morningOnlyDays.includes(d)).map(d => d.slice(0, 2)).join('-')}`,
      emp.fixedOffDays.length > 0 && `Libra ${emp.fixedOffDays.map(d => d.slice(0, 3)).join('-')}`,
      countPersonalRules(emp) > 0 && `${countPersonalRules(emp)} ${countPersonalRules(emp) === 1 ? 'norma propia' : 'normas propias'}`,
    ].filter(Boolean) as string[];
    const pr = emp.rules || defaultPersonalRules();
    const setPR = (patch: Partial<PersonalRules>) => updateEmp(emp.id, { rules: { ...pr, ...patch } });
    const eff = effectiveRules(config, emp);
    const g = config.rules;

    const toggleOff = (day: DayOfWeek) => {
      const has = emp.fixedOffDays.includes(day);
      updateEmp(emp.id, { fixedOffDays: has ? emp.fixedOffDays.filter(d => d !== day) : DAYS_OF_WEEK.filter(d => d === day || emp.fixedOffDays.includes(d)) });
    };
    const setFixedShift = (day: DayOfWeek, value: string) => {
      const next = { ...emp.fixedShifts };
      if (value) next[day] = value as Shift; else delete next[day];
      updateEmp(emp.id, { fixedShifts: next });
    };

    return (
      <div key={emp.id} className={`border rounded-xl ${emp.active ? 'border-zinc-200 bg-white' : 'border-dashed border-zinc-300 bg-zinc-50 opacity-70'}`}>
        <div className="flex items-center gap-2 p-3">
          <div className="flex flex-col">
            <button type="button" onClick={() => moveEmp(emp.id, -1)} disabled={index === 0} className="p-0.5 text-zinc-400 hover:text-zinc-900 disabled:opacity-20" aria-label="Subir"><ArrowUp className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => moveEmp(emp.id, 1)} disabled={index === config.employees.length - 1} className="p-0.5 text-zinc-400 hover:text-zinc-900 disabled:opacity-20" aria-label="Bajar"><ArrowDown className="w-3.5 h-3.5" /></button>
          </div>
          <input
            value={emp.name}
            onChange={e => updateEmp(emp.id, { name: e.target.value.toUpperCase() })}
            placeholder="Nombre"
            className="flex-1 min-w-0 px-3 py-2 border border-zinc-200 rounded-lg font-black text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <select
            value={emp.roleId}
            onChange={e => updateEmp(emp.id, { roleId: e.target.value })}
            className="px-2 py-2 border border-zinc-200 rounded-lg text-sm font-bold bg-white max-w-[45%]"
          >
            {config.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button type="button" onClick={() => setOpenEmp(open ? null : emp.id)} className="p-2 rounded-lg hover:bg-zinc-100" aria-label={open ? 'Cerrar opciones' : 'Abrir opciones'}>
            {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
        {!open && flags.length > 0 && (
          <div className="px-3 pb-3 -mt-1 flex flex-wrap gap-1">
            {!emp.active && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-300 text-zinc-700">Desactivado</span>}
            {flags.map(f => <span key={f} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">{f}</span>)}
          </div>
        )}
        {open && (
          <div className="border-t border-zinc-100 p-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
            <div>
              <Toggle on={emp.active} onChange={v => updateEmp(emp.id, { active: v })} label="Entra en el cuadrante" hint="Desactívalo para quitarlo temporalmente sin borrarlo." />
              <p className="text-xs font-black text-zinc-700 mt-3 mb-1">Turnos que puede hacer</p>
              <div className="grid grid-cols-2 gap-x-3">
                <Toggle on={emp.canMorning} onChange={v => updateEmp(emp.id, { canMorning: v })} label={config.shifts.M.label} />
                <Toggle on={emp.canAfternoon} onChange={v => updateEmp(emp.id, { canAfternoon: v })} label={config.shifts.T.label} />
                <Toggle on={emp.canNight} onChange={v => updateEmp(emp.id, { canNight: v, ...(v ? {} : { nightRotation: false, permanentNight: false }) })} label={config.shifts.N.label} />
                <Toggle on={emp.canSpecial} onChange={v => updateEmp(emp.id, { canSpecial: v })} label={config.shifts.S.label} />
              </div>
              <p className="text-xs font-black text-zinc-700 mt-3 mb-1">Preferencia de turno</p>
              <div className="flex gap-1">
                {(['none', 'M', 'T'] as const).map(p => (
                  <button key={p} type="button" onClick={() => updateEmp(emp.id, { preferredShift: p })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${emp.preferredShift === p ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white border-zinc-200 text-zinc-700'}`}>
                    {p === 'none' ? 'Sin preferencia' : config.shifts[p].label}
                  </button>
                ))}
              </div>
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-sm font-black text-zinc-900">Trabajar solo de mañana</p>
                <p className="text-xs text-zinc-600 mb-2">Los días marcados, si trabaja, siempre es de {config.shifts.M.label.toLowerCase()}. Sus días libres los sigue decidiendo el sistema.</p>
                <div className="flex gap-1 mb-2">
                  {([['all', 'Siempre de mañana', DAYS_OF_WEEK], ['none', 'Ningún día', []]] as [string, string, DayOfWeek[]][]).map(([k, l, days]) => {
                    const active = k === 'all' ? emp.morningOnlyDays.length === 7 : emp.morningOnlyDays.length === 0;
                    return (
                      <button key={k} type="button" onClick={() => updateEmp(emp.id, { morningOnlyDays: [...days], ...(days.length ? { canMorning: true } : {}) })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${active ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-zinc-200 text-zinc-700'}`}>{l}</button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-1">
                  {DAYS_OF_WEEK.map(day => {
                    const on = emp.morningOnlyDays.includes(day);
                    return (
                      <button key={day} type="button" aria-pressed={on}
                        onClick={() => updateEmp(emp.id, { canMorning: true, morningOnlyDays: on ? emp.morningOnlyDays.filter(d => d !== day) : DAYS_OF_WEEK.filter(d => d === day || emp.morningOnlyDays.includes(d)) })}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${on ? 'bg-amber-100 text-amber-950 border-amber-400' : 'bg-white border-zinc-200 text-zinc-500'}`}>
                        {on ? '✓ ' : ''}{day}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div>
              <Toggle on={emp.permanentNight} onChange={v => updateEmp(emp.id, { permanentNight: v, ...(v ? { canNight: true, nightRotation: false, weekendRotation: false } : {}) })}
                label="Trabaja siempre de noche" hint="Como el conserje de noche: todos sus días de trabajo son noche." />
              <Toggle on={emp.nightRotation} onChange={v => updateEmp(emp.id, { nightRotation: v, ...(v ? { canNight: true, permanentNight: false } : {}) })}
                label="Entra en la rotación de noches" hint="Cubre por turnos las noches que no cubre nadie fijo." />
              <Toggle on={emp.weekendRotation} onChange={v => updateEmp(emp.id, { weekendRotation: v })}
                label="Entra en la rotación de fin de semana libre" hint="Una semana de cada cierto tiempo librará sábado y domingo." />
              <p className="text-xs font-black text-zinc-700 mt-3 mb-1">Al salir de noche</p>
              <div className="grid grid-cols-2 gap-1">
                {([['default', `Norma general (${g.postNight.enabled ? (g.postNight.defaultBehaviour === 'Afternoon' ? 'tarde' : '2 libres') : 'sin norma'})`], ['Afternoon', 'Tarde al día siguiente'], ['Off', '2 días libres'], ['none', 'Sin norma']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => updateEmp(emp.id, { postNight: v })}
                    className={`px-2 py-1.5 rounded-lg text-xs font-bold border leading-tight ${emp.postNight === v ? 'bg-indigo-700 text-white border-indigo-700' : 'bg-white border-zinc-200 text-zinc-700'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 mt-2 bg-indigo-50/40 border border-indigo-100 rounded-xl px-4 py-2">
              <p className="text-sm font-black text-zinc-900 pt-1">Normas de esta persona</p>
              <p className="text-xs text-zinc-500 pb-1">«General» sigue la norma de la pestaña Normas. «Sí» o «No» se aplica solo a {emp.name || 'esta persona'}.</p>
              <TriSelect label={`Jornada fija: trabaja ${eff.workDays} días y libra ${7 - eff.workDays}`} value={pr.weeklyDays} general={g.weeklyDays.enabled} onChange={v => setPR({ weeklyDays: v })}>
                {eff.weeklyOn && (
                  <div className="flex items-center gap-2 text-xs mt-1.5 text-zinc-600">
                    Días trabajados por semana:
                    <NumberInput value={eff.workDays} min={1} max={7} onChange={v => setPR({ workDays: v })} />
                    {pr.workDays !== null && <button type="button" onClick={() => setPR({ workDays: null })} className="font-bold text-indigo-700">Usar los generales ({g.weeklyDays.workDays})</button>}
                  </div>
                )}
              </TriSelect>
              <TriSelect label="Días libres seguidos" value={pr.consecutiveOffs} general={g.consecutiveOffs} onChange={v => setPR({ consecutiveOffs: v })} />
              <TriSelect label={`Descanso mínimo de ${eff.restHours} h entre turnos`} value={pr.minRest} general={g.minRest.enabled} onChange={v => setPR({ minRest: v })}>
                {eff.restOn && (
                  <div className="flex items-center gap-2 text-xs mt-1.5 text-zinc-600">
                    Horas:
                    <NumberInput value={eff.restHours} min={0} max={24} onChange={v => setPR({ restHours: v })} />
                    {pr.restHours !== null && <button type="button" onClick={() => setPR({ restHours: null })} className="font-bold text-indigo-700">Usar las generales ({g.minRest.hours} h)</button>}
                  </div>
                )}
              </TriSelect>
              <TriSelect label="Vacaciones y bajas cuentan como días libres" value={pr.absencesCountAsOff} general={g.absencesCountAsOff} onChange={v => setPR({ absencesCountAsOff: v })} />
              <TriSelect label="Reparto justo de tardes con el resto" value={pr.fairRotation} general={g.fairRotation} onChange={v => setPR({ fairRotation: v })} />
              {countPersonalRules(emp) > 0 && (
                <button type="button" onClick={() => updateEmp(emp.id, { rules: defaultPersonalRules(), postNight: 'default' })} className="text-xs font-bold text-indigo-700 py-2">
                  Volver a las normas generales
                </button>
              )}
            </div>
            <div className="md:col-span-2 mt-2">
              <p className="text-xs font-black text-zinc-700 mb-1">Días libres fijos</p>
              <div className="flex flex-wrap gap-1">
                {DAYS_OF_WEEK.map(day => (
                  <button key={day} type="button" onClick={() => toggleOff(day)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${emp.fixedOffDays.includes(day) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-zinc-200 text-zinc-600'}`}>
                    {day}
                  </button>
                ))}
              </div>
              <p className="text-xs font-black text-zinc-700 mt-3 mb-1">Turno fijo por día <span className="font-normal text-zinc-500">(Auto = lo decide el sistema)</span></p>
              <div className="grid grid-cols-7 gap-1">
                {DAYS_OF_WEEK.map(day => (
                  <label key={day} className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-bold text-zinc-500">{day.slice(0, 2)}</span>
                    <select value={emp.fixedShifts[day] || ''} onChange={e => setFixedShift(day, e.target.value)}
                      className="w-full text-xs font-bold py-1 border border-zinc-200 rounded-md bg-white text-center">
                      <option value="">Auto</option>
                      <option value="M">M</option>
                      <option value="T">T</option>
                      <option value="N">N</option>
                      <option value="S">{config.shifts.S.start.slice(0, 2)}-{config.shifts.S.end.slice(0, 2)}</option>
                      <option value="L">L</option>
                    </select>
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2 flex justify-end pt-2">
              <button type="button" onClick={() => { if (confirm(`¿Borrar a ${emp.name || 'este empleado'}?`)) set({ employees: config.employees.filter(e => e.id !== emp.id) }); }}
                className="flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-900 px-3 py-1.5 rounded-lg hover:bg-rose-50">
                <Trash2 className="w-4 h-4" /> Borrar empleado
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const tabEquipo = (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">El orden de la lista es el orden del cuadrante y el orden en que empiezan las rotaciones. Abre cada persona para ver todas sus opciones.</p>
      {config.employees.map(renderEmployee)}
      <button type="button" onClick={() => { const e = newEmployee(); set({ employees: [...config.employees, e] }); setOpenEmp(e.id); }}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-zinc-300 rounded-xl text-sm font-black text-zinc-600 hover:border-zinc-900 hover:text-zinc-900">
        <Plus className="w-4 h-4" /> Añadir empleado
      </button>
    </div>
  );

  // ── NORMAS ──
  const r = config.rules;
  const tabNormas = (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600 bg-indigo-50 border border-indigo-100 rounded-xl p-3">
        Estas son las normas generales. Se aplican a todo el que no tenga una norma propia: en <b>Equipo</b>, abre a cada persona y cambia sus normas en «Normas de esta persona».
      </p>
      <Section title="Jornada">
        <Toggle on={r.weeklyDays.enabled} onChange={v => setRules({ weeklyDays: { ...r.weeklyDays, enabled: v } })}
          label={`Trabajar ${r.weeklyDays.workDays} días y librar ${7 - r.weeklyDays.workDays}`} hint="Cada empleado trabaja exactamente estos días a la semana." />
        {r.weeklyDays.enabled && (
          <div className="flex items-center gap-2 ml-[52px] text-sm">
            Días trabajados por semana: <NumberInput value={r.weeklyDays.workDays} min={1} max={7} onChange={v => setRules({ weeklyDays: { ...r.weeklyDays, workDays: v } })} />
          </div>
        )}
        <Toggle on={r.consecutiveOffs} onChange={v => setRules({ consecutiveOffs: v })} label="Días libres seguidos" hint="Los días libres de la semana van juntos." />
        <Toggle on={r.absencesCountAsOff} onChange={v => setRules({ absencesCountAsOff: v })} label="Vacaciones y bajas cuentan como días libres"
          hint="Si está activo, quien tiene 2 días de vacaciones esa semana no libra además otros 2." />
        <Toggle on={r.minRest.enabled} onChange={v => setRules({ minRest: { ...r.minRest, enabled: v } })} label={`Descanso mínimo de ${r.minRest.hours} h entre turnos`}
          hint="Evita, por ejemplo, salir de tarde a medianoche y entrar de mañana al día siguiente." />
        {r.minRest.enabled && (
          <div className="flex items-center gap-2 ml-[52px] text-sm">Horas: <NumberInput value={r.minRest.hours} min={0} max={24} onChange={v => setRules({ minRest: { ...r.minRest, hours: v } })} /></div>
        )}
      </Section>

      <Section title="Rotaciones">
        <Toggle on={r.weekendRotation} onChange={v => setRules({ weekendRotation: v })} label="Fin de semana libre rotativo"
          hint="Cada semana una persona distinta libra sábado y domingo. Nadie repite hasta que todos lo han tenido." />
        <Toggle on={r.nightRotation.enabled} onChange={v => setRules({ nightRotation: { ...r.nightRotation, enabled: v } })} label="Noches rotativas"
          hint="Las noches que no cubre el personal fijo de noche las hace cada semana una persona distinta de la rotación." />
        {r.nightRotation.enabled && (
          <div className="flex items-center gap-2 ml-[52px] text-sm">Noches seguidas por persona: <NumberInput value={r.nightRotation.nightsPerBlock} min={1} max={7} onChange={v => setRules({ nightRotation: { ...r.nightRotation, nightsPerBlock: v } })} /></div>
        )}
        <Toggle on={r.fairRotation} onChange={v => setRules({ fairRotation: v })} label="Repartir tardes y turnos especiales con justicia"
          hint="Tiene en cuenta las semanas anteriores para que nadie acumule más tardes que el resto." />
      </Section>

      <Section title="Turno especial automático">
        <Toggle on={r.autoSpecial.enabled} onChange={v => setRules({ autoSpecial: { ...r.autoSpecial, enabled: v } })}
          label={`Con ${r.autoSpecial.threshold} o más de mañana, ${r.autoSpecial.count === 1 ? 'una hace' : `${r.autoSpecial.count} hacen`} ${config.shifts.S.start.slice(0, 2)}-${config.shifts.S.end.slice(0, 2)}`}
          hint="Ese día una de las personas de mañana pasa al turno especial. Se reparte por turnos entre quienes tienen activado «Especial» y no tienen ese día como «solo de mañana»." />
        {r.autoSpecial.enabled && (
          <div className="flex flex-wrap items-center gap-2 ml-[52px] text-sm">
            Cuando haya <NumberInput value={r.autoSpecial.threshold} min={1} max={20} onChange={v => setRules({ autoSpecial: { ...r.autoSpecial, threshold: v } })} /> o más de mañana,
            <NumberInput value={r.autoSpecial.count} min={1} max={10} onChange={v => setRules({ autoSpecial: { ...r.autoSpecial, count: v } })} /> pasa(n) al especial.
          </div>
        )}
      </Section>

      <Section title="Plus de nocturnidad">
        <Toggle on={r.nightPlus.enabled} onChange={v => setRules({ nightPlus: { ...r.nightPlus, enabled: v } })}
          label={`Plus con ${r.nightPlus.threshold} h o más de noche ${r.nightPlus.period === 'month' ? 'al mes' : 'a la semana'}`}
          hint={`Cuenta las horas trabajadas entre las ${r.nightPlus.start} y las ${r.nightPlus.end}. Con los horarios actuales: ${config.shifts.T.label.toLowerCase()} = ${nightHoursOfShift('T', config)} h, ${config.shifts.N.label.toLowerCase()} = ${nightHoursOfShift('N', config)} h, ${config.shifts.M.label.toLowerCase()} = ${nightHoursOfShift('M', config)} h.`} />
        {r.nightPlus.enabled && (
          <div className="ml-[52px] space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              Franja nocturna de
              <input type="time" value={r.nightPlus.start} onChange={e => setRules({ nightPlus: { ...r.nightPlus, start: e.target.value } })} className="px-2 py-1 border border-zinc-300 rounded-md font-bold" />
              a
              <input type="time" value={r.nightPlus.end} onChange={e => setRules({ nightPlus: { ...r.nightPlus, end: e.target.value } })} className="px-2 py-1 border border-zinc-300 rounded-md font-bold" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              Plus desde <NumberInput value={r.nightPlus.threshold} min={1} max={300} onChange={v => setRules({ nightPlus: { ...r.nightPlus, threshold: v } })} /> horas
              <select value={r.nightPlus.period} onChange={e => setRules({ nightPlus: { ...r.nightPlus, period: e.target.value as 'month' | 'week' } })} className="px-2 py-1 border border-zinc-300 rounded-md font-bold bg-white">
                <option value="month">al mes</option>
                <option value="week">a la semana</option>
              </select>
            </div>
          </div>
        )}
      </Section>

      <Section title="Salida de noche">
        <Toggle on={r.postNight.enabled} onChange={v => setRules({ postNight: { ...r.postNight, enabled: v } })} label="Aplicar norma al salir de noche"
          hint="Cada empleado puede tener su propia opción en Equipo; si no, se usa esta." />
        {r.postNight.enabled && (
          <div className="grid grid-cols-2 gap-2 ml-[52px]">
            {([['Afternoon', 'Tarde al día siguiente'], ['Off', '2 días libres']] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setRules({ postNight: { ...r.postNight, defaultBehaviour: v } })}
                className={`px-3 py-2 rounded-lg text-sm font-bold border ${r.postNight.defaultBehaviour === v ? 'bg-indigo-700 text-white border-indigo-700' : 'bg-white border-zinc-200'}`}>{l}</button>
            ))}
          </div>
        )}
      </Section>

      <Section title="Tardes">
        <Toggle on={r.noTwoHelpersAfternoon} onChange={v => setRules({ noTwoHelpersAfternoon: v })} label="Nunca dos ayudantes juntos de tarde" />
        <Toggle on={r.receptionistRequiredAfternoon} onChange={v => setRules({ receptionistRequiredAfternoon: v })} label="Siempre un recepcionista de tarde"
          hint="Cuentan como recepcionista los roles marcados como «Recepción» en Roles." />
      </Section>

      <Section title="Inicio de las rotaciones" hint="Las rotaciones se calculan semana a semana desde este lunes. Cámbialo solo si quieres reiniciar el orden.">
        <input type="date" value={config.rotationStartDate} onChange={e => set({ rotationStartDate: e.target.value })}
          className="px-3 py-2 border border-zinc-300 rounded-lg text-sm font-bold" />
      </Section>
    </div>
  );

  // ── COBERTURA ──
  const setCov = (day: DayOfWeek, path: string, value: number | boolean) => setConfig(c => {
    const cov = structuredClone(c.coverage);
    const [a, b] = path.split('.');
    (cov[day] as any)[a] = b ? { ...(cov[day] as any)[a], [b]: value } : value;
    return { ...c, coverage: cov };
  });
  const copyToAll = (from: DayOfWeek, days: DayOfWeek[]) => setConfig(c => {
    const cov = structuredClone(c.coverage);
    days.forEach(d => { cov[d] = structuredClone(c.coverage[from]); });
    return { ...c, coverage: cov };
  });
  const tabCobertura = (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">Mínimo y máximo de personas en cada turno. Si sobra personal, el sistema lo coloca hasta el máximo; si falta, te avisa.</p>
      <div className="overflow-x-auto bg-white border border-zinc-200 rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-700">
            <tr>
              <th className="text-left p-2 font-black">Día</th>
              <th className="p-2 font-black">{config.shifts.M.label}<br /><span className="font-normal text-xs">mín / máx</span></th>
              <th className="p-2 font-black">{config.shifts.T.label}<br /><span className="font-normal text-xs">mín / máx</span></th>
              <th className="p-2 font-black">{config.shifts.N.label}</th>
              <th className="p-2 font-black">{config.shifts.S.label} {config.shifts.S.start}-{config.shifts.S.end}<br /><span className="font-normal text-xs">activo · mín / máx</span></th>
            </tr>
          </thead>
          <tbody>
            {DAYS_OF_WEEK.map(day => {
              const c = config.coverage[day];
              return (
                <tr key={day} className="border-t border-zinc-100">
                  <td className="p-2 font-bold whitespace-nowrap">{day}</td>
                  <td className="p-2 text-center whitespace-nowrap"><NumberInput value={c.M.min} onChange={v => setCov(day, 'M.min', v)} /> <NumberInput value={c.M.max} onChange={v => setCov(day, 'M.max', v)} /></td>
                  <td className="p-2 text-center whitespace-nowrap"><NumberInput value={c.T.min} onChange={v => setCov(day, 'T.min', v)} /> <NumberInput value={c.T.max} onChange={v => setCov(day, 'T.max', v)} /></td>
                  <td className="p-2 text-center"><NumberInput value={c.N} onChange={v => setCov(day, 'N', v)} /></td>
                  <td className="p-2 text-center whitespace-nowrap">
                    <input type="checkbox" checked={c.S.enabled} onChange={e => setCov(day, 'S.enabled', e.target.checked)} className="w-4 h-4 mr-2 align-middle accent-fuchsia-600" aria-label={`Turno especial ${day}`} />
                    <NumberInput value={c.S.min} onChange={v => setCov(day, 'S.min', v)} className={c.S.enabled ? '' : 'opacity-40'} /> <NumberInput value={c.S.max} onChange={v => setCov(day, 'S.max', v)} className={c.S.enabled ? '' : 'opacity-40'} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => copyToAll(DayOfWeek.Monday, [DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday])} className="px-3 py-2 text-xs font-bold border border-zinc-300 rounded-lg bg-white hover:bg-zinc-50">Copiar lunes a martes–jueves</button>
        <button type="button" onClick={() => copyToAll(DayOfWeek.Friday, [DayOfWeek.Saturday, DayOfWeek.Sunday])} className="px-3 py-2 text-xs font-bold border border-zinc-300 rounded-lg bg-white hover:bg-zinc-50">Copiar viernes a sábado y domingo</button>
        <button type="button" onClick={() => setConfig(c => { const cov = structuredClone(c.coverage); [DayOfWeek.Friday, DayOfWeek.Saturday, DayOfWeek.Sunday].forEach(d => { cov[d].S.enabled = !c.coverage[DayOfWeek.Friday].S.enabled; }); return { ...c, coverage: cov }; })}
          className="px-3 py-2 text-xs font-bold border border-fuchsia-300 text-fuchsia-900 rounded-lg bg-fuchsia-50 hover:bg-fuchsia-100">
          {config.coverage[DayOfWeek.Friday].S.enabled ? 'Quitar' : 'Poner'} turno especial viernes a domingo
        </button>
      </div>
    </div>
  );

  // ── HORARIOS ──
  const setShift = (code: WorkShift, field: 'label' | 'start' | 'end', value: string) =>
    setConfig(c => ({ ...c, shifts: { ...c.shifts, [code]: { ...c.shifts[code], [field]: value } } }));
  const tabHorarios = (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">Nombre y horario de cada turno. El turno especial aparece en el cuadrante con su horario (por ejemplo 10-18).</p>
      {(['M', 'T', 'N', 'S'] as WorkShift[]).map(code => (
        <div key={code} className="flex flex-wrap items-center gap-2 bg-white border border-zinc-200 rounded-xl p-3">
          <span className="w-8 h-8 rounded-md bg-zinc-900 text-white font-black flex items-center justify-center">{code}</span>
          <input value={config.shifts[code].label} onChange={e => setShift(code, 'label', e.target.value)} className="flex-1 min-w-[120px] px-3 py-2 border border-zinc-200 rounded-lg font-bold" />
          <input type="time" value={config.shifts[code].start} onChange={e => setShift(code, 'start', e.target.value)} className="px-2 py-2 border border-zinc-200 rounded-lg font-bold" aria-label="Entrada" />
          <span className="text-zinc-400">a</span>
          <input type="time" value={config.shifts[code].end} onChange={e => setShift(code, 'end', e.target.value)} className="px-2 py-2 border border-zinc-200 rounded-lg font-bold" aria-label="Salida" />
        </div>
      ))}
    </div>
  );

  // ── ROLES ──
  const kindLabel: Record<RoleKind, string> = { recepcion: 'Recepción', ayudante: 'Ayudante', otro: 'Otro' };
  const tabRoles = (
    <div className="space-y-3">
      <p className="text-sm text-zinc-600">Los roles solo los ve el administrador. El tipo decide cómo cuenta cada rol en las normas de la tarde.</p>
      {config.roles.map(role => {
        const used = config.employees.filter(e => e.roleId === role.id).length;
        return (
          <div key={role.id} className="flex flex-wrap items-center gap-2 bg-white border border-zinc-200 rounded-xl p-3">
            <input value={role.name} onChange={e => set({ roles: config.roles.map(x => (x.id === role.id ? { ...x, name: e.target.value } : x)) })}
              className="flex-1 min-w-[160px] px-3 py-2 border border-zinc-200 rounded-lg font-bold" />
            <select value={role.kind} onChange={e => set({ roles: config.roles.map(x => (x.id === role.id ? { ...x, kind: e.target.value as RoleKind } : x)) })}
              className="px-2 py-2 border border-zinc-200 rounded-lg text-sm font-bold bg-white">
              {(Object.keys(kindLabel) as RoleKind[]).map(k => <option key={k} value={k}>{kindLabel[k]}</option>)}
            </select>
            <span className="text-xs text-zinc-500 w-24 text-right">{used} {used === 1 ? 'persona' : 'personas'}</span>
            <button type="button" disabled={used > 0} title={used > 0 ? 'Cambia antes el rol de quien lo tiene' : 'Borrar rol'}
              onClick={() => set({ roles: config.roles.filter(x => x.id !== role.id) })}
              className="p-2 text-zinc-400 hover:text-rose-700 disabled:opacity-25" aria-label="Borrar rol"><Trash2 className="w-4 h-4" /></button>
          </div>
        );
      })}
      <button type="button" onClick={() => set({ roles: [...config.roles, { id: `role-${Date.now()}`, name: 'Nuevo rol', kind: 'otro' }] })}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-zinc-300 rounded-xl text-sm font-black text-zinc-600 hover:border-zinc-900 hover:text-zinc-900">
        <Plus className="w-4 h-4" /> Añadir rol
      </button>
    </div>
  );

  // ── SEGURIDAD ──
  const tabSeguridad = (
    <div className="space-y-3">
      <Section title="PIN del administrador" hint="Lo pide al abrir el panel. Los empleados solo entran por su enlace y nunca ven roles ni ajustes. Déjalo vacío para quitar el bloqueo.">
        <input type="text" inputMode="numeric" value={config.security.adminPin}
          onChange={e => set({ security: { ...config.security, adminPin: e.target.value.trim() } })}
          className="px-3 py-2 border border-zinc-300 rounded-lg text-lg font-black tracking-[0.3em] w-40" placeholder="Sin PIN" />
        {!config.security.adminPin && <p className="text-xs font-bold text-amber-700 pt-1">Sin PIN, cualquiera que abra la dirección principal puede ver los roles.</p>}
      </Section>
      <Section title="Nombre del responsable" hint="Aparece en los avisos que envían los empleados.">
        <input value={config.managerName} onChange={e => set({ managerName: e.target.value })} className="px-3 py-2 border border-zinc-300 rounded-lg font-bold" />
      </Section>
    </div>
  );

  const content: Record<Tab, React.ReactNode> = {
    equipo: tabEquipo, normas: tabNormas, cobertura: tabCobertura, horarios: tabHorarios, roles: tabRoles, seguridad: tabSeguridad,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <nav className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1" aria-label="Secciones de ajustes">
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-black whitespace-nowrap ${tab === t.id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="min-h-[300px]">{content[tab]}</div>
      <button type="submit" className="sticky bottom-0 w-full py-4 bg-zinc-900 text-white rounded-xl font-black text-base hover:bg-zinc-800 shadow-lg">
        Guardar y generar cuadrante
      </button>
    </form>
  );
}
