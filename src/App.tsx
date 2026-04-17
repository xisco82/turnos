import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Calendar, 
  Settings, 
  FileText, 
  Plus, 
  ChevronLeft, 
  ChevronRight,
  Download,
  AlertCircle
} from 'lucide-react';
import { db } from './lib/firebase-client.ts';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Employee, ScheduleRequest, Schedule } from './types.ts';
import EmployeeManager from './components/EmployeeManager.tsx';
import RequestManager from './components/RequestManager.tsx';
import ScheduleViewer from './components/ScheduleViewer.tsx';
import ConfigManager from './components/ConfigManager.tsx';

type Tab = 'schedule' | 'employees' | 'requests' | 'config';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('schedule');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [requests, setRequests] = useState<ScheduleRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
      setLoading(false);
    });

    const unsubRequests = onSnapshot(
      query(collection(db, 'requests'), orderBy('startDate', 'desc')), 
      (snapshot) => {
        setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ScheduleRequest)));
      }
    );

    return () => {
      unsubEmployees();
      unsubRequests();
    };
  }, []);

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'schedule', label: 'Horarios', icon: Calendar },
    { id: 'employees', label: 'Personal', icon: Users },
    { id: 'requests', label: 'Peticiones', icon: FileText },
    { id: 'config', label: 'Configuración', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-card-bg border border-border-main m-4 md:m-8 mb-6 rounded-2xl shadow-sm sticky top-6 z-10 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-extrabold text-brand-primary tracking-tight uppercase leading-none">TURNOS XISCO</h1>
          </div>

          <nav className="hidden md:flex items-center gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                  activeTab === tab.id 
                    ? 'bg-text-main text-white shadow-md' 
                    : 'text-text-muted hover:bg-slate-50'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button className="md:hidden p-2 text-slate-600">
              <Plus size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        <AnimatePresence mode="wait">
          {loading ? (
             <motion.div 
               key="loading"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="flex flex-col items-center justify-center h-64 gap-4"
             >
                <div className="w-12 h-12 border-4 border-slate-200 border-t-brand-primary rounded-full animate-spin"></div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cargando Sistema...</p>
             </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'schedule' && <ScheduleViewer employees={employees} />}
              {activeTab === 'employees' && <EmployeeManager employees={employees} />}
              {activeTab === 'requests' && <RequestManager employees={employees} requests={requests} />}
              {activeTab === 'config' && <ConfigManager />}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Nav */}
      <nav className="md:hidden bg-card-bg border-t border-border-main p-2 grid grid-cols-4 gap-1 sticky bottom-0 z-10 shadow-lg">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-1 py-1 rounded-lg transition-all ${
              activeTab === tab.id 
                ? 'text-brand-primary' 
                : 'text-text-muted'
            }`}
          >
            <tab.icon size={18} />
            <span className="text-[9px] font-bold uppercase tracking-tight">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
