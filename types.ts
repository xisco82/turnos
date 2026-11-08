// ─────────────────────────────────────────────────────────────
//  TIPOS DE LA APLICACIÓN DE TURNOS
// ─────────────────────────────────────────────────────────────

export const DayOfWeek = {
  Monday: 'Lunes',
  Tuesday: 'Martes',
  Wednesday: 'Miércoles',
  Thursday: 'Jueves',
  Friday: 'Viernes',
  Saturday: 'Sábado',
  Sunday: 'Domingo',
} as const;
export type DayOfWeek = (typeof DayOfWeek)[keyof typeof DayOfWeek];

/** Código de turno guardado en el cuadrante: M, T, N, S, L, V, BP, P, F o un horario manual ("10-18"). */
export type Shift = string;

/** Turnos de trabajo que el motor sabe asignar. S = turno especial (por defecto 10:00-18:00). */
export type WorkShift = 'M' | 'T' | 'N' | 'S';

/** Tipo de rol para las normas: "recepcion" cuenta como recepcionista en la tarde, "ayudante" como ayudante. */
export type RoleKind = 'recepcion' | 'ayudante' | 'otro';

export interface RoleDef {
  id: string;
  name: string;
  kind: RoleKind;
}

export type PostNightBehaviour = 'Off' | 'Afternoon';

export interface EmployeeConfig {
  id: string;
  name: string;
  roleId: string;
  active: boolean;
  /** Turnos que puede hacer. */
  canMorning: boolean;
  canAfternoon: boolean;
  canNight: boolean;
  canSpecial: boolean;
  /** Trabaja de noche todos sus días de trabajo (conserje de noche). */
  permanentNight: boolean;
  /** Entra en la rotación semanal de noches. */
  nightRotation: boolean;
  /** Entra en la rotación semanal de fin de semana libre (sábado + domingo). */
  weekendRotation: boolean;
  /** Qué hace al salir de noche. 'default' = la norma general. */
  postNight: PostNightBehaviour | 'default';
  /** Preferencia suave de turno. */
  preferredShift: 'M' | 'T' | 'none';
  fixedOffDays: DayOfWeek[];
  fixedShifts: Partial<Record<DayOfWeek, Shift>>;
}

export interface ShiftDef {
  label: string;
  start: string; // "08:00"
  end: string;   // "16:00"
}

export interface MinMax {
  min: number;
  max: number;
}

export interface DayCoverage {
  M: MinMax;
  T: MinMax;
  N: number;
  S: MinMax & { enabled: boolean };
}

export interface RulesConfig {
  /** N1: jornada semanal fija (días trabajados / libres). */
  weeklyDays: { enabled: boolean; workDays: number };
  /** N2: los días libres deben ser seguidos. */
  consecutiveOffs: boolean;
  /** N3: cada semana una persona distinta libra sábado y domingo. */
  weekendRotation: boolean;
  /** N4: cada semana una recepcionista distinta cubre las noches que faltan. */
  nightRotation: { enabled: boolean; nightsPerBlock: number };
  /** N5: qué pasa después de la noche (norma general; cada empleado puede cambiarla). */
  postNight: { enabled: boolean; defaultBehaviour: PostNightBehaviour };
  /** N6: nunca dos ayudantes juntos de tarde. */
  noTwoHelpersAfternoon: boolean;
  /** N7: siempre al menos un recepcionista de tarde. */
  receptionistRequiredAfternoon: boolean;
  /** N8: descanso mínimo entre turnos (horas). */
  minRest: { enabled: boolean; hours: number };
  /** N9: reparto equitativo de tardes y turnos especiales entre semanas. */
  fairRotation: boolean;
  /** Las vacaciones/bajas/peticiones cuentan como días libres de la semana. */
  absencesCountAsOff: boolean;
}

export interface SecurityConfig {
  /** PIN del administrador. Vacío = sin bloqueo. */
  adminPin: string;
  /** Los empleados nunca ven roles. */
  hideRolesFromEmployees: boolean;
}

export type RequestType = 'Vacaciones' | 'Petición' | 'Festivo' | 'Baja';

export interface ScheduleRequest {
  id: string;
  employeeId: string;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string;
  type: RequestType;
  reason?: string;
  status?: string;
  createdAt?: string;
}

export interface AppConfig {
  version: 2;
  isConfigured: boolean;
  managerName: string;
  roles: RoleDef[];
  employees: EmployeeConfig[];
  shifts: Record<WorkShift, ShiftDef>;
  coverage: Record<DayOfWeek, DayCoverage>;
  rules: RulesConfig;
  security: SecurityConfig;
  /** Lunes a partir del cual empiezan las rotaciones (yyyy-mm-dd). */
  rotationStartDate: string;
  requests: ScheduleRequest[];
  /** Cambios manuales: { "2026-11-09": { "rec-0|Lunes": "M" } } */
  overridesByWeek: Record<string, Record<string, Shift>>;
}

export interface ScheduleRow {
  employeeId: string;
  employeeName: string;
  role: string;
  shifts: { day: DayOfWeek; shift: Shift }[];
}

export interface ScheduleIssue {
  level: 'error' | 'warning' | 'info';
  rule: string;
  message: string;
}

export interface WeekResult {
  weekStart: string;
  rows: ScheduleRow[];
  issues: ScheduleIssue[];
  weekendOffEmployeeId: string | null;
  nightRotationEmployeeIds: string[];
}
