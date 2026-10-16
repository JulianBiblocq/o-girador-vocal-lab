import React from 'react';
import { Sliders, Clock, Music2, Grid } from 'lucide-react';
import type { TimeSignatureString } from '../../types/vocalPack.types';
import { useLanguage } from '../../i18n/LanguageContext';
import { NumericDraftInput } from '../ui/NumericDraftInput';

interface MetricConfigPanelProps {
  timeSignature: TimeSignatureString;
  onTimeSignatureChange: (sig: TimeSignatureString) => void;
  bpm: number;
  onBpmChange: (bpm: number) => void;
  measuresCount: number;
  onMeasuresCountChange: (count: number) => void;
  beatResolutions: number[];
  onBeatResolutionsChange: (resolutions: number[]) => void;
  hasAnacrusis?: boolean;
  onHasAnacrusisChange?: (has: boolean) => void;
  disabled?: boolean;
}

export const MetricConfigPanel: React.FC<MetricConfigPanelProps> = ({
  timeSignature, onTimeSignatureChange, bpm, onBpmChange,
  measuresCount, onMeasuresCountChange, beatResolutions,
  onBeatResolutionsChange, hasAnacrusis = true, onHasAnacrusisChange, disabled = false,
}) => {
  const { t } = useLanguage();

  const toggleBeatResolution = (idx: number) => {
    const next = [...beatResolutions];
    next[idx] = next[idx] === 4 ? 3 : 4;
    onBeatResolutionsChange(next);
  };

  return (
    <div className="cordel-card p-3 h-full flex flex-col justify-between gap-2.5">
      {/* 1. Signature Rythmique */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs font-bold uppercase text-theme-ink">
          <span className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-theme-accent" />
            {t('timeSignature')}
          </span>
          <span className="font-mono text-theme-accent text-xs">{timeSignature}</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {(['2/4', '3/4', '4/4', '6/8'] as TimeSignatureString[]).map((sig) => (
            <button
              key={sig} type="button" disabled={disabled} onClick={() => onTimeSignatureChange(sig)}
              className={`py-1 text-xs font-mono font-bold transition-all cursor-pointer ${timeSignature === sig ? 'cordel-btn-primary' : 'cordel-btn'}`}
            >
              {sig}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Tempo & Mesures de chant */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-theme-border/20">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-xs font-bold uppercase text-theme-ink">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-theme-accent" />
              BPM
            </span>
            <NumericDraftInput
              min={30} max={240} value={bpm} disabled={disabled} onChange={onBpmChange}
              className="w-14 bg-black/30 border border-theme-border text-center font-mono font-bold text-xs p-1 focus:outline-none focus:border-theme-accent"
            />
          </div>
          <input
            type="range" min={30} max={240} value={bpm} disabled={disabled}
            onChange={(e) => onBpmChange(Number(e.target.value))}
            onMouseUp={(e) => e.currentTarget.blur()} onTouchEnd={(e) => e.currentTarget.blur()}
            className="w-full accent-[var(--cordel-wood)] cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-theme-ink">
            <Music2 className="w-3.5 h-3.5 text-theme-accent" />
            {t('measuresCount')} (N)
          </span>
          <div className="grid grid-cols-4 gap-1">
            {[1, 2, 3, 4].map((count) => (
              <button
                key={count} type="button" disabled={disabled} onClick={() => onMeasuresCountChange(count)}
                className={`py-1 text-xs font-bold transition-all cursor-pointer ${measuresCount === count ? 'cordel-btn-primary' : 'cordel-btn'}`}
              >
                {t('measureUnitShort', { n: count })}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Subdivisions par temps */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-theme-border/20">
        <div className="flex items-center justify-between text-xs font-bold uppercase text-theme-ink">
          <span className="flex items-center gap-1.5">
            <Grid className="w-3.5 h-3.5 text-theme-accent" />
            {t('subdivisions')}
          </span>
          <span className="text-[10px] font-normal opacity-70">Bin / Tri</span>
        </div>
        <div className="grid grid-flow-col auto-cols-fr gap-1.5">
          {beatResolutions.map((res, idx) => (
            <button
              key={idx} type="button" disabled={disabled} onClick={() => toggleBeatResolution(idx)}
              className={`p-1.5 flex flex-col items-center justify-center text-xs font-mono transition-all cursor-pointer ${res === 4 ? 'cordel-card-sm' : 'cordel-btn-primary'}`}
            >
              <span className="text-[10px] opacity-75">T{idx + 1}</span>
              <span className="font-bold text-xs">{res === 4 ? '4 (Bin)' : '3 (Tri)'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Option Anacrouse (M-1) */}
      <div className="flex items-center justify-between text-xs font-bold uppercase text-theme-ink pt-1 border-t border-theme-border/20">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-theme-accent" />
          {t('anacrusisOption')} (M-1)
        </span>
        <div className="inline-flex cordel-card-sm p-0.5 text-xs font-mono">
          <button
            type="button" disabled={disabled} onClick={() => onHasAnacrusisChange?.(true)}
            className={`px-2.5 py-0.5 font-bold transition-all cursor-pointer ${hasAnacrusis !== false ? 'cordel-btn-primary' : 'opacity-60'}`}
          >
            {t('hasAnacrusisYes')}
          </button>
          <button
            type="button" disabled={disabled} onClick={() => onHasAnacrusisChange?.(false)}
            className={`px-2.5 py-0.5 font-bold transition-all cursor-pointer ${hasAnacrusis === false ? 'cordel-btn-primary' : 'opacity-60'}`}
          >
            {t('hasAnacrusisNo')}
          </button>
        </div>
      </div>
    </div>
  );
};
