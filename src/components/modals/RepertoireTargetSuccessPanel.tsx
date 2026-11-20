/**
 * RepertoireTargetSuccessPanel.tsx
 * Panneau de confirmation post-intégration d'une Toada dans Sequenciador (< 60 lignes).
 */
import React from 'react';
import { Drum, ExternalLink } from 'lucide-react';
import type { IntegrateMorceauResult } from '../../services/samambaiaMorceauIntegrator';
import { useLanguage } from '../../i18n/LanguageContext';
import { CheckMarkIcon } from '../icons/CordelActionIcons';

interface Props {
  result: IntegrateMorceauResult;
  onClose: () => void;
}

export const RepertoireTargetSuccessPanel: React.FC<Props> = ({ result, onClose }) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-3 py-3">
      <div className="p-3 rounded bg-emerald-700/15 border border-emerald-600 text-emerald-950 dark:text-emerald-200 font-bold text-xs leading-relaxed">
        <div className="flex items-center gap-1.5">
          <CheckMarkIcon className="w-4 h-4 shrink-0" />
          <span>{t('exportDoneBannerTitle', { name: result.morceauName, bpm: result.sequenciadorBpm })}</span>
        </div>
        <div className="mt-1 text-[11px] opacity-85 font-normal">
          {t('exportDoneStatsSummary', {
            patterns: result.exportedPatternsCount,
            wavs: result.uploadedWavsCount,
            recBpm: result.recordedBpm,
            seqBpm: result.sequenciadorBpm,
          })}
          {result.purgedCloudFilesCount > 0 && ` • ${t('exportDoneCleanedBadge', { count: result.purgedCloudFilesCount })}`}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => window.open(result.sequenciadorMorceauUrl, '_blank', 'noopener,noreferrer')}
          className="px-3 py-1.5 rounded cordel-btn font-bold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Drum className="w-3.5 h-3.5 text-theme-accent" />
          <span>{t('exportOpenInSequenciadorBtn')}</span>
          <ExternalLink className="w-3 h-3 opacity-70" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3.5 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <CheckMarkIcon className="w-3.5 h-3.5" />
          <span>{t('exportStayInCantadorBtn')}</span>
        </button>
      </div>
    </div>
  );
};
