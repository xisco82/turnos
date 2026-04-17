import React, { useState } from 'react';
import { PlusIcon, TrashIcon } from './Icons';

interface FlexibleShiftsManagerProps {
    flexibleShifts: Record<string, string>;
    onAdd: (code: string, description: string) => void;
    onDelete: (code: string) => void;
}

export default function FlexibleShiftsManager({ flexibleShifts, onAdd, onDelete }: FlexibleShiftsManagerProps) {
    const [code, setCode] = useState('');
    const [description, setDescription] = useState('');

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        const upperCaseCode = code.trim();
        if (upperCaseCode && description.trim()) {
            onAdd(upperCaseCode, description.trim());
            setCode('');
            setDescription('');
        }
    };

    return (
        <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Horarios Flexibles</h2>
            
            <div className="space-y-2 mb-6">
                 {Object.entries(flexibleShifts).map(([code, description]) => (
                    <div key={code} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <div>
                             <span className="font-bold text-teal-800 bg-teal-200 px-2 py-1 rounded-md text-sm">{code}</span>
                             <span className="ml-3 font-medium text-gray-600">{description}</span>
                        </div>
                        <button onClick={() => onDelete(code)} className="text-gray-500 hover:text-red-600 p-2 rounded-full hover:bg-gray-100 transition"><TrashIcon /></button>
                    </div>
                ))}
                {Object.keys(flexibleShifts).length === 0 && (
                    <p className="text-sm text-gray-500 italic text-center py-2">No hay horarios flexibles definidos.</p>
                )}
            </div>

            <form onSubmit={handleAdd} className="p-4 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-700 mb-3">Añadir nuevo horario</h3>
                <div className="flex items-start space-x-2">
                    <div className="flex-shrink-0 w-28">
                        <label htmlFor="shift-code" className="text-sm font-medium text-gray-600">Código/Horario</label>
                        <input
                            id="shift-code"
                            type="text"
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            className="w-full mt-1 px-2 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Ej: 10-18"
                            maxLength={15}
                            required
                        />
                    </div>
                    <div className="flex-grow">
                        <label htmlFor="shift-desc" className="text-sm font-medium text-gray-600">Descripción</label>
                        <input
                            id="shift-desc"
                            type="text"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Ej: Turno partido"
                            required
                        />
                    </div>
                </div>
                 <button
                    type="submit"
                    className="w-full mt-4 flex items-center justify-center space-x-2 bg-teal-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-teal-700 transition"
                >
                    <PlusIcon />
                    <span>Añadir Horario</span>
                </button>
            </form>
        </div>
    );
}