/**
 * PianoRollToolbar.tsx
 * Barre d'outils du Piano Roll : Outils d'édition MIDI, Zoom horizontal,
 * Gamme / Tonique et Lissage des tenues.
 */
import React from 'react';
import type { PianoRollTool } from './pianoRollInteractions';
import { SCALE_DEFINITIONS, type ScaleType } from '../../audio/scaleQuantizer';
import { NOTE_NAMES } from '../../utils/noteUtils';
import { MousePointer, Link2, Scissors, Eraser, Type, ZoomIn } from 'lucide-react';

interface PianoRollToolbarProps {
  activeTool: PianoRollTool;
  onSelectTool: (tool: PianoRollTool) => void;
  zoomLevel: number;
  onSetZoom: (zoom: number) => void;
  tonic: string;
  onSetTonic: (t: string) => void;
  scaleType: ScaleType;
  onSetScaleType: (st: ScaleType) => void;
  smoothingLevel: number;
  onSetSmoothingLevel: (lvl: number) => void;
}

const TOOLS: { id: PianoRollTool; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'pointer', label: 'Déplacer/Écrire', icon: MousePointer },
  { id: 'glue', label: 'Coller', icon: Link2 },
  { id: 'cut', label: 'Couper', icon: Scissors },
  { id: 'erase', label: 'Gomme', icon: Eraser },
  { id: 'text', label: 'Texte', icon: Type },
];

export const PianoRollToolbar: React.FC<PianoRollToolbarProps> = (props) => {
  const { activeTool, onSelectTool, zoomLevel, onSetZoom, tonic, onSetTonic, scaleType, onSetScaleType, smoothingLevel, onSetSmoothingLevel } = props;

  return (
    <div className="flex flex-col gap-1.5 p-2 bg-black/60 border border-theme-border/60 rounded-xl">
      {/* Ligne 1 : Outils d'édition & Zoom */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTool(t.id)}
                className={`px-2 py-1 rounded text-xs font-mono flex items-center gap-1 transition-all ${
                  isActive
                    ? 'bg-amber-600 text-white font-bold shadow-sm'
                    : 'text-theme-ink/70 hover:bg-white/10 hover:text-theme-ink'
                }`}
                title={t.label}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Zoom Presets */}
        <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
          <ZoomIn className="w-3.5 h-3.5 text-theme-ink/50 ml-1" />
          {[1, 2, 4, 8].map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => onSetZoom(z)}
              className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition-all ${
                zoomLevel === z ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40' : 'text-theme-ink/60 hover:text-theme-ink'
              }`}
            >
              {z}x
            </button>
          ))}
        </div>
      </div>

      {/* Ligne 2 : Tonique, Gamme et Lissage */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5 text-[11px] font-mono">
        <div className="flex items-center gap-2">
          <span className="text-theme-ink/60">Gamme :</span>
          <select
            value={tonic}
            onChange={(e) => onSetTonic(e.target.value)}
            className="px-1.5 py-0.5 bg-black/50 border border-theme-border/40 rounded text-amber-300 outline-none"
          >
            {NOTE_NAMES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <select
            value={scaleType}
            onChange={(e) => onSetScaleType(e.target.value as ScaleType)}
            className="px-1.5 py-0.5 bg-black/50 border border-theme-border/40 rounded text-amber-300 outline-none"
          >
            {Object.entries(SCALE_DEFINITIONS).map(([key, def]) => (
              <option key={key} value={key}>{def.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-theme-ink/60">Lissage :</span>
          <span className="text-[10px] text-theme-ink/40">Fin</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={smoothingLevel}
            onChange={(e) => onSetSmoothingLevel(parseFloat(e.target.value))}
            className="w-20 accent-amber-500 cursor-pointer"
          />
          <span className="text-[10px] text-theme-ink/40">Large</span>
        </div>
      </div>
    </div>
  );
};
