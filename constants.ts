import {
  AppConfig, DayCoverage, DayOfWeek, EmployeeConfig, RoleDef, RulesConfig,
  Shift, ShiftDef, WorkShift,
} from './types';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday,
  DayOfWeek.Friday, DayOfWeek.Saturday, DayOfWeek.Sunday,
];

export const ShiftConst = {
  Morning: 'M',
  Afternoon: 'T',
  Night: 'N',
  Special: 'S',
  Off: 'L',
  Vacation: 'V',
  Paternity: 'BP',
  Petition: 'P',
  Festive: 'F',
} as const;

export const WORK_SHIFTS: WorkShift[] = ['M', 'T', 'N', 'S'];
export const ABSENCE_SHIFTS: Shift[] = ['V', 'BP', 'P', 'F'];
export const isAbsence = (s: Shift | undefined | null) => !!s && ABSENCE_SHIFTS.includes(s);
export const isOff = (s: Shift | undefined | null) => s === 'L';
export const isWork = (s: Shift | undefined | null) => !!s && !isOff(s) && !isAbsence(s);

// ─────────────────────────────────────────────────────────────
//  VALORES POR DEFECTO (todo se puede cambiar desde Ajustes)
// ─────────────────────────────────────────────────────────────

export const DEFAULT_ROLES: RoleDef[] = [
  { id: 'role-jefe', name: 'Jefe de Recepción', kind: 'recepcion' },
  { id: 'role-subjefe', name: '2º Jefe', kind: 'recepcion' },
  { id: 'role-conserje', name: 'Conserje de Noche', kind: 'otro' },
  { id: 'role-recepcionista', name: 'Recepcionista', kind: 'recepcion' },
  { id: 'role-ayudante', name: 'Ayudante de Recepción', kind: 'ayudante' },
  { id: 'role-extra', name: 'Extra', kind: 'otro' },
];

export const DEFAULT_SHIFTS: Record<WorkShift, ShiftDef> = {
  M: { label: 'Mañana', start: '08:00', end: '16:00' },
  T: { label: 'Tarde', start: '16:00', end: '00:00' },
  N: { label: 'Noche', start: '00:00', end: '08:00' },
  S: { label: 'Especial', start: '10:00', end: '18:00' },
};

const weekdayCoverage = (): DayCoverage => ({
  M: { min: 3, max: 4 },
  T: { min: 2, max: 2 },
  N: 1,
  S: { enabled: false, min: 1, max: 1 },
});
const weekendCoverage = (): DayCoverage => ({
  M: { min: 4, max: 5 },
  T: { min: 2, max: 2 },
  N: 1,
  S: { enabled: false, min: 1, max: 1 },
});

export const defaultCoverage = (): Record<DayOfWeek, DayCoverage> => ({
  [DayOfWeek.Monday]: weekdayCoverage(),
  [DayOfWeek.Tuesday]: weekdayCoverage(),
  [DayOfWeek.Wednesday]: weekdayCoverage(),
  [DayOfWeek.Thursday]: weekdayCoverage(),
  [DayOfWeek.Friday]: weekendCoverage(),
  [DayOfWeek.Saturday]: weekendCoverage(),
  [DayOfWeek.Sunday]: weekendCoverage(),
} as Record<DayOfWeek, DayCoverage>);

export const DEFAULT_RULES: RulesConfig = {
  weeklyDays: { enabled: true, workDays: 5 },
  consecutiveOffs: true,
  weekendRotation: true,
  nightRotation: { enabled: true, nightsPerBlock: 2 },
  postNight: { enabled: true, defaultBehaviour: 'Afternoon' },
  noTwoHelpersAfternoon: true,
  receptionistRequiredAfternoon: true,
  minRest: { enabled: true, hours: 12 },
  fairRotation: true,
  absencesCountAsOff: true,
};

