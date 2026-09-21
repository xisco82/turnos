
import React from 'react';
import { DayOfWeek, Shift, ScheduleRow } from './types';
import { getShiftDetails, ShiftConst, DAYS_OF_WEEK } from './constants';
import { ChevronLeftIcon, ChevronRightIcon, RefreshIcon, ExcelIcon } from './components/Icons';

interface ScheduleCalendarProps {
  startOfWeek: Date;
  scheduleData: ScheduleRow[];
  onChangeWeek: (direction: 'prev' | 'next') => void;
  onExportExcel: () => void;
  onForceGenerate: () => void;
}

const ScheduleCalendar = ({ startOfWeek, scheduleData, onChangeWeek, onExportExcel, onForceGenerate }: ScheduleCalendarProps) => {
    const formatDateRange = (start: Date): string => {
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
        return `${start.toLocaleDateString('es-ES', options)} - ${end.toLocaleDateString('es-ES', options)}`;
    };

    const dailyTotals: { [key in DayOfWeek]: { M: number; T: number } } = {
        [DayOfWeek.Monday]: { M: 0, T: 0 },
        [DayOfWeek.Tuesday]: { M: 0, T: 0 },
        [DayOfWeek.Wednesday]: { M: 0, T: 0 },
        [DayOfWeek.Thursday]: { M: 0, T: 0 },
        [DayOfWeek.Friday]: { M: 0, T: 0 },
        [DayOfWeek.Saturday]: { M: 0, T: 0 },
        [DayOfWeek.Sunday]: { M: 0, T: 0 },
    };

    const afternoonOverloads: DayOfWeek[] = [];
    const morningDeficiencies: DayOfWeek[] = [];
    const afternoonDeficiencies: DayOfWeek[] = [];

    for (const row of scheduleData) {
        for (const { day, shift } of row.shifts) {
            if (shift === ShiftConst.Morning) {
                if (dailyTotals[day]) {
                    dailyTotals[day].M += 1;
                }
            } else if (shift === ShiftConst.Afternoon) {
                 if (dailyTotals[day]) {
                    dailyTotals[day].T += 1;
                }
            } else if (shift === ShiftConst.LorenaSpecial) {
                if (dailyTotals[day]) {
                   dailyTotals[day].T += 0.5;
               }
           }
        }
    }

    for (const day of DAYS_OF_WEEK) {
        const isSpecialDay = day === DayOfWeek.Friday || day === DayOfWeek.Saturday || day === DayOfWeek.Sunday;
        const minM = isSpecialDay ? 4 : 3;
        const minT = 2;

        if (dailyTotals[day].T > 2) {
            afternoonOverloads.push(day);
        }
        if (dailyTotals[day].M < minM) {
            morningDeficiencies.push(day);
        }
        if (dailyTotals[day].T < minT) {
            afternoonDeficiencies.push(day);
        }
    }
    
    const grandTotalL = scheduleData.reduce((total, row) => {
        return total + row.shifts.filter(s => s.shift === ShiftConst.Off).length;
    }, 0);

    return (
        <div className="bg-white">
            <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center bg-gray-50/30">
                <div className="flex items-center space-x-6">
                    <button 
                        onClick={() => onChangeWeek('prev')} 
                        className="group flex flex-col items-center justify-center p-2 rounded-2xl bg-white border border-gray-200 shadow-sm hover:border-blue-500 hover:text-blue-600 transition-all active:scale-95"
                    >
                        <ChevronLeftIcon />
                        <span className="text-[10px] font-bold mt-1">ANTERIOR</span>
                    </button>
                    
                    <div className="text-center">
                        <div className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">Rango de Fecha</div>
                        <span className="font-black text-xl text-gray-900 tracking-tight">{formatDateRange(startOfWeek)}</span>
                    </div>

                    <button 
                        onClick={() => onChangeWeek('next')} 
                        className="group flex flex-col items-center justify-center p-2 rounded-2xl bg-white border border-gray-200 shadow-sm hover:border-blue-500 hover:text-blue-600 transition-all active:scale-95"
                    >
                        <ChevronRightIcon />
                        <span className="text-[10px] font-bold mt-1 text-blue-600">SIGUIENTE</span>
                    </button>
                </div>

                <div className="flex items-center space-x-3 mt-6 md:mt-0">
                     <div className="px-4 py-2 bg-gray-100 rounded-xl border border-gray-200">
                        <div className="text-[8px] font-bold text-gray-400 uppercase">Estado Generación</div>
                        <div className="text-[10px] font-black text-green-600 flex items-center">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                            AUTOMATIZADO
                        </div>
                     </div>
                </div>
            </div>

            <div className="p-6">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className="p-3 border border-gray-300 bg-gray-100 text-left font-semibold text-gray-600">Empleado</th>
                            {DAYS_OF_WEEK.map((day) => (
                                <th key={day} className="p-3 border border-gray-300 bg-gray-100 font-semibold text-gray-600 w-24">{day}</th>
                            ))}
                            <th className="p-3 border border-gray-300 bg-gray-100 font-semibold text-gray-600 w-20">Total L</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scheduleData.map((row) => {
                            const { employeeId, employeeName, shifts, role } = row;
                            const totalL = shifts.filter(s => s.shift === ShiftConst.Off).length;
                            return (
                            <tr key={employeeId}>
                                 <td className="p-3 border border-gray-200 font-medium text-gray-800 bg-gray-50/50">
                                    <div className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-tighter italic">{role}</div>
                                    <div className="text-sm font-black">{employeeName}</div>
                                </td>
                                {shifts.map(({ day, shift }) => {
                                     const details = getShiftDetails(shift);
                                     const displayText = shift === ShiftConst.Morning ? 'MAÑANA' : 
                                                         shift === ShiftConst.Afternoon ? 'TARDE' : 
                                                         shift === ShiftConst.Off ? 'LIBRE' : 
                                                         shift === ShiftConst.Night ? 'NOCHE' : 
                                                         shift === ShiftConst.Vacation ? 'VACACIONES' : 
                                                         shift === ShiftConst.Paternity ? 'BAJA' :
                                                         shift === ShiftConst.Petition ? 'PETICIÓN' :
                                                         shift === ShiftConst.Festive ? 'FESTIVO' :
                                                         shift === ShiftConst.LorenaSpecial ? '16-20' :
                                                         shift;
                                     return (
                                        <td key={day} className="border border-gray-200 text-center p-0">
                                            <div 
                                                className={`w-full h-full p-4 font-black text-[10px] sm:text-xs ${details.color} ${details.textColor} transition-all duration-300 hover:brightness-95`}
                                                title={details.label}
                                                >
                                                {displayText}
                                            </div>
                                        </td>
                                     )
                                })}
                                <td className="p-3 border border-gray-200 font-bold text-center text-lg text-gray-700 bg-gray-50">
                                    {totalL}
                                </td>
                            </tr>
                        )})}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-50">
                            <td className="p-2 border border-gray-300 font-semibold text-sm text-gray-700 text-right">Total Mañana (M)</td>
                            {DAYS_OF_WEEK.map(day => (
                                <td key={day} className="p-2 border border-gray-300 text-center font-bold text-lg text-yellow-800">{dailyTotals[day].M}</td>
                            ))}
                             <td className="p-2 border border-gray-300"></td>
                        </tr>
                        <tr className="bg-gray-50">
                            <td className="p-2 border border-gray-300 font-semibold text-sm text-gray-700 text-right">Total Tarde (T)</td>
                            {DAYS_OF_WEEK.map(day => (
                                <td key={day} className={`p-2 border border-gray-300 text-center font-bold text-lg ${dailyTotals[day].T > 2.5 ? 'bg-red-200 text-red-800' : 'text-orange-800'}`}>
                                    {dailyTotals[day].T.toString().replace('.', ',')}
                                </td>
                            ))}
                             <td className="p-2 border border-gray-300"></td>
                        </tr>
                         <tr className="bg-gray-100">
                            <td colSpan={8} className="p-2 border border-gray-300 font-semibold text-sm text-gray-700 text-right">Total Libres (L) de la Semana</td>
                            <td className="p-2 border border-gray-300 text-center font-bold text-xl text-gray-800">{grandTotalL}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    </div>
  );
};

export default ScheduleCalendar;