/**
 * PianoRollSyllablesRow.tsx
 * Ligne d'édition directe des syllabes sous le Piano Roll avec bouton [ 🔗 ] de fusion 1-clic (< 120 lignes).
 */
import React, { useState, useRef, useMemo, useEffect } from 'react';
import type { VocalStepData } from '../../types/vocalPack.types';
import { joinSyllableWithPrevious } from '../../utils/syllableImpulseMerger';
import { Scissors, CornerDownLeft, Link2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface PianoRollSyllablesRowProps {
  allSteps: VocalStepData[]; gridWidth: number; readOnly?: boolean;
  onUpdateSteps: (newSteps: VocalStepData[], commit?: boolean) => void;
}

export const PianoRollSyllablesRow: React.FC<PianoRollSyllablesRowProps> = ({
  allSteps, gridWidth, readOnly, onUpdateSteps,
}) => {
  const { t } = useLanguage(), inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const activeNotes = useMemo(() => {
    const list: { stepIndex: number; note: string; syllable: string; spanSteps: number; width: number; x: number }[] = [];
    const stepW = allSteps.length > 0 ? gridWidth / allSteps.length : 0;
    for (let i = 0; i < allSteps.length; i++) {
      const s = allSteps[i];
      if (s.active && s.note !== '───') {
        let ties = 0;
        while (i + 1 + ties < allSteps.length && allSteps[i + 1 + ties].note === '───') ties++;
        const spanSteps = 1 + ties, x = i * stepW, w = Math.max(stepW * spanSteps, 28);
        list.push({ stepIndex: i, note: s.note, syllable: s.syllable || '', spanSteps, width: w, x });
        i += ties;
      }
    }
    return list;
  }, [allSteps, gridWidth]);

  const defaultPhrase = useMemo(() => activeNotes.map((n, idx) => {
    const s = n.syllable || '-';
    return idx === activeNotes.length - 1 ? s.trimEnd() : (s.endsWith(' ') ? s : `${s}-`);
  }).join(''), [activeNotes]);
  const [cutterText, setCutterText] = useState(defaultPhrase);
  useEffect(() => { setCutterText(defaultPhrase); }, [defaultPhrase]);

  const handleSyllableChange = (stepIdx: number, val: string) =>
    onUpdateSteps(allSteps.map((st, i) => (i === stepIdx ? { ...st, syllable: val } : st)), false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
      if (nextIdx >= 0 && nextIdx < activeNotes.length) { inputRefs.current[nextIdx]?.focus(); inputRefs.current[nextIdx]?.select(); }
    } else if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleDistributeCut = () => {
    if (!cutterText.trim()) return;
    const words = cutterText.trim().split(/\s+/).filter(Boolean), parts: string[] = [];
    for (const word of words) {
      if (word === '-' || word === '~') { parts.push('-'); continue; }
      const syls = word.split('-').filter(Boolean);
      syls.forEach((s, i) => parts.push(i === syls.length - 1 ? `${s} ` : s));
    }
    const next = [...allSteps];
    activeNotes.forEach((n, idx) => { next[n.stepIndex] = { ...next[n.stepIndex], syllable: parts[idx] ?? '' }; });
    onUpdateSteps(next, true);
  };

  return (
    <div className="flex flex-col gap-1 border-t border-[var(--cordel-border-sub)] bg-[var(--cordel-subcard-bg)] pt-1">
      <div className="relative h-8" style={{ width: `${gridWidth}px`, marginLeft: '64px' }}>
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
              style={{ left: `${n.x}px`, width: `${n.width - 2}px` }}
              className="letra-syllable-input absolute top-0 text-center text-[10px] font-mono font-bold px-0.5 py-0.5 focus:outline-none transition-colors rounded-none"
              title={t('syllableInputTitle', { note: n.note })}
            />
            {!readOnly && idx < activeNotes.length - 1 && (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => onUpdateSteps(joinSyllableWithPrevious(allSteps, activeNotes[idx + 1].stepIndex), true)}
                style={{ left: `${n.x + n.width - 8}px` }}
                className="absolute -top-1 z-10 w-3.5 h-3.5 rounded-full bg-amber-600/90 hover:bg-amber-500 text-white flex items-center justify-center shadow-xs cursor-pointer opacity-75 hover:opacity-100"
                title="🔗 Joindre cette syllabe à la suivante sur une seule brique"
              >
                <Link2 className="w-2.5 h-2.5" />
              </button>
            )}
          </React.Fragment>
        ))}
      </div>
      {!readOnly && activeNotes.length > 0 && (
        <div className="flex items-center gap-2 px-2 py-1 bg-[var(--cordel-surface)] border-t border-[var(--cordel-border-sub)] text-[10px] font-mono" style={{ width: `${64 + gridWidth}px` }}>
          <Scissors className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
          <span className="text-[var(--cordel-secondary-text)] shrink-0">{t('syllableQuickSplitLabel')}</span>
          <input type="text" value={cutterText} onChange={(e) => setCutterText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleDistributeCut(); }} placeholder={t('syllableQuickSplitPlaceholder')} className="letra-phrase-input flex-1 min-w-[200px] px-2 py-0.5 text-[10.5px] font-mono rounded-none focus:outline-none" />
          <button type="button" onClick={handleDistributeCut} className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-none flex items-center gap-1 cursor-pointer shrink-0" title={t('syllableDistributeTitle')}>
            <CornerDownLeft className="w-3 h-3" /><span>{t('syllableDistributeBtn', { count: activeNotes.length })}</span>
          </button>
        </div>
      )}
    </div>
  );
};
