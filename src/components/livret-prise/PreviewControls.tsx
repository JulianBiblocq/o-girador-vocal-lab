import React from 'react';
import { Play, Square, Volume2, VolumeX, RotateCcw, ArrowRight, Filter, Zap, Sparkles } from 'lucide-react';
import type { AlignmentResult } from '../../utils/alignmentMath';
import { useLanguage } from '../../i18n/LanguageContext';
import { TrimSummaryBar } from './TrimSummaryBar';

interface PreviewControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  clickEnabled: boolean;
  onToggleClick: () => void;
  highPassEnabled: boolean;
  onToggleHighPass: () => void;
  tonePolishEnabled: boolean;
  onToggleTonePolish: () => void;
  onReset: () => void;
  onProceedToExtraction: () => void;
  alignment: AlignmentResult;
  hasAnacrusis?: boolean;
  disabled?: boolean;
}

export const PreviewControls: React.FC<PreviewControlsProps> = ({
  isPlaying, onTogglePlay, clickEnabled, onToggleClick,
  highPassEnabled, onToggleHighPass, tonePolishEnabled, onToggleTonePolish,
  onReset, onProceedToExtraction, alignment, hasAnacrusis = true, disabled = false,
}) => {
  const { t } = useLanguage();

  return (
    <div className="cordel-card p-3 flex flex-col gap-2.5">
      {/* 1. Métadonnées d'alignement et d'anacrouse */}
      <TrimSummaryBar alignment={alignment} hasAnacrusis={hasAnacrusis} />

      {/* 2. Options Audio Studio & Normalisation RMS */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-0.5">
        <div className="flex items-center gap-4">
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
          <label
            className="flex items-center gap-2 text-xs font-mono cursor-pointer select-none text-theme-ink/90 hover:text-theme-ink"
            title={t('clarityDeEsserTooltip')}
          >
            <input
              type="checkbox" checked={tonePolishEnabled} onChange={onToggleTonePolish}
              className="accent-[var(--cordel-wood)] w-3.5 h-3.5 cursor-pointer"
            />
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('clarityDeEsser')}</span>
            </span>
          </label>
        </div>
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
            isPlaying ? 'bg-red-900 text-[#f4ecd8] border-2 border-theme-border' : 'cordel-btn-primary'
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
          {clickEnabled ? <Volume2 className="w-4 h-4 text-[#f4ecd8]" /> : <VolumeX className="w-4 h-4" />}
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
