import React from 'react';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import SetupForm from './SetupForm';
import { AppConfig } from '../types';

interface ConfigDialogProps {
  config: AppConfig;
  onSave: (config: AppConfig) => void;
}

const ConfigDialog: React.FC<ConfigDialogProps> = ({ config, onSave }) => (
  <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-zinc-50 border-zinc-200 text-zinc-950">
    <DialogHeader className="border-b border-zinc-200 pb-3 mb-2">
      <DialogTitle className="text-2xl font-black text-zinc-900">Ajustes</DialogTitle>
      <DialogDescription className="text-sm text-zinc-500">Equipo, normas, personal por día, horarios, roles y seguridad.</DialogDescription>
    </DialogHeader>
    <SetupForm initialConfig={config} onSave={onSave} />
  </DialogContent>
);

export default ConfigDialog;
