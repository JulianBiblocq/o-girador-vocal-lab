/**
 * CalageEmptyNotice.tsx
 * Panneau d'invitation bienveillant quand aucun audio n'est présent sur le pattern (< 60 lignes).
 */
import React from 'react';
import { Mic, Upload, Scissors } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';

interface CalageEmptyNoticeProps {
  onDirectImport: () => void;
  onOpenSlicer: () => void;
}

export const CalageEmptyNotice: React.FC<CalageEmptyNoticeProps> = ({ onDirectImport, onOpenSlicer }) => {
  const { t } = useLanguage();
  const { setActiveLivret } = useVocalTransportStore();

  return (
    <div className="cordel-card p-6 sm:p-8 flex flex-col items-center justify-center text-center gap-4 rounded">
      <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
        <Scissors className="w-6 h-6" />
      </div>

      <div className="flex flex-col gap-1 max-w-md">
        <h3 className="font-bold text-sm sm:text-base font-mono text-theme-ink uppercase tracking-wider">
          {t('calageEmptyTitle')}
        </h3>
        <p className="text-xs font-mono text-[var(--cordel-secondary-text)] leading-relaxed">
          {t('calageEmptyDesc')}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => setActiveLivret('prise')}
          className="cordel-btn-primary px-4 py-2 text-xs font-mono font-bold flex items-center gap-2 cursor-pointer shadow-md"
        >
          <Mic className="w-4 h-4" />
          <span>{t('goToCabineBtn')}</span>
        </button>

        <button
          type="button"
          onClick={onDirectImport}
          className="cordel-btn px-3 py-2 text-xs font-mono font-bold flex items-center gap-2 cursor-pointer"
        >
          <Upload className="w-4 h-4 text-theme-accent" />
          <span>{t('calageDirectImportBtn')}</span>
        </button>

        <button
          type="button"
          onClick={onOpenSlicer}
          className="cordel-btn px-3 py-2 text-xs font-mono font-bold flex items-center gap-2 cursor-pointer"
        >
          <Scissors className="w-4 h-4 text-theme-wood" />
          <span>{t('calageOpenSlicerBtn')}</span>
        </button>
      </div>
    </div>
  );
};
