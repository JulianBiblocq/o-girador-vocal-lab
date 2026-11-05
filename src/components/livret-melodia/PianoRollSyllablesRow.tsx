/**
 * PianoRollSyllablesRow.tsx
 * Ligne d'édition directe des syllabes sous la grille du Piano Roll (bilingue + contraste Jour/Nuit) (< 125 lignes).
 */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import type { VocalStepData } from '../../types/vocalPack.types';
import { Scissors, CornerDownLeft } from 'lucide-react';
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
  const { t } = useLanguage();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const activeNotes = useMemo(() => {
    const list: { stepIndex: number; note: string; syllable: string; width: number; x: number }[] = [];
    const stepW = allSteps.length > 0 ? gridWidth / allSteps.length : 0;
    for (let i = 0; i < allSteps.length; i++) {
      const s = allSteps[i];
      if (s.active && s.note !== '───') {
        let ties = 0;
        while (i + 1 + ties < allSteps.length && allSteps[i + 1 + ties].note === '───') ties++;
        const x = i * stepW;
        const w = Math.max(stepW * (1 + ties), 36);
        list.push({ stepIndex: i, note: s.note, syllable: s.syllable || '', width: w, x });
        i += ties;
      }
    }
    return list;
  }, [allSteps, gridWidth]);

  const defaultPhrase = useMemo(() => {
    return activeNotes.map((n, idx) => {
      const s = n.syllable || '-';
      if (idx === activeNotes.length - 1) return s.trimEnd();
      return s.endsWith(' ') ? s : `${s}-`;
    }).join('');
  }, [activeNotes]);
  const [cutterText, setCutterText] = useState(defaultPhrase);

  useEffect(() => { setCutterText(defaultPhrase); }, [defaultPhrase]);

  const handleSyllableChange = (stepIdx: number, val: string) => {
    onUpdateSteps(allSteps.map((st, i) => (i === stepIdx ? { ...st, syllable: val } : st)), false);
  };

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

  const handleDistributeCut = () => {
    if (!cutterText.trim()) return;
    const words = cutterText.trim().split(/\s+/).filter(Boolean);
    const parts: string[] = [];
    for (const word of words) {
      if (word === '-' || word === '~') { parts.push('-'); continue; }
      const syls = word.split('-').filter(Boolean);
      syls.forEach((s, i) => parts.push(i === syls.length - 1 ? `${s} ` : s));
    }
    const next = [...allSteps];
    activeNotes.forEach((n, idx) => {
      const syl = parts[idx] ?? '';
      next[n.stepIndex] = { ...next[n.stepIndex], syllable: syl };
    });
    onUpdateSteps(next, true);
  };

  return (
    <div className="flex flex-col gap-1 border-t border-[var(--cordel-border-sub)] bg-[var(--cordel-subcard-bg)] pt-1">
      <div className="relative h-7" style={{ width: `${gridWidth}px`, marginLeft: '64px' }}>
        {activeNotes.map((n, idx) => (
          <div
            key={n.stepIndex}
            className="absolute top-0 flex flex-col justify-center"
            style={{ left: `${n.x}px`, width: `${n.width - 2}px` }}
          >
            <input
              ref={(el) => { inputRefs.current[idx] = el; }}
              type="text" disabled={readOnly} value={n.syllable} placeholder={n.note}
              onChange={(e) => handleSyllableChange(n.stepIndex, e.target.value)}
              onBlur={() => onUpdateSteps(allSteps, true)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className="letra-syllable-input w-full text-center text-[10px] font-mono font-bold px-0.5 py-0.5 focus:outline-none transition-colors rounded-none"
              title={t('syllableInputTitle', { note: n.note })}
            />
          </div>
        ))}
      </div>

      {!readOnly && activeNotes.length > 0 && (
        <div className="flex items-center gap-2 px-2 py-1 bg-[var(--cordel-surface)] border-t border-[var(--cordel-border-sub)] text-[10px] font-mono" style={{ width: `${64 + gridWidth}px` }}>
          <Scissors className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
          <span className="text-[var(--cordel-secondary-text)] shrink-0">{t('syllableQuickSplitLabel')}</span>
          <input
            type="text" value={cutterText}
            onChange={(e) => setCutterText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleDistributeCut(); }}
            placeholder={t('syllableQuickSplitPlaceholder')}
            className="letra-phrase-input flex-1 min-w-[200px] px-2 py-0.5 text-[10.5px] font-mono rounded-none focus:outline-none"
          />
          <button
            type="button" onClick={handleDistributeCut}
            className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-none flex items-center gap-1 cursor-pointer shrink-0"
            title={t('syllableDistributeTitle')}
          >
            <CornerDownLeft className="w-3 h-3" />
            <span>{t('syllableDistributeBtn', { count: activeNotes.length })}</span>
          </button>
        </div>
      )}
    </div>
  );
};
