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
  const { locale, t } = useLanguage();
  const isPt = locale === 'pt';

  const stopText = t('stopRecordBtn');
  const recordText = isPt
    ? `GRAVAR A VOZ (1 C ANACRUSE + ${measuresCount} C CANTO)`
    : `ENREGISTRER LA VOIX (1 M ÉLAN + ${measuresCount} M CHANT)`;

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
            <span>{stopText}</span>
          </>
        ) : (
          <>
            <Mic className="w-5 h-5 text-red-500 fill-current animate-pulse" />
            <span>{recordText}</span>
          </>
        )}
      </div>
    </button>
  );
};
