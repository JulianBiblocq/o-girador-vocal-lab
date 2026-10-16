/**
 * ImportPreconfigBar.tsx
 * Bandeau de pré-configuration initiale d'import de Toada (BPM, Mesures, Anacrouse) (< 70 lignes).
 */
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { NumericDraftInput } from '../ui/NumericDraftInput';
import { Sliders, Clock, Music2 } from 'lucide-react';

interface ImportPreconfigBarProps {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  measuresCount: 1 | 2 | 4;
  onMeasuresCountChange: (count: 1 | 2 | 4) => void;
  hasAnacrusis: boolean;
  onHasAnacrusisChange: (has: boolean) => void;
}

export const ImportPreconfigBar: React.FC<ImportPreconfigBarProps> = ({
  bpm, onBpmChange, measuresCount, onMeasuresCountChange, hasAnacrusis, onHasAnacrusisChange,
}) => {
  const { t } = useLanguage();

  return (
    <div className="p-2.5 bg-black/40 border border-theme-border/40 flex flex-col gap-2 text-xs font-mono">
      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
        <Sliders className="w-3 h-3 text-amber-500" />
        <span>{t('importPreconfigTitle')}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
        {/* BPM */}
        <div className="flex items-center justify-between gap-1.5 bg-black/30 p-1.5 border border-theme-border/20">
          <span className="flex items-center gap-1 text-[11px] text-[var(--cordel-text)]/80 font-bold">
            <Clock className="w-3 h-3 text-amber-500" />
            {t('importDefaultBpm')}
          </span>
          <NumericDraftInput
            min={30} max={240} value={bpm} onChange={onBpmChange}
            className="w-14 bg-black/50 border border-theme-border text-center font-mono font-bold text-xs p-1 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Mesures par ligne */}
        <div className="flex items-center justify-between gap-1.5 bg-black/30 p-1.5 border border-theme-border/20">
          <span className="flex items-center gap-1 text-[11px] text-[var(--cordel-text)]/80 font-bold">
            <Music2 className="w-3 h-3 text-amber-500" />
            {t('importMeasuresPerLine')}
          </span>
          <div className="inline-flex gap-1">
            {([1, 2, 4] as const).map((m) => (
              <button
                key={m} type="button" onClick={() => onMeasuresCountChange(m)}
                className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer rounded-none ${measuresCount === m ? 'cordel-btn-primary' : 'cordel-btn opacity-60'}`}
              >
                {t('measureUnitShort', { n: m })}
              </button>
            ))}
          </div>
        </div>

        {/* Anacrouse */}
        <div className="flex items-center justify-between gap-1.5 bg-black/30 p-1.5 border border-theme-border/20">
          <span className="text-[11px] text-[var(--cordel-text)]/80 font-bold">{t('importAnacrusisDefault')}</span>
          <div className="inline-flex gap-1">
            <button
              type="button" onClick={() => onHasAnacrusisChange(true)}
              className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer rounded-none ${hasAnacrusis ? 'cordel-btn-primary' : 'cordel-btn opacity-60'}`}
            >
              {t('hasAnacrusisYes')}
            </button>
            <button
              type="button" onClick={() => onHasAnacrusisChange(false)}
              className={`px-1.5 py-0.5 text-[10px] font-bold cursor-pointer rounded-none ${!hasAnacrusis ? 'cordel-btn-primary' : 'cordel-btn opacity-60'}`}
            >
              {t('hasAnacrusisNo')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
