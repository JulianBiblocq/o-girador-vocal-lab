/**
 * SlicerTransportBar.tsx
 * Barre de transport, boucle, clic temoin et plantation de piquets (< 115 lignes).
 */
import React from 'react';
import { Play, Square, Flag, Trash2, Repeat, Clock } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface SlicerTransportBarProps {
  isPlaying: boolean; loop: boolean; witnessClick: boolean;
  pegsCount: number; measuresEstimate: number;
  onTogglePlay: () => void; onToggleLoop: () => void; onToggleWitnessClick: () => void;
  onPlantPeg: () => void; onClearPegs: () => void;
}

export const SlicerTransportBar: React.FC<SlicerTransportBarProps> = ({
  isPlaying, loop, witnessClick, pegsCount, measuresEstimate,
  onTogglePlay, onToggleLoop, onToggleWitnessClick, onPlantPeg, onClearPegs
}) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-theme-bg/60 border border-theme-border/60 text-xs font-mono">
      <div className="flex items-center gap-2">
        <button
          type="button" onClick={onTogglePlay}
          className={`h-8 px-3.5 cordel-btn-primary flex items-center gap-1.5 font-bold cursor-pointer transition-colors ${
            isPlaying ? 'bg-amber-600 hover:bg-amber-500' : ''
          }`}
          title="Lecture / Pause (Espace)"
        >
          {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
        </button>

        <button
          type="button" onClick={onToggleLoop}
          className={`h-8 px-2.5 cordel-card-sm flex items-center gap-1 cursor-pointer transition-colors ${
            loop ? 'bg-theme-wood text-[#f4ecd8] font-bold' : 'opacity-70 hover:opacity-100'
          }`}
          title="Lecture en boucle"
        >
          <Repeat className="w-3.5 h-3.5" />
          <span>{loop ? t('slicerLoopOn') : t('slicerLoopOff')}</span>
        </button>

        <button
          type="button" onClick={onToggleWitnessClick}
          className={`h-8 px-2.5 cordel-card-sm flex items-center gap-1 cursor-pointer transition-colors ${
            witnessClick ? 'bg-amber-500 text-stone-950 font-bold' : 'opacity-70 hover:opacity-100'
          }`}
          title="Clic témoin calé sur les temps cibles"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{witnessClick ? t('slicerWitnessClickOn') : t('slicerWitnessClickOff')}</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button" onClick={onPlantPeg}
          className="h-8 px-3 cordel-card-sm bg-theme-accent/20 hover:bg-theme-accent/40 text-theme-accent border border-theme-accent/50 flex items-center gap-1.5 font-bold cursor-pointer transition-colors"
          title="Planter un piquet à la position courante (Touche T)"
        >
          <Flag className="w-3.5 h-3.5 fill-current" />
          <span>{t('slicerPlantPegBtn')}</span>
        </button>

        {pegsCount > 0 && (
          <button
            type="button" onClick={onClearPegs}
            className="h-8 px-2 cordel-card-sm text-red-400 hover:text-red-300 border border-red-500/40 hover:bg-red-950/30 flex items-center gap-1 cursor-pointer transition-colors"
            title="Effacer tous les piquets"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('slicerClearPegsBtn')}</span>
          </button>
        )}

        <span className="text-[11px] text-theme-ink/70 px-1 font-bold">
          {t('slicerPegsCount', { count: pegsCount, measures: measuresEstimate })}
        </span>
      </div>
    </div>
  );
};
