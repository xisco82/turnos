export type Shift = string;

export enum DayOfWeek {
  Monday = 'Lunes',
  Tuesday = 'Martes',
  Wednesday = 'Miércoles',
  Thursday = 'Jueves',
  Friday = 'Viernes',
  Saturday = 'Sábado',
  Sunday = 'Domingo',
}

export type Role = 'Jefe' | 'Subjefe' | 'Recepcionista' | 'Ayudante' | 'Conserje' | string;

export interface ExtraEmployee {
  id: string;
  name: string;
  role: string;
}

export interface AppConfig {
  jefe: string;
  subjefe: string;
  recepcionistas: string[];
  ayudantes: string[];
  conserje: string;
  extraEmployees: ExtraEmployee[];
  isConfigured: boolean;
  fixedOffDays: Record<string, DayOfWeek[]>;
  requests: ScheduleRequest[];
}

export type Rule = {
  [key in DayOfWeek]: Shift;
};

export type PostNightBehaviour = 'Off' | 'Afternoon';

export type RequestType = 'Vacaciones' | 'Petición' | 'Festivo' | 'Baja';

export interface ScheduleRequest {
  id: string;
  employeeId: string;
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
  type: RequestType;
  reason?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: Role;
  rules: Rule;
  wantsPostNightRest: boolean; // Legacy, will use postNightBehaviour
  postNightBehaviour: PostNightBehaviour;
  isNightRotationMember: boolean;
  isWeekendRotationMember: boolean;
  fixedWeekendOff: boolean;
}

export interface ScheduleRow {
    employeeId: string;
    employeeName: string;
    role: Role;
    shifts: { day: DayOfWeek; shift: Shift }[];
}