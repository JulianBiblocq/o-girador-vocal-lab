import React from 'react';
import { Mic, Square } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface RecordActionButtonProps {
  isCycleActive: boolean;
  measuresCount: number;
  onToggleRecord: () => void;
}

export const RecordActionButton: React.FC<RecordActionButtonProps> = ({
  isCycleActive,
  measuresCount,
  onToggleRecord,
}) => {
  const { t } = useLanguage();

  return (
    <button
      type="button"
      onClick={onToggleRecord}
      className={`w-full sm:max-w-xs min-w-[240px] mx-auto py-3 px-6 cordel-btn-primary text-xs sm:text-sm tracking-wider uppercase cursor-pointer rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center ${
        isCycleActive ? 'bg-red-800 hover:bg-red-700 ring-2 ring-red-400 animate-pulse' : ''
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        {isCycleActive ? (
          <>
            <Square className="w-5 h-5 fill-current" />
            <span>{t('btnStopRecording')}</span>
          </>
        ) : (
          <>
            <Mic className="w-5 h-5 text-[var(--cordel-on-primary)] fill-current animate-pulse" />
            <span>{t('btnStartRecording', { measures: measuresCount })}</span>
          </>
        )}
      </div>
    </button>
  );
};
