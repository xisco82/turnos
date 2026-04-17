
import { DayOfWeek, Shift, Employee, Role } from './types';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  DayOfWeek.Monday,
  DayOfWeek.Tuesday,
  DayOfWeek.Wednesday,
  DayOfWeek.Thursday,
  DayOfWeek.Friday,
  DayOfWeek.Saturday,
  DayOfWeek.Sunday,
];

export const ShiftConst = {
  Morning: 'M',
  Afternoon: 'T',
  Night: 'N',
  Off: 'L',
  Vacation: 'V',
} as const;

export const STANDARD_SHIFTS: Shift[] = Object.values(ShiftConst);

const SHIFT_DETAILS_MAP: { [key: string]: { label: string; color: string; textColor: string } } = {
  [ShiftConst.Morning]: { label: 'Mañana', color: 'bg-yellow-200', textColor: 'text-yellow-800' },
  [ShiftConst.Afternoon]: { label: 'Tarde', color: 'bg-orange-300', textColor: 'text-orange-800' },
  [ShiftConst.Night]: { label: 'Noche', color: 'bg-blue-400', textColor: 'text-blue-900' },
  [ShiftConst.Off]: { label: 'Libre', color: 'bg-gray-200', textColor: 'text-gray-600' },
  [ShiftConst.Vacation]: { label: 'Vacaciones', color: 'bg-green-200', textColor: 'text-green-800' },
};

export const CUSTOM_SHIFT_STYLE = { label: 'Personalizado', color: 'bg-purple-200', textColor: 'text-purple-800' };
const UNASSIGNED_STYLE = { label: 'No Asignado', color: 'bg-white hover:bg-gray-50', textColor: 'text-gray-400' };


export const getShiftDetails = (shift: Shift) => {
    if (!shift) {
        return UNASSIGNED_STYLE;
    }
    return SHIFT_DETAILS_MAP[shift] || CUSTOM_SHIFT_STYLE;
};

export const DEFAULT_CONFIG: AppConfig = {
    jefe: '',
    subjefe: '',
    recepcionistas: ['', '', '', ''],
    ayudantes: ['', ''],
    conserje: '',
    isConfigured: false,
};
