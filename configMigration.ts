import { AppConfig, DayOfWeek, EmployeeConfig, Shift } from './types';
import {
  DAYS_OF_WEEK, DEFAULT_CONFIG, DEFAULT_ROLES, DEFAULT_RULES, DEFAULT_SHIFTS,
  defaultCoverage, defaultPersonalRules, getMondayISO, newEmployee, toISODate,
} from './constants';

const isDay = (d: any): d is DayOfWeek => DAYS_OF_WEEK.includes(d);

/** Lunes de una semana ISO (año, semana). */
const isoWeekMonday = (year: number, week: number): string => {
  const jan4 = new Date(year, 0, 4);
  const day = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - day + 1 + (week - 1) * 7);
  return toISODate(monday);
};

/** Convierte los cambios manuales del formato antiguo ("2026-w38" / "rec-0-Lunes"). */
export const migrateOldOverrides = (old: Record<string, Record<string, Shift>> | null | undefined) => {
  const out: Record<string, Record<string, Shift>> = {};
  if (!old) return out;
  Object.entries(old).forEach(([weekKey, cells]) => {
    const m = /^(\d{4})-w(\d{1,2})$/.exec(weekKey);
    if (!m) return;
    const monday = isoWeekMonday(Number(m[1]), Number(m[2]));
    out[monday] = {};
    Object.entries(cells || {}).forEach(([cellKey, shift]) => {
      const idx = cellKey.lastIndexOf('-');
      if (idx <= 0) return;
      const empId = cellKey.slice(0, idx);
      const day = cellKey.slice(idx + 1);
      if (isDay(day)) out[monday][`${empId}|${day}`] = shift;
    });
  });
  return out;
};

/** Convierte la configuración antigua (jefe/subjefe/conserje/recepcionistas/ayudantes) a la nueva. */
const migrateV1 = (old: any): AppConfig => {
  const fixedOff: Record<string, DayOfWeek[]> = old.fixedOffDays || {};
  const fixedShifts: Record<string, Partial<Record<DayOfWeek, Shift>>> = old.fixedShifts || {};
  const prefs: Record<string, any> = old.employeePostNightPreferences || {};
  const offs = (id: string, fallback: DayOfWeek[] = []) => (fixedOff[id] || fallback).filter(isDay);
  const shifts = (id: string) => fixedShifts[id] || {};
  const pref = (id: string, name: string) => prefs[id] || prefs[name] || 'default';

  const employees: EmployeeConfig[] = [];
  if (old.jefe?.trim()) employees.push(newEmployee({
    id: 'jefe', name: old.jefe, roleId: 'role-jefe', canAfternoon: false, canSpecial: false,
    weekendRotation: false, preferredShift: 'M', fixedOffDays: offs('jefe', [DayOfWeek.Friday, DayOfWeek.Saturday]), fixedShifts: shifts('jefe'),
  }));
  if (old.subjefe?.trim()) employees.push(newEmployee({
    id: 'subjefe', name: old.subjefe, roleId: 'role-subjefe', weekendRotation: false, preferredShift: 'M',
    fixedOffDays: offs('subjefe', [DayOfWeek.Sunday, DayOfWeek.Monday]), fixedShifts: shifts('subjefe'),
  }));
  if (old.conserje?.trim()) employees.push(newEmployee({
    id: 'conserje', name: old.conserje, roleId: 'role-conserje', canMorning: false, canAfternoon: false,
    canSpecial: false, canNight: true, permanentNight: true, weekendRotation: false,
    fixedOffDays: offs('conserje'), fixedShifts: shifts('conserje'),
  }));
  (old.recepcionistas || []).forEach((name: string, i: number) => {
    if (!name?.trim()) return;
    const id = `rec-${i}`;
    employees.push(newEmployee({
      id, name, roleId: 'role-recepcionista', canNight: true, nightRotation: true,
      postNight: pref(id, name), fixedOffDays: offs(id), fixedShifts: shifts(id),
    }));
  });
  // El código antiguo ocultaba siempre a LORENA y numeraba al resto sin ella: se mantiene igual.
  (old.ayudantes || []).filter((name: string) => name?.trim().toUpperCase() !== 'LORENA').forEach((name: string, i: number) => {
    if (!name?.trim()) return;
    const id = `ayu-${i}`;
    employees.push(newEmployee({
      id, name, roleId: 'role-ayudante', postNight: pref(id, name), fixedOffDays: offs(id), fixedShifts: shifts(id),
    }));
  });
  (old.extraEmployees || []).forEach((e: any) => {
    if (!e?.name?.trim()) return;
    employees.push(newEmployee({ id: e.id, name: e.name, roleId: 'role-extra', fixedOffDays: offs(e.id), fixedShifts: shifts(e.id) }));
  });

  return normalizeConfig({
    ...DEFAULT_CONFIG,
    version: 2,
    managerName: old.jefe || DEFAULT_CONFIG.managerName,
    employees: employees.length ? employees : DEFAULT_CONFIG.employees,
    rules: {
      ...DEFAULT_RULES,
      postNight: { enabled: true, defaultBehaviour: old.postNightBehaviour === 'Off' ? 'Off' : 'Afternoon' },
    },
    rotationStartDate: getMondayISO(new Date()),
    requests: Array.isArray(old.requests) ? old.requests : [],
    overridesByWeek: {},
  });
};