export const newEmployee = (partial: Partial<EmployeeConfig> = {}): EmployeeConfig => ({
  id: `emp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  name: '',
  roleId: 'role-recepcionista',
  active: true,
  canMorning: true,
  canAfternoon: true,
  canNight: false,
  canSpecial: true,
  permanentNight: false,
  nightRotation: false,
  weekendRotation: true,
  postNight: 'default',
  preferredShift: 'none',
  fixedOffDays: [],
  fixedShifts: {},
  ...partial,
});

export const getMondayISO = (date: Date = new Date()): string => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return toISODate(d);
};

export const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

export const DEFAULT_EMPLOYEES: EmployeeConfig[] = [
  newEmployee({ id: 'jefe', name: 'XISCO', roleId: 'role-jefe', canAfternoon: false, canSpecial: false, weekendRotation: false, preferredShift: 'M', fixedOffDays: [DayOfWeek.Friday, DayOfWeek.Saturday] }),
  newEmployee({ id: 'subjefe', name: 'ALIZ', roleId: 'role-subjefe', weekendRotation: false, preferredShift: 'M', fixedOffDays: [DayOfWeek.Sunday, DayOfWeek.Monday] }),
  newEmployee({ id: 'conserje', name: 'OSCAR', roleId: 'role-conserje', canMorning: false, canAfternoon: false, canSpecial: false, canNight: true, permanentNight: true, weekendRotation: false, fixedOffDays: [DayOfWeek.Monday, DayOfWeek.Tuesday] }),
  ...['JAVI', 'TONI', 'MIRIAM', 'CARLOS', 'JOSEP'].map((name, i) =>
    newEmployee({ id: `rec-${i}`, name, roleId: 'role-recepcionista', canNight: true, nightRotation: true })),
  ...['INÉS', 'JAKELINE'].map((name, i) =>
    newEmployee({ id: `ayu-${i}`, name, roleId: 'role-ayudante' })),
];

export const DEFAULT_CONFIG: AppConfig = {
  version: 2,
  isConfigured: true,
  managerName: 'XISCO',
  roles: DEFAULT_ROLES,
  employees: DEFAULT_EMPLOYEES,
  shifts: DEFAULT_SHIFTS,
  coverage: defaultCoverage(),
  rules: DEFAULT_RULES,
  security: { adminPin: '', hideRolesFromEmployees: true },
  rotationStartDate: '2026-01-05',
  requests: [
    { id: 'toni-baja-2026', employeeId: 'rec-1', startDate: '2026-01-01', endDate: '2026-12-31', type: 'Baja', reason: 'Baja prolongada' },
  ],
  overridesByWeek: {},
};

// ─────────────────────────────────────────────────────────────
//  PRESENTACIÓN DE TURNOS
// ─────────────────────────────────────────────────────────────

const shortHour = (h: string) => (h || '').split(':')[0];

/** Texto que se ve en la casilla. El especial se muestra con su horario (ej. "10-18"). */
export const displayShift = (shift: Shift, config: Pick<AppConfig, 'shifts'>): string => {
  if (shift === 'S') {
    const s = config.shifts.S;
    return `${shortHour(s.start)}-${shortHour(s.end)}`;
  }
  return shift;
};

export const shiftLegend = (config: Pick<AppConfig, 'shifts'>) => [
  ...WORK_SHIFTS.map(code => ({
    code: displayShift(code, config),
    label: `${config.shifts[code].label} (${shortHour(config.shifts[code].start)}-${shortHour(config.shifts[code].end)})`,
  })),
  { code: 'L', label: 'Libre' },
  { code: 'V', label: 'Vacaciones' },
  { code: 'BP', label: 'Baja' },
  { code: 'P', label: 'Petición' },
  { code: 'F', label: 'Festivo' },
];

export const SHIFT_STYLE: Record<string, string> = {
  M: 'bg-amber-100 text-amber-950 border-2 border-amber-300',
  T: 'bg-sky-100 text-sky-950 border-2 border-sky-300',
  N: 'bg-indigo-700 text-white border-2 border-indigo-900',
  S: 'bg-fuchsia-100 text-fuchsia-950 border-2 border-fuchsia-300',
  L: 'bg-slate-100 text-slate-500 border-2 border-slate-200',
  V: 'bg-emerald-100 text-emerald-950 border-2 border-emerald-300',
  BP: 'bg-rose-100 text-rose-950 border-2 border-rose-300',
  P: 'bg-purple-100 text-purple-950 border-2 border-purple-300',
  F: 'bg-orange-100 text-orange-950 border-2 border-orange-300',
};
export const CUSTOM_SHIFT_STYLE = 'bg-teal-50 text-teal-950 border-2 border-teal-400';
export const shiftStyle = (s: Shift) => SHIFT_STYLE[s] || CUSTOM_SHIFT_STYLE;

export const PDF_COLORS: Record<string, [number, number, number]> = {
  M: [254, 243, 199], T: [224, 242, 254], N: [67, 56, 202], S: [250, 232, 255],
  L: [241, 245, 249], V: [209, 250, 229], BP: [255, 228, 230], P: [243, 232, 255], F: [255, 237, 213],
};
