/**
 * PianoRollSyllablesRow.tsx
 * Ligne épinglée (Docked Footer) d'édition directe des syllabes sous les briques MIDI
 * (positionnées aux abscisses binaires ou aux tiers exacts 0%, 33.3%, 66.7% en triolet) (< 105 lignes).
 */
import React, { useRef, useMemo } from 'react';
import type { VocalStepData } from '../../types/vocalPack.types';
import { getStepHorizontalBoundsPx, findLastTiedStepIndex } from '../../utils/tripletBeatHelper';
import { joinSyllableWithPrevious } from '../../utils/syllableImpulseMerger';
import { Link2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface PianoRollSyllablesRowProps {
  allSteps: VocalStepData[];
  gridWidth: number;
  readOnly?: boolean;
  onUpdateSteps: (newSteps: VocalStepData[], commit?: boolean) => void;
}

export const PianoRollSyllablesRow: React.FC<PianoRollSyllablesRowProps> = ({
  allSteps, gridWidth, readOnly, onUpdateSteps,
}) => {
  const { t, language } = useLanguage();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const activeNotes = useMemo(() => {
    const list: { stepIndex: number; note: string; syllable: string; spanSteps: number; width: number; x: number }[] = [];
    for (let i = 0; i < allSteps.length; i++) {
      const s = allSteps[i];
      if (s.tripletSlot === 'unused') continue;
      if (s.active && s.note !== '───') {
        const endIdx = findLastTiedStepIndex(allSteps, i);
        const bounds = getStepHorizontalBoundsPx(allSteps, i, gridWidth);
        if (!bounds.hidden && bounds.widthPx > 0) {
          list.push({
            stepIndex: i,
            note: s.note,
            syllable: s.syllable || '',
            spanSteps: endIdx - i + 1,
            width: Math.max(bounds.widthPx, 24),
            x: bounds.xPx,
          });
        }
        i = endIdx;
      }
    }
    return list;
  }, [allSteps, gridWidth]);

  const handleSyllableChange = (stepIdx: number, val: string) =>
    onUpdateSteps(allSteps.map((st, i) => (i === stepIdx ? { ...st, syllable: val } : st)), false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
      if (nextIdx >= 0 && nextIdx < activeNotes.length) {
        inputRefs.current[nextIdx]?.focus();
        inputRefs.current[nextIdx]?.select();
      }
    } else if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div
      className="flex items-center border-t-2 border-[var(--cordel-border-panel)] bg-[var(--cordel-subcard-bg)] select-none"
      style={{ width: `${64 + gridWidth}px`, height: '32px' }}
    >
      <div className="sticky left-0 z-20 shrink-0 w-[64px] h-full bg-[var(--cordel-surface)] border-r-2 border-[var(--cordel-border-panel)] flex items-center justify-center">
        <span className="text-[7.5px] font-mono font-bold text-[#9a3412] dark:text-amber-300 tracking-wider uppercase">
          {language === 'br' ? 'SÍLABAS' : 'SYLLABES'}
        </span>
      </div>
      <div className="relative h-full" style={{ width: `${gridWidth}px` }}>
        {activeNotes.map((n, idx) => (
          <React.Fragment key={n.stepIndex}>
            <input
              ref={(el) => { inputRefs.current[idx] = el; }}
              type="text"
              disabled={readOnly}
              value={n.syllable}
              placeholder={n.note}
              onChange={(e) => handleSyllableChange(n.stepIndex, e.target.value)}
              onBlur={() => onUpdateSteps(allSteps, true)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              style={{ left: `${n.x}px`, width: `${Math.max(20, n.width - 2)}px` }}
              className="letra-syllable-input absolute top-1 bottom-1 text-center text-[10.5px] font-mono font-bold px-0.5 focus:outline-none transition-colors rounded-xs"
              title={t('syllableInputTitle', { note: n.note })}
            />
            {!readOnly && idx < activeNotes.length - 1 && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => onUpdateSteps(joinSyllableWithPrevious(allSteps, activeNotes[idx + 1].stepIndex), true)}
                style={{ left: `${n.x + n.width - 8}px` }}
                className="absolute top-1.5 z-10 w-4 h-4 rounded-full bg-[#9a3412] hover:bg-amber-600 text-white flex items-center justify-center shadow-xs cursor-pointer"
                title={language === 'br' ? 'Unir esta sílaba com a seguinte em um único bloco' : 'Souder cette syllabe avec la suivante sur une seule brique'}
              >
                <Link2 className="w-2.5 h-2.5" />
              </button>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
