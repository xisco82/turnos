import React from 'react';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import SetupForm from './SetupForm';
import { AppConfig } from '../types';

interface ConfigDialogProps {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
}

const ConfigDialog: React.FC<ConfigDialogProps> = ({ config, onSave }) => {
  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white border-zinc-200 text-zinc-950">
      <DialogHeader className="p-2 border-b border-zinc-100 pb-4 mb-4">
        <DialogTitle className="text-3xl font-black italic uppercase tracking-tighter text-zinc-900">
          Panel de Configuración
        </DialogTitle>
        <DialogDescription className="text-sm text-zinc-500 font-medium">
          Configuración general de empleados, turnos y personal de recepción.
        </DialogDescription>
      </DialogHeader>
      <div className="p-2">
        <SetupForm initialConfig={config} onSave={onSave} />
      </div>
    </DialogContent>
  );
};

export default ConfigDialog;
