/**
 * LongAudioSlicerBanner.tsx
 * Bandeau d'alerte et raccourci direct vers le Slicer lors d'un import audio long (< 75 lignes).
 */
import React from 'react';
import { Scissors, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface LongAudioSlicerBannerProps {
  durationSec: number;
  onOpenSlicer: () => void;
}

export const LongAudioSlicerBanner: React.FC<LongAudioSlicerBannerProps> = ({ durationSec, onOpenSlicer }) => {
  const { t } = useLanguage();

  return (
    <div className="w-full cordel-card p-3 flex flex-wrap items-center justify-between gap-3 border-2 border-amber-600/70 bg-amber-500/10 rounded shadow-md animate-fadeIn">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="p-2 bg-amber-600/20 text-amber-500 rounded-full shrink-0">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold font-mono text-theme-ink flex items-center gap-1.5">
            <span>✂️</span>
            <span>{t('slicerLongAudioDetectedTitle', { sec: durationSec.toFixed(1) })}</span>
          </span>
          <span className="text-[11px] text-[var(--cordel-secondary-text)]">
            {t('slicerLongAudioDetectedSub')}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenSlicer}
        className="px-3.5 py-1.5 cordel-btn-primary font-mono text-xs font-black flex items-center gap-2 cursor-pointer bg-theme-wood text-[#f4ecd8] hover:brightness-110 shadow-sm"
      >
        <Scissors className="w-4 h-4 text-amber-300" />
        <span>{t('slicerOpenAndAssignBtn')}</span>
      </button>
    </div>
  );
};
