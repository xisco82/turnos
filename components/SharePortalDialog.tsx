import React, { useState } from 'react';
import { Copy, Check, Share2, ExternalLink, MessageSquare, QrCode, Smartphone } from 'lucide-react';
import { Button } from './ui/button';

interface SharePortalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPreview: () => void;
}

export default function SharePortalDialog({ isOpen, onClose, onOpenPreview }: SharePortalDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate full employee portal URL
  const portalUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}${window.location.pathname}?portal=empleado`
    : '?portal=empleado';

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const whatsappMessage = `Hola equipo, aquí tenéis el enlace directo para solicitar vuestras vacaciones y días libres:\n\n${portalUrl}\n\nPodéis rellenar las fechas directamente desde vuestro móvil.`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white border-2 border-zinc-300 shadow-2xl max-w-lg w-full p-6 rounded-2xl animate-in zoom-in-95 duration-150 relative">
        
        {/* CLOSE BUTTON */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-900 text-xl font-bold p-1 leading-none"
        >
          ✕
        </button>

        {/* HEADER */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center text-xl shrink-0">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-zinc-900 tracking-tight">
              Enlace de Peticiones para el Personal
            </h3>
            <p className="text-xs text-zinc-500 font-medium">
              Envía este enlace a tus empleados para que pidan sus vacaciones desde su móvil
            </p>
          </div>
        </div>

        {/* URL BOX */}
        <div className="bg-zinc-50 border-2 border-zinc-200 rounded-xl p-3 mb-4">
          <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1">
            Enlace directo del portal:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={portalUrl}
              className="w-full text-xs font-mono font-bold text-zinc-800 bg-white border border-zinc-300 px-3 py-2 rounded-lg select-all"
            />
            <Button
              type="button"
              onClick={handleCopy}
              className={`shrink-0 text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition ${
                copied ? 'bg-emerald-600 text-white' : 'bg-teal-700 hover:bg-teal-800 text-white'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
            </Button>
          </div>
        </div>

        {/* SHARING ACTIONS */}
        <div className="space-y-2.5 mb-6">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-4 rounded-xl text-sm shadow-sm transition"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Compartir por WhatsApp con el Equipo</span>
          </a>

          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onClose();
              onOpenPreview();
            }}
            className="w-full flex items-center justify-center gap-2 border-2 border-zinc-300 text-zinc-800 hover:bg-zinc-100 font-bold py-2.5 rounded-xl text-xs"
          >
            <ExternalLink className="w-4 h-4 text-zinc-600" />
            <span>Abrir y Probar Portal de Empleados (Vista Previa)</span>
          </Button>
        </div>

        {/* EXPLANATION */}
        <div className="bg-teal-50/70 border border-teal-200/80 rounded-xl p-3.5 text-xs text-teal-950 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5 text-teal-900">
            <span>💡</span> ¿Cómo funciona para los empleados?
          </div>
          <p className="text-[11px] leading-relaxed text-teal-900/80">
            1. El empleado abre el enlace desde su teléfono sin necesidad de contraseñas.<br/>
            2. Selecciona su nombre, las fechas de vacaciones o libre y el motivo.<br/>
            3. Al enviarlo, la solicitud se registra y se aplica automáticamente en el cuadrante.
          </p>
        </div>

      </div>
    </div>
  );
}
