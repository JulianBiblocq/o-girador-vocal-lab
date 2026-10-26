/**
 * SlicerMultiSegmentToolbar.tsx
 * Barre d'outils de détection automatique, ajout et réinitialisation des tranches (< 95 lignes).
 */
import React from 'react';
import { Sparkles, Plus, Trash2, FolderOpen } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface SlicerMultiSegmentToolbarProps {
  segmentCount: number;
  durationSec: number;
  onDetectSilences: () => void;
  onAddSegment: () => void;
  onClearSegments: () => void;
  onChangeFile: () => void;
}

export const SlicerMultiSegmentToolbar: React.FC<SlicerMultiSegmentToolbarProps> = ({
  segmentCount,
  durationSec,
  onDetectSilences,
  onAddSegment,
  onClearSegments,
  onChangeFile,
}) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-theme-bg/60 border border-theme-border/60 rounded text-xs font-mono">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onDetectSilences}
          className="h-8 px-3 cordel-btn-primary font-bold flex items-center gap-1.5 cursor-pointer bg-amber-600 hover:bg-amber-500 text-white shadow-xs"
          title="Repérer automatiquement les phrases chantées séparées par des silences"
        >
          <Sparkles className="w-3.5 h-3.5 fill-current" />
          <span>{t('slicerAutoDetectPhrasesBtn')}</span>
        </button>

        <button
          type="button"
          onClick={onAddSegment}
          className="h-8 px-2.5 cordel-card-sm flex items-center gap-1 cursor-pointer hover:bg-theme-accent/20"
          title="Ajouter une découpe à la position de lecture ou au centre"
        >
          <Plus className="w-3.5 h-3.5 text-theme-accent" />
          <span>{t('slicerAddSegmentBtn')}</span>
        </button>

        {segmentCount > 0 && (
          <button
            type="button"
            onClick={onClearSegments}
            className="h-8 px-2 cordel-card-sm text-red-400 hover:text-red-300 border border-red-500/40 hover:bg-red-950/30 flex items-center gap-1 cursor-pointer"
            title="Effacer toutes les tranches"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('slicerClearSegmentsBtn')}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[11px] font-mono text-[var(--cordel-secondary-text)] font-bold">
          {t('slicerSegmentsCount', { count: segmentCount, dur: durationSec.toFixed(1) })}
        </span>

        <button
          type="button"
          onClick={onChangeFile}
          className="h-8 px-2.5 cordel-card-sm flex items-center gap-1.5 cursor-pointer text-theme-accent hover:underline text-xs"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>{t('slicerChangeFileBtn')}</span>
        </button>
      </div>
    </div>
  );
};
