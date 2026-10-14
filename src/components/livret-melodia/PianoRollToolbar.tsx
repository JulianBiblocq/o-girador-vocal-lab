/**
 * PianoRollToolbar.tsx
 * Barre d'outils du Piano Roll unifiée sur 1 seule ligne avec support i18n pur via t.
 */
import React from 'react';
import type { PianoRollTool } from './pianoRollInteractions';
import { SCALE_DEFINITIONS, type ScaleType } from '../../audio/scaleQuantizer';
import { NOTE_NAMES } from '../../utils/noteUtils';
import { MousePointer, Link2, Scissors, Eraser, Type, ZoomIn, Undo2, Redo2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { TranslationKey } from '../../i18n/i18n.types';

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
  canUndo?: boolean;
  canRedo?: boolean;
  historyCount?: number;
  onUndo?: () => void;
  onRedo?: () => void;
}

const SCALE_I18N_KEYS: Record<ScaleType, TranslationKey> = {
  chromatic: 'scaleChromatic',
  major: 'scaleMajor',
  natural_minor: 'scaleNaturalMinor',
  mixolydian: 'scaleMixolydian',
  dorian: 'scaleDorian',
  pentatonic_minor: 'scalePentatonicMinor',
  pentatonic_major: 'scalePentatonicMajor',
};

export const PianoRollToolbar: React.FC<PianoRollToolbarProps> = (props) => {
  const { activeTool, onSelectTool, zoomLevel, onSetZoom, tonic, onSetTonic, scaleType, onSetScaleType, smoothingLevel, onSetSmoothingLevel, canUndo, canRedo, historyCount, onUndo, onRedo } = props;
  const { t } = useLanguage();

  const tools: { id: PianoRollTool; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'pointer', label: t('toolPointer'), icon: MousePointer },
    { id: 'glue', label: t('toolGlue'), icon: Link2 },
    { id: 'cut', label: t('toolCut'), icon: Scissors },
    { id: 'erase', label: t('toolErase'), icon: Eraser },
    { id: 'text', label: t('toolText'), icon: Type },
  ];

  return (
    <div className="cordel-card p-2 w-full flex flex-wrap items-center justify-between gap-3 bg-black/60 rounded-none">
      {/* 1. Gauche : 5 Outils + Bloc jumelé Undo/Redo */}
      <div className="flex items-center gap-2">
        <div className="flex items-center border border-theme-border/60">
          {tools.map((item) => {
            const Icon = item.icon;
            const isActive = activeTool === item.id;
            return (
              <button
                key={item.id} type="button" onClick={() => onSelectTool(item.id)} title={item.label}
                className={`px-2 py-1 text-xs font-mono flex items-center gap-1 border-r last:border-r-0 border-theme-border/40 transition-all rounded-none cursor-pointer ${
                  isActive ? 'bg-theme-wood text-white font-bold' : 'text-theme-ink/75 hover:bg-white/10 hover:text-theme-ink'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center border border-theme-border/60">
          <button
            type="button" onClick={onUndo} disabled={!canUndo} title={t('undo')}
            className={`px-2 py-1 text-xs font-mono flex items-center gap-1 border-r border-theme-border/40 transition-all rounded-none cursor-pointer ${
              canUndo ? 'text-theme-ink hover:bg-white/10' : 'text-stone-600 cursor-not-allowed opacity-40'
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />
            {historyCount !== undefined && historyCount > 0 && <span className="text-[10px] text-theme-accent font-bold">({historyCount})</span>}
          </button>
          <button
            type="button" onClick={onRedo} disabled={!canRedo} title={t('redo')}
            className={`px-2 py-1 text-xs font-mono flex items-center gap-1 transition-all rounded-none cursor-pointer ${
              canRedo ? 'text-theme-ink hover:bg-white/10' : 'text-stone-600 cursor-not-allowed opacity-40'
            }`}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Centre : Gamme & Lissage */}
      <div className="flex items-center gap-3 text-[11px] font-mono">
        <div className="flex items-center gap-1.5">
          <span className="text-theme-ink/75 font-bold">{t('scaleLabel')} :</span>
          <select value={tonic} onChange={(e) => onSetTonic(e.target.value)} className="px-1.5 py-0.5 bg-black/40 border border-theme-border/50 text-theme-accent font-bold outline-none rounded-none cursor-pointer">
            {NOTE_NAMES.map((n) => <option key={n} value={n} className="bg-theme-bg text-theme-ink">{n}</option>)}
          </select>
          <select value={scaleType} onChange={(e) => onSetScaleType(e.target.value as ScaleType)} className="px-1.5 py-0.5 bg-black/40 border border-theme-border/50 text-theme-accent font-bold outline-none rounded-none cursor-pointer">
            {Object.keys(SCALE_DEFINITIONS).map((key) => (
              <option key={key} value={key} className="bg-theme-bg text-theme-ink">
                {t(SCALE_I18N_KEYS[key as ScaleType])}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-theme-ink/75 font-bold">{t('smoothingLabel')} :</span>
          <span className="text-[10px] text-theme-ink/50">{t('smoothingFine')}</span>
          <input type="range" min={0} max={1} step={0.1} value={smoothingLevel} onChange={(e) => onSetSmoothingLevel(parseFloat(e.target.value))} className="w-16 accent-[var(--cordel-wood)] cursor-pointer" />
          <span className="text-[10px] text-theme-ink/50">{t('smoothingWide')}</span>
        </div>
      </div>

      {/* 3. Droite : Zoom */}
      <div className="flex items-center border border-theme-border/60">
        <span className="px-1.5 py-0.5 text-xs text-theme-ink/60 border-r border-theme-border/40"><ZoomIn className="w-3.5 h-3.5" /></span>
        {[1, 2, 4, 8].map((z) => (
          <button
            key={z} type="button" onClick={() => onSetZoom(z)}
            className={`px-2 py-0.5 text-[11px] font-mono border-r last:border-r-0 border-theme-border/40 transition-all rounded-none cursor-pointer ${
              zoomLevel === z ? 'bg-theme-wood text-white font-bold' : 'text-theme-ink/70 hover:bg-white/10'
            }`}
          >
            {z}x
          </button>
        ))}
      </div>
    </div>
  );
};
