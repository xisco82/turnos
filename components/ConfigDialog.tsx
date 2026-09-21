import React from 'react';
import { DialogContent } from './ui/dialog';
import SetupForm from './SetupForm';
import { AppConfig } from '../types';

interface ConfigDialogProps {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
}

const ConfigDialog: React.FC<ConfigDialogProps> = ({ config, onSave }) => {
  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white border-zinc-200 text-zinc-950">
      <div className="p-2">
        <h2 className="text-3xl font-black italic uppercase mb-8 tracking-tighter">Panel de Configuración</h2>
        <SetupForm initialConfig={config} onSave={onSave} />
      </div>
    </DialogContent>
  );
};

export default ConfigDialog;
