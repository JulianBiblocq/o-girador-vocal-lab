/**
 * TrimSummaryBar.tsx
 * Bandeau récapitulatif des métadonnées d'alignement, d'anacrouse et de durée utile.
 * Règle Anti-Monolithe (< 60 lignes).
 */
import React from 'react';
import type { AlignmentResult } from '../../utils/alignmentMath';
import { useLanguage } from '../../i18n/LanguageContext';

export interface TrimSummaryBarProps {
  alignment: AlignmentResult;
  hasAnacrusis?: boolean;
}

export const TrimSummaryBar: React.FC<TrimSummaryBarProps> = ({ alignment, hasAnacrusis = true }) => {
  const { t } = useLanguage();

  return (
    <div className="cordel-card-sm p-2 rounded flex items-center justify-between text-xs font-mono">
      <div className="flex items-center gap-1.5">
        {hasAnacrusis ? (
          <>
            <span className="opacity-70">{t('offsetMeasure1')}</span>
            <span className={`font-bold ${alignment.startOffsetSec < 0 ? 'text-theme-accent' : 'text-emerald-700 dark:text-emerald-400'}`}>
              {alignment.startOffsetSec >= 0 ? '+' : ''}{alignment.startOffsetSec.toFixed(3)}s
            </span>
            {alignment.anacrusis.hasAnacrusis && (
              <span className="text-[10px] text-theme-accent border border-theme-accent/50 px-1 py-0.5 rounded">
                {t('anacrusisLabel')} ({t('anacrusisBeats', { beats: alignment.anacrusis.beats.toFixed(1) })})
              </span>
            )}
          </>
        ) : (
          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
            {t('noAnacrusisBadge')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="opacity-70">{t('cleanDurationLabel')}</span>
        <span className="font-bold text-theme-ink">{alignment.cleanDurationSec.toFixed(2)}s</span>
      </div>
    </div>
  );
};
