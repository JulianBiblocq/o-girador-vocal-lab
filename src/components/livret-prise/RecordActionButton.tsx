import React from 'react';
import { Mic, Square } from 'lucide-react';

interface RecordActionButtonProps {
  isCycleActive: boolean;
  measuresCount: number;
  onToggleRecord: () => void;
}

export const RecordActionButton: React.FC<RecordActionButtonProps> = ({
  isCycleActive,
  measuresCount,
  onToggleRecord,
}) => (
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
          <span>ARRETER LA PRISE</span>
        </>
      ) : (
        <>
          <Mic className="w-5 h-5 text-red-500 fill-current animate-pulse" />
          <span>ENREGISTRER LA VOIX (1 M ELAN + {measuresCount} M CHANT)</span>
        </>
      )}
    </div>
  </button>
);
