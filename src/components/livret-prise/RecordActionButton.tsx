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
      className={`w-full py-3.5 px-6 cordel-btn-primary text-sm tracking-widest uppercase cursor-pointer transition-colors ${
        isCycleActive ? 'bg-red-900 hover:bg-red-800' : ''
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
            <Mic className="w-5 h-5 text-[#f4ecd8] fill-current animate-pulse" />
            <span>{t('btnStartRecording', { measures: measuresCount })}</span>
          </>
        )}
      </div>
    </button>
  );
};
