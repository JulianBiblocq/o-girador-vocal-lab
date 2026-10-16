/**
 * PianoRollToolPopover.tsx
 * Palette contextuelle compacte au clic droit regroupant les 6 outils (< 95 lignes).
 * Fermeture sur clic outil, clic extérieur ou Escape.
 */
import React, { useEffect, useRef } from 'react';
import type { PianoRollTool } from './pianoRollInteractions';
import { MousePointer, Link2, Scissors, Eraser, Type, Wand2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface PianoRollToolPopoverProps {
  x: number;
  y: number;
  activeTool: PianoRollTool;
  onSelectTool: (tool: PianoRollTool) => void;
  onClose: () => void;
}

export const PianoRollToolPopover: React.FC<PianoRollToolPopoverProps> = ({
  x, y, activeTool, onSelectTool, onClose,
}) => {
  const { t } = useLanguage();
  const popoverRef = useRef<HTMLDivElement>(null);

  const tools: { id: PianoRollTool; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'pointer', label: t('toolPointer'), icon: MousePointer },
    { id: 'glue', label: t('toolGlue'), icon: Link2 },
    { id: 'cut', label: t('toolCut'), icon: Scissors },
    { id: 'melodyne_cut', label: t('toolMelodyneCut'), icon: Wand2 },
    { id: 'erase', label: t('toolErase'), icon: Eraser },
    { id: 'text', label: t('toolText'), icon: Type },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handlePointerDownOutside = (e: MouseEvent | PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDownOutside, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDownOutside, { capture: true });
    };
  }, [onClose]);

  // Bridage pour ne pas déborder de l'écran (6 boutons x 36px + paddings ~ 260px)
  const clampedX = Math.max(10, Math.min(window.innerWidth - 270, x));
  const clampedY = Math.max(10, Math.min(window.innerHeight - 65, y));

  return (
    <div
      ref={popoverRef}
      style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
      className="fixed z-50 p-1.5 bg-stone-900/95 backdrop-blur-md border-2 border-amber-400 rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,0.85)] flex items-center gap-1 animate-in fade-in zoom-in-95 duration-100"
    >
      {tools.map((item) => {
        const Icon = item.icon;
        const isActive = activeTool === item.id;
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            onClick={() => { onSelectTool(item.id); onClose(); }}
            className={`w-9 h-9 rounded-none flex items-center justify-center transition-all cursor-pointer ${
              isActive
                ? 'bg-theme-wood text-[#f4ecd8] shadow-md border border-amber-400 font-bold'
                : 'bg-white/5 text-stone-200 hover:bg-white/15 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4 text-current" />
          </button>
        );
      })}
    </div>
  );
};
