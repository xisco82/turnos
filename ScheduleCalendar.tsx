
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
        <div className="bg-white p-4">
            {afternoonOverloads.length > 0 && (
                <div className="mb-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 animate-pulse">
                    <p className="font-bold flex items-center">
                        <span className="mr-2">⚠️ ALARMA:</span> 
                        {'¡Exceso de personal por la tarde (T > 2)!'}
                    </p>
                    <p className="text-sm">Días afectados: {afternoonOverloads.join(', ')}</p>
                </div>
            )}

            {(morningDeficiencies.length > 0 || afternoonDeficiencies.length > 0) && (
                <div className="mb-4 p-4 bg-orange-100 border-l-4 border-orange-500 text-orange-700">
                    <p className="font-bold flex items-center">
                        <span className="mr-2">ℹ️ AVISO:</span> 
                        Personal insuficiente para cumplir los mínimos.
                    </p>
                    <div className="text-sm">
                        {morningDeficiencies.length > 0 && <p>Mañana insuficiente (min 3 o 4): {morningDeficiencies.join(', ')}</p>}
                        {afternoonDeficiencies.length > 0 && <p>Tarde insuficiente (min 2): {afternoonDeficiencies.join(', ')}</p>}
                    </div>
                </div>
            )}
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-2">
                    <button onClick={() => onChangeWeek('prev')} className="p-2 rounded-full hover:bg-gray-100 transition"><ChevronLeftIcon /></button>
                    <span className="font-semibold text-lg text-gray-700 w-80 text-center">{formatDateRange(startOfWeek)}</span>
                    <button onClick={() => onChangeWeek('next')} className="p-2 rounded-full hover:bg-gray-100 transition"><ChevronRightIcon /></button>
                    <button 
                        onClick={onForceGenerate}
                        title="Actualizar Horario"
                        className="flex items-center space-x-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
                    >
                        <RefreshIcon />
                        <span>Actualizar</span>
                    </button>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={onExportExcel}
                        className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition"
                    >
                        <ExcelIcon />
                        <span>Exportar Excel</span>
                    </button>
                </div>
            </div>
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
                        {scheduleData.map(({ employeeId, employeeName, shifts }) => {
                            const totalL = shifts.filter(s => s.shift === ShiftConst.Off).length;
                            return (
                            <tr key={employeeId}>
                                <td className="p-3 border border-gray-200 font-medium text-gray-800">
                                    {employeeName}
                                </td>
                                {shifts.map(({ day, shift }) => {
                                     const details = getShiftDetails(shift);
                                     return (
                                        <td key={day} className="border border-gray-200 text-center p-0">
                                            <div 
                                                className={`w-full h-full p-3 font-bold text-sm ${details.color} ${details.textColor} truncate`}
                                                title={shift === details.label ? shift : `${shift}: ${details.label}`}
                                                >
                                                {shift}
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
                                <td key={day} className={`p-2 border border-gray-300 text-center font-bold text-lg ${dailyTotals[day].T > 2 ? 'bg-red-200 text-red-800' : 'text-orange-800'}`}>
                                    {dailyTotals[day].T}
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
    );
};

export default ScheduleCalendar;