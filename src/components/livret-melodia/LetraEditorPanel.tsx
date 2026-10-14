/**
 * LetraEditorPanel.tsx
 * Éditeur « Letra da Toada » avec alignement automatique, ruban de pastilles (i18n pur via t).
 * Style 100% Cordel : coins carrés (rounded-none), icônes vectorielles SVG.
 */
import React, { useState, useMemo } from 'react';
import type { VocalStepData } from '../../types/vocalPack.types';
import { splitTextIntoLetraSyllables, mapSyllablesToSteps, reconstructWordsFromSteps } from '../../utils/syllabifier';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CordelScroll, CordelBulb, CordelSpark } from '../common/CordelIcons';
import { useLanguage } from '../../i18n/LanguageContext';

interface LetraEditorPanelProps {
  allSteps: VocalStepData[];
  onUpdateSteps: (newSteps: VocalStepData[]) => void;
}

export const LetraEditorPanel: React.FC<LetraEditorPanelProps> = ({ allSteps, onUpdateSteps }) => {
  const { t } = useLanguage();
  const [rawText, setRawText] = useState<string>('Eu vou vadiar');

  const handleAlign = () => {
    const syllables = splitTextIntoLetraSyllables(rawText);
    onUpdateSteps(mapSyllablesToSteps(allSteps, syllables));
  };

  const handleSyllableChange = (stepIndex: number, text: string) => {
    onUpdateSteps(allSteps.map((st, i) => (i === stepIndex ? { ...st, syllable: text } : st)));
  };

  const handleToggleTrailingSpace = (stepIndex: number) => {
    const current = allSteps[stepIndex]?.syllable ?? '';
    const hasSpace = current.endsWith(' ');
    handleSyllableChange(stepIndex, hasSpace ? current.trimEnd() : `${current.trimEnd()} `);
  };

  const handleShiftSyllable = (targetActiveIdx: number, direction: -1 | 1) => {
    const activeIndices = allSteps.map((s, idx) => (s.active && s.note !== '───' ? idx : -1)).filter((idx) => idx !== -1);
    const pos = activeIndices.indexOf(targetActiveIdx);
    const neighborPos = pos + direction;
    if (pos === -1 || neighborPos < 0 || neighborPos >= activeIndices.length) return;

    const neighborIdx = activeIndices[neighborPos];
    const next = [...allSteps];
    const currentSyl = next[targetActiveIdx].syllable ?? '';
    next[targetActiveIdx] = { ...next[targetActiveIdx], syllable: next[neighborIdx].syllable ?? '' };
    next[neighborIdx] = { ...next[neighborIdx], syllable: currentSyl };
    onUpdateSteps(next);
  };

  const activeSteps = useMemo(() => allSteps.filter((s) => s.active && s.note !== '───'), [allSteps]);
  const reconstructedWords = useMemo(() => reconstructWordsFromSteps(allSteps), [allSteps]);

  return (
    <div className="cordel-card p-3 flex flex-col gap-2.5 bg-black/50 rounded-none">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="font-bold text-theme-accent flex items-center gap-1.5">
          <CordelScroll className="w-4 h-4" />
          <span>{t('letraTitle')}</span>
        </span>
        <span className="text-[10px] text-theme-ink/70">{activeSteps.length} {t('syllableCount')}</span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Ex: Eu vou va-di-ar..."
          className="flex-1 px-3 py-1.5 bg-black/40 border-2 border-theme-border text-xs font-mono text-theme-ink focus:outline-none focus:border-theme-accent rounded-none"
        />
        <button
          type="button"
          onClick={handleAlign}
          className="cordel-btn-primary px-3 py-1.5 text-xs font-mono flex items-center gap-1 font-bold rounded-none cursor-pointer"
        >
          <CordelSpark className="w-3.5 h-3.5" />
          <span>{t('alignBtn')}</span>
        </button>
      </div>

      <p className="text-[10px] font-mono text-theme-ink/80 leading-snug px-0.5 flex items-center gap-1">
        <CordelBulb className="w-3.5 h-3.5 text-theme-accent shrink-0" />
        <span>{t('syntaxGuide')}</span>
      </p>

      {/* Ruban des pastilles syllabiques (coins carrés) */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 cordel-scrollbar">
        {activeSteps.length === 0 ? (
          <span className="text-[11px] font-mono text-theme-ink/50 italic">
            {t('letraNoActiveNotes')}
          </span>
        ) : (
          activeSteps.map((st) => {
            const hasSpace = (st.syllable ?? '').endsWith(' ');
            return (
              <div key={st.stepIndex} className="flex flex-col items-center bg-white/5 border border-theme-border/60 p-1 min-w-[62px] shrink-0 rounded-none">
                <span className="text-[9.5px] font-mono text-theme-accent font-black">{st.note}</span>
                <input
                  type="text"
                  value={st.syllable ?? ''}
                  onChange={(e) => handleSyllableChange(st.stepIndex, e.target.value)}
                  className="w-full text-center bg-black/60 border border-theme-border/40 text-[11px] font-mono text-theme-ink px-0.5 py-0.5 mt-0.5 focus:outline-none rounded-none"
                />
                <button
                  type="button"
                  onClick={() => handleToggleTrailingSpace(st.stepIndex)}
                  className={`mt-1 px-1 py-0.5 text-[8.5px] font-mono w-full transition-all rounded-none cursor-pointer ${
                    hasSpace ? 'bg-theme-wood text-white border border-theme-border font-bold' : 'bg-white/5 text-theme-ink/60 hover:bg-white/10'
                  }`}
                  title={hasSpace ? t('letraSpaceTooltip') : t('letraTiedTooltip')}
                >
                  {hasSpace ? t('letraSpaceBadge') : t('letraTiedBadge')}
                </button>
                <div className="flex items-center justify-between w-full mt-1 px-0.5">
                  <button type="button" onClick={() => handleShiftSyllable(st.stepIndex, -1)} className="p-0.5 hover:bg-white/10 rounded-none cursor-pointer">
                    <ChevronLeft className="w-3 h-3 text-theme-ink/60" />
                  </button>
                  <button type="button" onClick={() => handleShiftSyllable(st.stepIndex, 1)} className="p-0.5 hover:bg-white/10 rounded-none cursor-pointer">
                    <ChevronRight className="w-3 h-3 text-theme-ink/60" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-theme-border/30 text-[11px] font-mono">
        <span className="text-theme-ink/70">{t('letraWordsLabel')}</span>
        <span className="text-theme-accent font-bold italic bg-black/30 px-2 py-0.5 border border-theme-border/30 rounded-none">
          {reconstructedWords ? `« ${reconstructedWords} »` : t('letraEmptyWords')}
        </span>
      </div>
    </div>
  );
};
