/**
 * PianoRollContextMenu.tsx
 * Menu d'outils bilingue (FR / PT-BR) au Clic Droit façon Cubase (Maintenir ➔ Glisser ➔ Relâcher ou Clic rapide) :
 * Sélection, Crayon, Ciseaux, Colle, Gomme (< 98 lignes).
 */
import React, { useEffect, useRef, useState } from 'react';
import type { PianoRollTool } from './pianoRollInteractions';
import { useLanguage } from '../../i18n/LanguageContext';
import { MousePointer, Pencil, Scissors, Link2, Eraser } from 'lucide-react';

export interface PianoRollContextMenuProps {
  x: number;
  y: number;
  activeTool: PianoRollTool;
  onSelectTool: (tool: PianoRollTool) => void;
  onClose: () => void;
}

export const PianoRollContextMenu: React.FC<PianoRollContextMenuProps> = ({
  x, y, activeTool, onSelectTool, onClose,
}) => {
  const { language } = useLanguage();
  const isBr = language === 'br';
  const menuRef = useRef<HTMLDivElement>(null);
  const [hoveredTool, setHoveredTool] = useState<PianoRollTool | null>(null);

  const cubaseTools: Array<{ id: PianoRollTool; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'pointer', label: isBr ? 'Seleção' : 'Sélection', icon: MousePointer },
    { id: 'draw_move', label: isBr ? 'Lápis' : 'Crayon', icon: Pencil },
    { id: 'cut', label: isBr ? 'Tesoura' : 'Ciseaux', icon: Scissors },
    { id: 'glue', label: isBr ? 'Cola' : 'Colle', icon: Link2 },
    { id: 'erase', label: isBr ? 'Borracha' : 'Gomme', icon: Eraser },
  ];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onPointerMove = (e: PointerEvent | MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-cubase-tool]') as HTMLElement | null;
      setHoveredTool((el?.getAttribute('data-cubase-tool') as PianoRollTool) ?? null);
    };
    const onPointerUp = (e: PointerEvent | MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-cubase-tool]') as HTMLElement | null;
      const toolId = el?.getAttribute('data-cubase-tool') as PianoRollTool | null;
      if (toolId) {
        onSelectTool(toolId);
        onClose();
        return;
      }
      const dist = Math.hypot(e.clientX - x, e.clientY - y);
      if (dist > 14) onClose();
    };
    const onPointerDownOutside = (e: PointerEvent | MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointermove', onPointerMove, { capture: true });
    window.addEventListener('pointerup', onPointerUp, { capture: true });
    window.addEventListener('pointerdown', onPointerDownOutside, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointermove', onPointerMove, { capture: true });
      window.removeEventListener('pointerup', onPointerUp, { capture: true });
      window.removeEventListener('pointerdown', onPointerDownOutside, { capture: true });
    };
  }, [x, y, onSelectTool, onClose]);

  const clampedX = Math.max(10, Math.min(window.innerWidth - 340, x - 90));
  const clampedY = Math.max(10, Math.min(window.innerHeight - 70, y - 22));

  return (
    <div
      ref={menuRef}
      onContextMenu={(e) => e.preventDefault()}
      style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
      className="fixed z-50 p-1.5 cordel-card shadow-xl flex items-center gap-1 rounded border border-amber-500/60 select-none"
    >
      {cubaseTools.map((item) => {
        const Icon = item.icon;
        const isCurrent = activeTool === item.id || hoveredTool === item.id;
        return (
          <button
            key={item.id}
            type="button"
            data-cubase-tool={item.id}
            onMouseEnter={() => setHoveredTool(item.id)}
            onMouseLeave={() => setHoveredTool(null)}
            onMouseUp={(e) => { e.preventDefault(); e.stopPropagation(); onSelectTool(item.id); onClose(); }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSelectTool(item.id); onClose(); }}
            className={`px-2.5 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 rounded cursor-pointer transition-colors ${
              isCurrent ? 'bg-amber-600 text-white shadow-sm' : 'cordel-btn hover:bg-amber-500/20'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
