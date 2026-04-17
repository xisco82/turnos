export enum Role {
  Jefe = 'Jefe',
  Subjefe = '2ª Jefa',
  Recepcionista = 'Recepcionista',
  Ayudante = 'Ayudante',
  Conserje = 'Conserje'
}

export enum DayOfWeek {
  Monday = 'Lunes',
  Tuesday = 'Martes',
  Wednesday = 'Miércoles',
  Thursday = 'Jueves',
  Friday = 'Viernes',
  Saturday = 'Sábado',
  Sunday = 'Domingo'
}

export const DAYS_ARRAY = [
  DayOfWeek.Monday,
  DayOfWeek.Tuesday,
  DayOfWeek.Wednesday,
  DayOfWeek.Thursday,
  DayOfWeek.Friday,
  DayOfWeek.Saturday,
  DayOfWeek.Sunday
];

export enum ShiftCode {
  Morning = 'M',
  Afternoon = 'T',
  Night = 'N',
  Off = 'L',
  Vacation = 'V',
  Sick = 'B',
  Holiday = 'F'
}

export interface SpecialRule {
  dia: DayOfWeek | 'Fin de semana' | 'Todos' | 'Lunes a Viernes' | 'Lunes a Sábado';
  accion: 'SOLO' | 'NUNCA' | 'RESTRINGIR_HORAS' | 'PREFERENCIA';
  turno: ShiftCode | string;
  startTime?: string;
  endTime?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: Role;
  postNightBehaviour: 'Off' | 'Afternoon';
  isNightRotationMember: boolean;
  isWeekendRotationMember: boolean;
  fixedWeekendOff: boolean;
  specialRules?: SpecialRule[];
}

export interface ShiftType {
  code: string;
  label: string;
  startTime: string;
  endTime: string;
  color: string;
}

export interface ScheduleRequest {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  type: 'Vacación' | 'Baja' | 'Festivo' | 'Manual';
  reason?: string;
}

export interface GlobalRule {
  key: string;
  value: number;
}

export interface ScheduleAssignment {
  [day: string]: string; // DayOfWeek -> ShiftCode
}

export interface Schedule {
  weekNumber: number;
  year: number;
  assignments: {
    [employeeId: string]: ScheduleAssignment;
  };
  generatedAt: string;
}
