
import React, { useState, useMemo, useEffect } from 'react';
import { Employee, Shift, DayOfWeek, ScheduleRow, AppConfig } from './types';
import { 
    DAYS_OF_WEEK, 
    ShiftConst,
    DEFAULT_CONFIG
} from './constants';
import ScheduleCalendar from './ScheduleCalendar';
import SetupForm from './components/SetupForm';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { RefreshIcon } from './components/Icons';

// Extend jsPDF for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  d.setHours(0, 0, 0, 0);
  return new Date(d.setDate(diff));
};

const getWeekNumber = (d: Date): number => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7);
  return weekNo;
};

export default function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('turnos_config');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  useEffect(() => {
    localStorage.setItem('turnos_config', JSON.stringify(config));
  }, [config]);

  const startOfWeek = useMemo(() => getStartOfWeek(currentDate), [currentDate]);
  const weekNumber = useMemo(() => getWeekNumber(startOfWeek), [startOfWeek]);

  const scheduleData = useMemo<ScheduleRow[]>(() => {
    if (!config.isConfigured) return [];

    const employees: Employee[] = [
      { id: 'jefe', name: config.jefe, role: 'Jefe', rules: {} as any, wantsPostNightRest: false, postNightBehaviour: 'Off', isNightRotationMember: false, isWeekendRotationMember: false, fixedWeekendOff: false },
      { id: 'subjefe', name: config.subjefe, role: 'Subjefe', rules: {} as any, wantsPostNightRest: false, postNightBehaviour: 'Off', isNightRotationMember: false, isWeekendRotationMember: false, fixedWeekendOff: false },
      ...config.recepcionistas.map((name, i) => ({ id: `rec-${i}`, name, role: 'Recepcionista' as any, rules: {} as any, wantsPostNightRest: false, postNightBehaviour: 'Off' as any, isNightRotationMember: false, isWeekendRotationMember: false, fixedWeekendOff: false })),
      ...config.ayudantes.map((name, i) => ({ id: `ayu-${i}`, name, role: 'Ayudante' as any, rules: {} as any, wantsPostNightRest: false, postNightBehaviour: 'Off' as any, isNightRotationMember: false, isWeekendRotationMember: false, fixedWeekendOff: false })),
      { id: 'conserje', name: config.conserje, role: 'Conserje', rules: {} as any, wantsPostNightRest: false, postNightBehaviour: 'Off', isNightRotationMember: false, isWeekendRotationMember: false, fixedWeekendOff: false }
    ];

    const schedule = new Map<string, Map<DayOfWeek, Shift>>();
    employees.forEach(e => schedule.set(e.id, new Map<DayOfWeek, Shift>()));

    // --- 1. ASIGNAR DÍAS LIBRES (REGLAS FIJAS Y ROTACIÓN) ---
    
    // Jefe: Viernes, Sábado
    schedule.get('jefe')!.set(DayOfWeek.Friday, ShiftConst.Off);
    schedule.get('jefe')!.set(DayOfWeek.Saturday, ShiftConst.Off);

    // Subjefe: Domingo, Lunes
    schedule.get('subjefe')!.set(DayOfWeek.Sunday, ShiftConst.Off);
    schedule.get('subjefe')!.set(DayOfWeek.Monday, ShiftConst.Off);

    // Ayudantes: Mismos días libres
    const dayPairs: [DayOfWeek, DayOfWeek][] = [
      [DayOfWeek.Monday, DayOfWeek.Tuesday],
      [DayOfWeek.Tuesday, DayOfWeek.Wednesday],
      [DayOfWeek.Wednesday, DayOfWeek.Thursday],
    ];
    const ayuPair = dayPairs[weekNumber % dayPairs.length];
    schedule.get('ayu-0')!.set(ayuPair[0], ShiftConst.Off);
    schedule.get('ayu-0')!.set(ayuPair[1], ShiftConst.Off);
    schedule.get('ayu-1')!.set(ayuPair[0], ShiftConst.Off);
    schedule.get('ayu-1')!.set(ayuPair[1], ShiftConst.Off);

    // Recepcionistas: Rotación de libres y Noches
    const recDayPairs: [DayOfWeek, DayOfWeek][] = [
      [DayOfWeek.Wednesday, DayOfWeek.Thursday], // Fixed these to avoid Mon/Tue conflicts
      [DayOfWeek.Thursday, DayOfWeek.Friday],
      [DayOfWeek.Friday, DayOfWeek.Saturday],
      [DayOfWeek.Saturday, DayOfWeek.Sunday],
    ];

    config.recepcionistas.forEach((_, i) => {
      const eId = `rec-${i}`;
      const recSchedule = schedule.get(eId)!;
      
      // Night Rotation (Mon/Tue once a month per person)
      const isNightWeek = (weekNumber % 4) === i;
      if (isNightWeek) {
        recSchedule.set(DayOfWeek.Monday, ShiftConst.Night);
        recSchedule.set(DayOfWeek.Tuesday, ShiftConst.Night);
        // Requirement from previous turn: "después de su dia de noche que tengan turno de tarde" (specifically for those mentioned)
        // Global rule now: "rota qué recepcionistas tienen tarde después de noche"
        recSchedule.set(DayOfWeek.Wednesday, ShiftConst.Afternoon);
        // Give them 2 days off later in the week
        recSchedule.set(DayOfWeek.Thursday, ShiftConst.Off);
        recSchedule.set(DayOfWeek.Friday, ShiftConst.Off);
      } else {
        // Normal rotation of off days
        const pair = recDayPairs[(weekNumber + i) % recDayPairs.length];
        recSchedule.set(pair[0], ShiftConst.Off);
        recSchedule.set(pair[1], ShiftConst.Off);
      }
    });

    // Conserje: Noches fijas (excepto sus libres)
    schedule.get('conserje')!.set(DayOfWeek.Tuesday, ShiftConst.Off);
    schedule.get('conserje')!.set(DayOfWeek.Wednesday, ShiftConst.Off);
    // Conserje covers Mon/Tue nights when no recepcionista is on night shift?
    // No, usually Conserje is the main night guy.
    // Wait, the prompt says "Conserje de noche (1 nombre)".
    // If the recepcionista does Mon/Tue night, the Conserje is also there?
    // Prompt says "recepcionistas 1 vez al mes hagan 2 noches...".
    // I'll assume they REPLACE the conserje on those 2 nights or work together. 
    // Usually it's a replacement to let conserje off or just training.
    // I'll just assign both for now as per rules.
    schedule.get('conserje')!.set(DayOfWeek.Tuesday, ShiftConst.Off);
    schedule.get('conserje')!.set(DayOfWeek.Wednesday, ShiftConst.Off);

    // --- 2. ASIGNAR TURNOS FIJOS (CONSERJE NOCHE) ---
    DAYS_OF_WEEK.forEach(day => {
      if (schedule.get('conserje')!.get(day) !== ShiftConst.Off) {
        schedule.get('conserje')!.set(day, ShiftConst.Night);
      }
    });

    // --- 3. ASIGNAR TURNOS DE RECEPCIÓN (MAÑANA / TARDE) ---
    DAYS_OF_WEEK.forEach(day => {
      const isWeekend = day === DayOfWeek.Friday || day === DayOfWeek.Saturday || day === DayOfWeek.Sunday;
      const minM = isWeekend ? 4 : 3;
      const minT = 2;

      const workingEmployees = employees.filter(e => e.id !== 'conserje' && schedule.get(e.id)!.get(day) !== ShiftConst.Off);

      // Ayudantes: Nunca juntos en tarde
      const ayunWorking = workingEmployees.filter(e => e.role === 'Ayudante');
      
      // Intentamos asignar management a Mañana primero
      const managementWorking = workingEmployees.filter(e => e.role === 'Jefe' || e.role === 'Subjefe');
      managementWorking.forEach(e => schedule.get(e.id)!.set(day, ShiftConst.Morning));

      const staffToAssign = workingEmployees.filter(e => e.role !== 'Jefe' && e.role !== 'Subjefe');
      
      // Shuffle staff loosely based on week to rotate T
      const shuffledStaff = [...staffToAssign].sort((a,b) => {
         const scoreA = (parseInt(a.id.split('-')[1]) || 0) + weekNumber;
         const scoreB = (parseInt(b.id.split('-')[1]) || 0) + weekNumber;
         return scoreA % 4 - scoreB % 4;
      });

      let currentT = 0;
      let currentM = managementWorking.length;

      shuffledStaff.forEach(emp => {
        const isHelper = emp.role === 'Ayudante';
        const helperInT = workingEmployees.some(e => e.role === 'Ayudante' && schedule.get(e.id)!.get(day) === ShiftConst.Afternoon);
        
        if (currentT < minT) {
          if (isHelper && helperInT) {
            schedule.get(emp.id)!.set(day, ShiftConst.Morning);
            currentM++;
          } else {
            schedule.get(emp.id)!.set(day, ShiftConst.Afternoon);
            currentT++;
          }
        } else {
          schedule.get(emp.id)!.set(day, ShiftConst.Morning);
          currentM++;
        }
      });
    });

    return employees.map(e => ({
      employeeId: e.id,
      employeeName: e.name,
      role: e.role,
      shifts: DAYS_OF_WEEK.map(day => ({
        day,
        shift: schedule.get(e.id)?.get(day) || ShiftConst.Off
      }))
    }));
  }, [config, weekNumber]);

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(20);
    doc.text(`Turnos de Recepción - Semana ${weekNumber}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`${config.jefe} | ${config.subjefe}`, 14, 28);

    const tableData = scheduleData.map(row => [
      row.employeeName,
      ...row.shifts.map(s => s.shift)
    ]);

    doc.autoTable({
      startY: 35,
      head: [['Empleado', ...DAYS_OF_WEEK]],
      body: tableData,
      theme: 'grid',
      headStyles: { fillStyle: '#1f2937' },
      didParseCell: (data: any) => {
        if (data.section === 'body') {
          const val = data.cell.raw;
          if (val === 'M') data.cell.styles.fillColor = [254, 249, 195];
          if (val === 'T') data.cell.styles.fillColor = [254, 215, 170];
          if (val === 'L') data.cell.styles.fillColor = [243, 244, 246];
          if (val === 'N') data.cell.styles.fillColor = [191, 219, 254];
        }
      }
    });

    doc.save(`turnos-semana-${weekNumber}.pdf`);
  };

  const changeWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(startOfWeek);
    newDate.setDate(newDate.getDate() + (direction === 'prev' ? -7 : 7));
    setCurrentDate(newDate);
  };

  if (!config.isConfigured) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <SetupForm onSave={setConfig} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-end md:items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm border-b-4 border-b-blue-600">
           <div>
             <div className="flex items-center space-x-3 text-blue-600 mb-1">
               <span className="text-xs font-black uppercase tracking-widest bg-blue-50 px-2 py-1 rounded">Semana {weekNumber}</span>
               <span className="h-1 w-8 bg-blue-100 rounded-full"></span>
             </div>
             <h1 className="text-3xl font-black text-gray-900 tracking-tight">TURNOS DE RECEPCIÓN</h1>
           </div>
           
           <div className="flex space-x-3 mt-4 md:mt-0">
             <button 
                onClick={() => setConfig({ ...config, isConfigured: false })}
                className="px-4 py-2 border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-400 rounded-xl transition text-sm font-bold flex items-center space-x-2"
                title="Nueva Configuración"
             >
                <RefreshIcon />
                <span>Configurar</span>
             </button>
             <button 
                onClick={handleExportPDF}
                className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition text-sm"
             >
                Exportar PDF
             </button>
           </div>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
          <ScheduleCalendar 
            startOfWeek={startOfWeek}
            scheduleData={scheduleData}
            onChangeWeek={changeWeek}
            onExportExcel={() => {}} // Legacy prop
            onForceGenerate={() => {}} // Automated now
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-60">
           <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Mínimos</h4>
              <p className="text-xs text-blue-800">L-J: 3M/2T | V-D: 4M/2T</p>
           </div>
           <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
              <h4 className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-2">Ayudantes</h4>
              <p className="text-xs text-orange-800">Libres coinciden. No coinciden en Tarde.</p>
           </div>
           <div className="bg-gray-100 p-4 rounded-2xl border border-gray-200">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Jefatura</h4>
              <p className="text-xs text-gray-600">Jefe: V-S Libre | 2º Jefe: D-L Libre.</p>
           </div>
        </div>
      </div>
    </div>
  );
}
