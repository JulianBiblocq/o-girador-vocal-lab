import React from 'react';
import { Play, Square, Volume2, VolumeX, RotateCcw, ArrowRight, Filter, Zap } from 'lucide-react';
import type { AlignmentResult } from '../../utils/alignmentMath';
import { useLanguage } from '../../i18n/LanguageContext';

interface PreviewControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  clickEnabled: boolean;
  onToggleClick: () => void;
  highPassEnabled: boolean;
  onToggleHighPass: () => void;
  onReset: () => void;
  onProceedToExtraction: () => void;
  alignment: AlignmentResult;
  disabled?: boolean;
}

export const PreviewControls: React.FC<PreviewControlsProps> = ({
  isPlaying, onTogglePlay, clickEnabled, onToggleClick,
  highPassEnabled, onToggleHighPass, onReset, onProceedToExtraction,
  alignment, disabled = false,
}) => {
  const { t } = useLanguage();

  return (
    <div className="cordel-card p-3 flex flex-col gap-2.5">
      {/* 1. Métadonnées d'alignement et d'anacrouse */}
      <div className="flex items-center justify-between text-xs font-mono bg-black/30 p-2 border border-theme-border/30">
        <div className="flex items-center gap-1.5">
          <span className="opacity-70">{t('offsetMeasure1')}</span>
          <span className={`font-bold ${alignment.startOffsetSec < 0 ? 'text-theme-accent' : 'text-emerald-400'}`}>
            {alignment.startOffsetSec >= 0 ? '+' : ''}{alignment.startOffsetSec.toFixed(3)}s
          </span>
          {alignment.anacrusis.hasAnacrusis && (
            <span className="text-[10px] text-theme-accent border border-theme-accent/50 px-1 py-0.5">
              {t('anacrusisLabel')} ({t('anacrusisBeats', { beats: alignment.anacrusis.beats.toFixed(1) })})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="opacity-70">{t('cleanDurationLabel')}</span>
          <span className="font-bold text-theme-ink">{alignment.cleanDurationSec.toFixed(2)}s</span>
        </div>
      </div>

      {/* 2. Options Audio Studio & Normalisation RMS */}
      <div className="flex items-center justify-between px-1 py-0.5">
        <label className="flex items-center gap-2 text-xs font-mono cursor-pointer select-none text-theme-ink/90 hover:text-theme-ink">
          <input
            type="checkbox" checked={highPassEnabled} onChange={onToggleHighPass}
            className="accent-[var(--cordel-wood)] w-3.5 h-3.5 cursor-pointer"
          />
          <span className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-theme-accent" />
            <span>{t('lowCutStudio')}</span>
          </span>
        </label>
        <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>{t('normalizedVolume')}</span>
        </span>
      </div>

      {/* 3. Barre d'actions de pré-écoute & Clic */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-theme-border/20">
        <button
          type="button" disabled={disabled} onClick={onTogglePlay}
          className={`py-2 px-3 flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
            isPlaying ? 'bg-red-900 text-white border-2 border-theme-border' : 'cordel-btn-primary'
          }`}
        >
          {isPlaying ? (
            <>
              <Square className="w-4 h-4 fill-current" />
              <span>{t('stopTake')}</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>{t('listenTakeAgain')}</span>
            </>
          )}
        </button>

        <button
          type="button" disabled={disabled} onClick={onToggleClick}
          className={`py-2 px-3 flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
            clickEnabled ? 'cordel-btn-primary' : 'cordel-btn opacity-70'
          }`}
          title={t('clickWitness')}
        >
          {clickEnabled ? <Volume2 className="w-4 h-4 text-white" /> : <VolumeX className="w-4 h-4" />}
          <span>{t('clickWitness')}</span>
        </button>

        <button
          type="button" disabled={disabled || isPlaying} onClick={onReset}
          className="cordel-btn py-2 px-3 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer opacity-80 hover:opacity-100"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t('rerecordTake')}</span>
        </button>

        <button
          type="button" disabled={disabled || isPlaying} onClick={onProceedToExtraction}
          className="cordel-btn-primary py-2 px-3 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer bg-emerald-800 hover:bg-emerald-700"
        >
          <span>{t('extractMelodyAndLyrics')}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