const num = (v: any, def: number) => (typeof v === 'number' && !isNaN(v) ? v : def);

/** Rellena cualquier campo que falte para que la app nunca se rompa al cargar datos guardados. */
export const normalizeConfig = (raw: any): AppConfig => {
  if (!raw || typeof raw !== 'object') return structuredClone(DEFAULT_CONFIG);
  if (raw.version !== 2) return migrateV1(raw);

  const cov = defaultCoverage();
  DAYS_OF_WEEK.forEach(d => {
    const r = raw.coverage?.[d];
    if (!r) return;
    cov[d] = {
      M: { min: num(r.M?.min, cov[d].M.min), max: num(r.M?.max, cov[d].M.max) },
      T: { min: num(r.T?.min, cov[d].T.min), max: num(r.T?.max, cov[d].T.max) },
      N: num(r.N, cov[d].N),
      S: { enabled: !!r.S?.enabled, min: num(r.S?.min, cov[d].S.min), max: num(r.S?.max, cov[d].S.max) },
    };
  });

  const rules = { ...DEFAULT_RULES, ...(raw.rules || {}) };
  rules.weeklyDays = { ...DEFAULT_RULES.weeklyDays, ...(raw.rules?.weeklyDays || {}) };
  rules.nightRotation = { ...DEFAULT_RULES.nightRotation, ...(raw.rules?.nightRotation || {}) };
  rules.postNight = { ...DEFAULT_RULES.postNight, ...(raw.rules?.postNight || {}) };
  rules.minRest = { ...DEFAULT_RULES.minRest, ...(raw.rules?.minRest || {}) };
  rules.autoSpecial = { ...DEFAULT_RULES.autoSpecial, ...(raw.rules?.autoSpecial || {}) };

  const roles = Array.isArray(raw.roles) && raw.roles.length ? raw.roles : DEFAULT_ROLES;

  return {
    version: 2,
    isConfigured: raw.isConfigured !== false,
    managerName: raw.managerName ?? DEFAULT_CONFIG.managerName,
    roles,
    employees: (Array.isArray(raw.employees) ? raw.employees : DEFAULT_CONFIG.employees).map((e: any) => ({
      ...newEmployee(),
      ...e,
      rules: { ...defaultPersonalRules(), ...(e.rules || {}) },
      fixedOffDays: (e.fixedOffDays || []).filter(isDay),
      fixedShifts: e.fixedShifts || {},
      morningOnlyDays: (e.morningOnlyDays || []).filter(isDay),
    })),
    shifts: {
      M: { ...DEFAULT_SHIFTS.M, ...(raw.shifts?.M || {}) },
      T: { ...DEFAULT_SHIFTS.T, ...(raw.shifts?.T || {}) },
      N: { ...DEFAULT_SHIFTS.N, ...(raw.shifts?.N || {}) },
      S: { ...DEFAULT_SHIFTS.S, ...(raw.shifts?.S || {}) },
    },
    coverage: cov,
    rules,
    security: { ...DEFAULT_CONFIG.security, ...(raw.security || {}) },
    rotationStartDate: raw.rotationStartDate || DEFAULT_CONFIG.rotationStartDate,
    requests: Array.isArray(raw.requests) ? raw.requests : [],
    overridesByWeek: raw.overridesByWeek || {},
  };
};
