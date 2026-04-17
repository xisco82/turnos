
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


export const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: '3',
    name: 'Xisco',
    role: 'Otro',
    wantsPostNightRest: false,
    postNightBehaviour: 'Off',
    isNightRotationMember: false,
    isWeekendRotationMember: false,
    fixedWeekendOff: false,
    rules: {
      [DayOfWeek.Monday]: ShiftConst.Morning,
      [DayOfWeek.Tuesday]: ShiftConst.Morning,
      [DayOfWeek.Wednesday]: ShiftConst.Morning,
      [DayOfWeek.Thursday]: ShiftConst.Morning,
      [DayOfWeek.Friday]: ShiftConst.Off,
      [DayOfWeek.Saturday]: ShiftConst.Off,
      [DayOfWeek.Sunday]: ShiftConst.Morning,
    },
  },
  {
    id: '2',
    name: 'Aliz',
    role: 'Otro',
    wantsPostNightRest: false,
    postNightBehaviour: 'Off',
    isNightRotationMember: false,
    isWeekendRotationMember: false,
    fixedWeekendOff: false,
    rules: {
      [DayOfWeek.Monday]: ShiftConst.Off,
      [DayOfWeek.Tuesday]: ShiftConst.Morning,
      [DayOfWeek.Wednesday]: ShiftConst.Morning,
      [DayOfWeek.Thursday]: ShiftConst.Afternoon,
      [DayOfWeek.Friday]: ShiftConst.Morning,
      [DayOfWeek.Saturday]: ShiftConst.Morning,
      [DayOfWeek.Sunday]: ShiftConst.Off,
    },
  },
   // --- Rotation Group ---
  {
    id: '4',
    name: 'Josep',
    role: 'Recepcionista',
    wantsPostNightRest: true,
    postNightBehaviour: 'Off',
    isNightRotationMember: true,
    isWeekendRotationMember: true,
    fixedWeekendOff: false,
    rules: {
        [DayOfWeek.Monday]: ShiftConst.Morning,
        [DayOfWeek.Tuesday]: ShiftConst.Off,
        [DayOfWeek.Wednesday]: ShiftConst.Off,
        [DayOfWeek.Thursday]: ShiftConst.Afternoon,
        [DayOfWeek.Friday]: ShiftConst.Morning,
        [DayOfWeek.Saturday]: ShiftConst.Off,
        [DayOfWeek.Sunday]: ShiftConst.Off,
    },
  },
  {
    id: '5',
    name: 'Javi',
    role: 'Recepcionista',
    wantsPostNightRest: true,
    postNightBehaviour: 'Off',
    isNightRotationMember: true,
    isWeekendRotationMember: true,
    fixedWeekendOff: false,
    rules: {
        [DayOfWeek.Monday]: ShiftConst.Morning,
        [DayOfWeek.Tuesday]: ShiftConst.Morning,
        [DayOfWeek.Wednesday]: ShiftConst.Off,
        [DayOfWeek.Thursday]: ShiftConst.Off,
        [DayOfWeek.Friday]: ShiftConst.Morning,
        [DayOfWeek.Saturday]: ShiftConst.Off,
        [DayOfWeek.Sunday]: ShiftConst.Off,
    },
  },
  {
    id: '6',
    name: 'Toni',
    role: 'Recepcionista',
    wantsPostNightRest: false,
    postNightBehaviour: 'Afternoon',
    isNightRotationMember: true,
    isWeekendRotationMember: true,
    fixedWeekendOff: false,
    rules: {
        [DayOfWeek.Monday]: ShiftConst.Afternoon,
        [DayOfWeek.Tuesday]: ShiftConst.Afternoon,
        [DayOfWeek.Wednesday]: ShiftConst.Off,
        [DayOfWeek.Thursday]: ShiftConst.Off,
        [DayOfWeek.Friday]: ShiftConst.Morning,
        [DayOfWeek.Saturday]: ShiftConst.Off,
        [DayOfWeek.Sunday]: ShiftConst.Off,
    },
  },
  {
    id: '7',
    name: 'Miriam',
    role: 'Recepcionista',
    wantsPostNightRest: false,
    postNightBehaviour: 'Afternoon',
    isNightRotationMember: true,
    isWeekendRotationMember: true,
    fixedWeekendOff: false,
    rules: {
        [DayOfWeek.Monday]: ShiftConst.Afternoon,
        [DayOfWeek.Tuesday]: ShiftConst.Afternoon,
        [DayOfWeek.Wednesday]: ShiftConst.Morning,
        [DayOfWeek.Thursday]: ShiftConst.Off,
        [DayOfWeek.Friday]: ShiftConst.Off,
        [DayOfWeek.Saturday]: ShiftConst.Off,
        [DayOfWeek.Sunday]: ShiftConst.Off,
    },
  },
  {
    id: '8',
    name: 'Ines',
    role: 'Ayudante',
    wantsPostNightRest: false,
    postNightBehaviour: 'Off',
    isNightRotationMember: false,
    isWeekendRotationMember: true,
    fixedWeekendOff: false,
    rules: {
        [DayOfWeek.Monday]: ShiftConst.Off,
        [DayOfWeek.Tuesday]: ShiftConst.Off,
        [DayOfWeek.Wednesday]: ShiftConst.Afternoon,
        [DayOfWeek.Thursday]: ShiftConst.Afternoon,
        [DayOfWeek.Friday]: ShiftConst.Afternoon,
        [DayOfWeek.Saturday]: ShiftConst.Off,
        [DayOfWeek.Sunday]: ShiftConst.Off,
    },
  },
  {
    id: '9',
    name: 'Catalina',
    role: 'Ayudante',
    wantsPostNightRest: false,
    postNightBehaviour: 'Off',
    isNightRotationMember: false,
    isWeekendRotationMember: true,
    fixedWeekendOff: false,
    rules: {
        [DayOfWeek.Monday]: ShiftConst.Morning,
        [DayOfWeek.Tuesday]: ShiftConst.Afternoon,
        [DayOfWeek.Wednesday]: ShiftConst.Off,
        [DayOfWeek.Thursday]: ShiftConst.Off,
        [DayOfWeek.Friday]: ShiftConst.Afternoon,
        [DayOfWeek.Saturday]: ShiftConst.Off,
        [DayOfWeek.Sunday]: ShiftConst.Off,
    }
  },
  {
    id: '1',
    name: 'Oscar',
    role: 'Otro',
    wantsPostNightRest: true,
    postNightBehaviour: 'Off',
    isNightRotationMember: false,
    isWeekendRotationMember: true,
    fixedWeekendOff: false,
    rules: {
      [DayOfWeek.Monday]: ShiftConst.Off,
      [DayOfWeek.Tuesday]: ShiftConst.Off,
      [DayOfWeek.Wednesday]: ShiftConst.Night,
      [DayOfWeek.Thursday]: ShiftConst.Night,
      [DayOfWeek.Friday]: ShiftConst.Night,
      [DayOfWeek.Saturday]: ShiftConst.Off,
      [DayOfWeek.Sunday]: ShiftConst.Off,
    },
  },
];
