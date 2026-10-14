/**
 * PianoRollToolPalette.tsx
 * Palette contextuelle 100% icônes (5 boutons 36x36 px) au Clic Droit.
 */
import React, { useEffect, useRef } from 'react';
import type { PianoRollTool } from './pianoRollInteractions';
import { MousePointer, Link2, Scissors, Eraser, Type } from 'lucide-react';

interface PianoRollToolPaletteProps {
  x: number;
  y: number;
  activeTool: PianoRollTool;
  onSelectTool: (tool: PianoRollTool) => void;
  onClose: () => void;
}

const PALETTE_TOOLS: { id: PianoRollTool; title: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'pointer', title: 'Déplacer / Écrire / Étirer', icon: MousePointer },
  { id: 'glue', title: 'Coller / Fusionner', icon: Link2 },
  { id: 'cut', title: 'Couper la tenue', icon: Scissors },
  { id: 'erase', title: 'Gomme', icon: Eraser },
  { id: 'text', title: 'Saisie de texte', icon: Type },
];

export const PianoRollToolPalette: React.FC<PianoRollToolPaletteProps> = ({ x, y, activeTool, onSelectTool, onClose }) => {
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handlePointerDownOutside = (e: MouseEvent | PointerEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
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

  // Bridage pour ne pas déborder de l'écran
  const clampedX = Math.max(12, Math.min(window.innerWidth - 225, x));
  const clampedY = Math.max(12, Math.min(window.innerHeight - 60, y));

  return (
    <div
      ref={paletteRef}
      style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
      className="fixed z-50 p-1.5 bg-stone-900/95 backdrop-blur-md border border-amber-500/50 rounded-xl shadow-2xl flex items-center gap-1 animate-in fade-in zoom-in-95 duration-100"
    >
      {PALETTE_TOOLS.map((t) => {
        const Icon = t.icon;
        const isActive = activeTool === t.id;
        return (
          <button
            key={t.id}
            type="button"
            title={t.title}
            onClick={() => { onSelectTool(t.id); onClose(); }}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              isActive
                ? 'bg-amber-600 text-white shadow-md border border-amber-400/60'
                : 'bg-white/5 text-stone-200 hover:bg-white/15 hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
};
