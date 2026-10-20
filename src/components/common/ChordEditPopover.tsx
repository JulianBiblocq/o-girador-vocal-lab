/**
 * ChordEditPopover.tsx
 * Popover de saisie et suggestions rapides d'accords (< 90 lignes).
 */
import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { isChordSymbol } from '../../utils/chordParser';
import { Check, Trash2, X } from 'lucide-react';

const SUGGESTED_CHORDS = ['C', 'Dm', 'Em', 'F', 'G7', 'Am', 'Dm7', 'C6', 'A7', 'Bm7b5', 'Gm7', 'C7'];

interface ChordEditPopoverProps {
  currentChord: string;
  onApply: (chord: string | null) => void;
  onClose: () => void;
}

export const ChordEditPopover: React.FC<ChordEditPopoverProps> = ({ currentChord, onApply, onClose }) => {
  const { t } = useLanguage();
  const [val, setVal] = useState(currentChord);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const clean = val.trim();
    if (!clean) {
      onApply(null);
    } else if (isChordSymbol(clean)) {
      onApply(clean);
    }
  };

  return (
    <div className="absolute top-full mt-1 z-50 p-2.5 cordel-card shadow-lg w-52 flex flex-col gap-2 rounded animate-in fade-in zoom-in-95">
      <div className="flex items-center justify-between pb-1 border-b border-[var(--cordel-border-sub)] text-[10.5px]">
        <span className="font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">{t('harmonyChordGridTitle')}</span>
        <button type="button" onClick={onClose} className="p-0.5 text-[var(--cordel-secondary-text)] hover:text-theme-ink cursor-pointer"><X className="w-3 h-3" /></button>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-1">
        <input
          type="text"
          value={val}
          autoFocus
          placeholder="ex: Dm7, G7..."
          onChange={(e) => setVal(e.target.value)}
          className="w-full px-2 py-1 bg-[var(--cordel-surface)] border border-[var(--cordel-border-panel)] text-xs font-mono text-theme-ink focus:outline-none focus:border-amber-500 rounded uppercase"
        />
        <button type="submit" className="px-2 py-1 bg-[#9a3412] hover:bg-[#b45309] text-[#f4ecd8] font-bold text-xs rounded cursor-pointer">
          <Check className="w-3.5 h-3.5" />
        </button>
      </form>

      <div className="grid grid-cols-4 gap-1 pt-1">
        {SUGGESTED_CHORDS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onApply(c)}
            className={`py-0.5 text-[10px] font-mono border rounded cursor-pointer ${
              val === c ? 'border-amber-500/70 bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold' : 'cordel-btn'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onApply(null)}
        className="w-full mt-0.5 py-1 text-[10px] font-mono text-[var(--cordel-secondary-text)] hover:text-red-700 dark:hover:text-red-300 hover:bg-red-500/10 border border-transparent rounded flex items-center justify-center gap-1 cursor-pointer"
      >
        <Trash2 className="w-3 h-3" />
        <span>{t('harmonyClearChord')}</span>
      </button>
    </div>
  );
};
