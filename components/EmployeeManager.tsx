import React, { useState } from 'react';
import { Employee } from '../types';
import EmployeeForm from './EmployeeForm';
import { PlusIcon, UserIcon, EditIcon, TrashIcon, SuitcaseIcon } from './Icons';

interface EmployeeManagerProps {
  employees: Employee[];
  onAdd: (employee: Omit<Employee, 'id'>) => void;
  onUpdate: (employee: Employee) => void;
  onDelete: (employeeId: string) => void;
  onSetVacationWeek: (employeeId: string) => void;
  isFormOpen: boolean;
  setIsFormOpen: (isOpen: boolean) => void;
}

export default function EmployeeManager({ employees, onAdd, onUpdate, onDelete, onSetVacationWeek, isFormOpen, setIsFormOpen }: EmployeeManagerProps) {
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const handleEditClick = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsFormOpen(true);
  };

  const handleAddNewClick = () => {
    setEditingEmployee(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingEmployee(null);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Equipo</h2>
      <div className="space-y-3 mb-6">
        {employees.map(employee => (
          <div key={employee.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center space-x-3">
              <span className="p-2 bg-blue-100 text-blue-600 rounded-full"><UserIcon /></span>
              <div>
                <span className="font-medium text-gray-700">{employee.name}</span>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button 
                onClick={() => onSetVacationWeek(employee.id)} 
                className="text-gray-500 hover:text-green-600 p-2 rounded-full hover:bg-gray-100 transition"
                title="Marcar semana de vacaciones"
              >
                <SuitcaseIcon />
              </button>
              <button onClick={() => handleEditClick(employee)} className="text-gray-500 hover:text-blue-600 p-2 rounded-full hover:bg-gray-100 transition"><EditIcon /></button>
              <button onClick={() => onDelete(employee.id)} className="text-gray-500 hover:text-red-600 p-2 rounded-full hover:bg-gray-100 transition"><TrashIcon /></button>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={handleAddNewClick}
        className="w-full flex items-center justify-center space-x-2 bg-blue-600 text-white px-4 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
      >
        <PlusIcon />
        <span>Añadir Empleado</span>
      </button>

      {isFormOpen && (
        <EmployeeForm
          employee={editingEmployee}
          onSave={editingEmployee ? onUpdate : onAdd}
          onClose={handleCloseForm}
        />
      )}
    </div>
  );
}