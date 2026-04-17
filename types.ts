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

export type Role = 'Jefe' | 'Subjefe' | 'Recepcionista' | 'Ayudante' | 'Conserje';

export interface AppConfig {
  jefe: string;
  subjefe: string;
  recepcionistas: string[];
  ayudantes: string[];
  conserje: string;
  isConfigured: boolean;
}

export type Rule = {
  [key in DayOfWeek]: Shift;
};

export type PostNightBehaviour = 'Off' | 'Afternoon';

export type RequestType = 'Libre' | 'Vacaciones';

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