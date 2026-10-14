import React from 'react';
import { Play, Square, Volume2, VolumeX, RotateCcw, ArrowRight } from 'lucide-react';
import type { AlignmentResult } from '../../utils/alignmentMath';

interface PreviewControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  clickEnabled: boolean;
  onToggleClick: () => void;
  onReset: () => void;
  onProceedToExtraction: () => void;
  alignment: AlignmentResult;
  disabled?: boolean;
}

export const PreviewControls: React.FC<PreviewControlsProps> = ({
  isPlaying,
  onTogglePlay,
  clickEnabled,
  onToggleClick,
  onReset,
  onProceedToExtraction,
  alignment,
  disabled = false,
}) => {
  return (
    <div className="cordel-card p-3 flex flex-col gap-3">
      {/* 1. Métadonnées d'alignement et d'anacrouse calculées */}
      <div className="flex items-center justify-between text-xs font-mono bg-black/30 p-2 border border-theme-border/30">
        <div className="flex items-center gap-1.5">
          <span className="opacity-70">Décalage T1 :</span>
          <span className={`font-bold ${alignment.startOffsetSec < 0 ? 'text-theme-accent' : 'text-emerald-400'}`}>
            {alignment.startOffsetSec >= 0 ? '+' : ''}{alignment.startOffsetSec.toFixed(3)}s
          </span>
          {alignment.anacrusis.hasAnacrusis && (
            <span className="text-[10px] text-theme-accent border border-theme-accent/50 px-1 py-0.5">
              Anacrouse ({alignment.anacrusis.beats.toFixed(1)} tps)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="opacity-70">Durée utile :</span>
          <span className="font-bold text-theme-ink">{alignment.cleanDurationSec.toFixed(2)}s</span>
        </div>
      </div>

      {/* 2. Barre d'actions de pré-écoute & Clic */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Play / Stop */}
        <button
          type="button"
          disabled={disabled}
          onClick={onTogglePlay}
          className={`py-2 px-3 flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
            isPlaying ? 'bg-red-900 text-theme-ink border-2 border-theme-border' : 'cordel-btn-primary'
          }`}
        >
          {isPlaying ? (
            <>
              <Square className="w-4 h-4 fill-current" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Réécouter</span>
            </>
          )}
        </button>

        {/* Clic témoin toggle */}
        <button
          type="button"
          disabled={disabled}
          onClick={onToggleClick}
          className={`py-2 px-3 flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
            clickEnabled ? 'cordel-btn-primary' : 'cordel-btn opacity-70'
          }`}
          title="Activer/Désactiver le clic témoin pendant la pré-écoute"
        >
          {clickEnabled ? <Volume2 className="w-4 h-4 text-theme-accent" /> : <VolumeX className="w-4 h-4" />}
          <span>Clic Témoin</span>
        </button>

        {/* Jeter et refaire */}
        <button
          type="button"
          disabled={disabled || isPlaying}
          onClick={onReset}
          className="cordel-btn py-2 px-3 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer opacity-80 hover:opacity-100"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refaire</span>
        </button>

        {/* Action suivante */}
        <button
          type="button"
          disabled={disabled || isPlaying}
          onClick={onProceedToExtraction}
          className="cordel-btn-primary py-2 px-3 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer bg-emerald-800 hover:bg-emerald-700"
        >
          <span>Extraire</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
