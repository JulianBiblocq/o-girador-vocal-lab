/**
 * LetraEditorPanel.tsx
 * Éditeur « Letra da Toada » avec alignement strict non-destructif sur les briques existantes (< 130 lignes).
 */
import React, { useState, useEffect, useMemo } from 'react';
import type { VocalStepData } from '../../types/vocalPack.types';
import { assignSyllablesStrictlyToExistingBricks, reconstructWordsFromSteps } from '../../utils/syllableAligner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CordelScroll, CordelBulb, CordelSpark } from '../common/CordelIcons';
import { useLanguage } from '../../i18n/LanguageContext';
import { useToadaProject } from '../../context/ToadaProjectContext';

interface LetraEditorPanelProps {
  allSteps: VocalStepData[];
  onUpdateSteps: (newSteps: VocalStepData[], commit?: boolean) => void;
  onCommitHistory?: () => void;
}

export const LetraEditorPanel: React.FC<LetraEditorPanelProps> = ({ allSteps, onUpdateSteps, onCommitHistory }) => {
  const { t } = useLanguage(), { activePattern, updatePattern, project } = useToadaProject();
  const [rawText, setRawText] = useState<string>(activePattern.assignedLyricsText || '');
  const [focusPhrase, setFocusPhrase] = useState(''), [focusSyl, setFocusSyl] = useState('');

  useEffect(() => { setRawText(activePattern.assignedLyricsText || ''); }, [activePattern.id, activePattern.assignedLyricsText]);

  const availablePhrases = useMemo(() => {
    const set = new Set<string>();
    project.patterns.forEach((p) => { if (p.assignedLyricsText?.trim()) set.add(p.assignedLyricsText.trim()); });
    return Array.from(set);
  }, [project.patterns]);

  const handleSelectPhrase = (phrase: string) => {
    setRawText(phrase);
    const match = project.patterns.find((p) => p.assignedLyricsText === phrase);
    updatePattern(activePattern.id, { assignedLyricsText: phrase, assignedPhoneticText: match?.assignedPhoneticText });
    onCommitHistory?.();
  };

  /**
   * [ + Aligner ] : Assigne uniquement les syllabes aux briques d'attaque actuellement présentes
   * dans le Piano Roll sans JAMAIS modifier les découpes (active/isTie) ni les hauteurs MIDI.
   */
  const handleAlign = () => {
    onCommitHistory?.();
    const aligned = assignSyllablesStrictlyToExistingBricks(allSteps, rawText);
    updatePattern(activePattern.id, { assignedLyricsText: rawText, midiLocked: true });
    onUpdateSteps(aligned, true);
  };

  const handleSyllableChange = (arrayIdx: number, text: string) =>
    onUpdateSteps(allSteps.map((st, i) => (i === arrayIdx ? { ...st, syllable: text } : st)), false);

  const handleToggleTrailingSpace = (arrayIdx: number) => {
    const cur = allSteps[arrayIdx]?.syllable ?? '', next = cur.endsWith(' ') ? cur.trimEnd() : `${cur.trimEnd()} `;
    onUpdateSteps(allSteps.map((st, i) => (i === arrayIdx ? { ...st, syllable: next } : st)), true);
  };

  const handleShiftSyllable = (targetArrayIdx: number, direction: -1 | 1) => {
    const activeIndices = allSteps.map((s, idx) => (s.active && s.note !== '───' && !s.isTie ? idx : -1)).filter((idx) => idx !== -1);
    const pos = activeIndices.indexOf(targetArrayIdx), neighborPos = pos + direction;
    if (pos === -1 || neighborPos < 0 || neighborPos >= activeIndices.length) return;
    const neighborIdx = activeIndices[neighborPos], next = [...allSteps], curSyl = next[targetArrayIdx].syllable ?? '';
    next[targetArrayIdx] = { ...next[targetArrayIdx], syllable: next[neighborIdx].syllable ?? '' };
    next[neighborIdx] = { ...next[neighborIdx], syllable: curSyl };
    onUpdateSteps(next, true);
  };

  const activeStepEntries = useMemo(
    () => allSteps.map((step, arrayIdx) => ({ step, arrayIdx })).filter(({ step }) => step.active && step.note !== '───' && !step.isTie),
    [allSteps]
  );
  const reconstructedWords = useMemo(() => reconstructWordsFromSteps(allSteps), [allSteps]);

  return (
    <div className="cordel-card p-3 flex flex-col gap-2.5 rounded">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="font-bold text-theme-accent flex items-center gap-1.5"><CordelScroll className="w-4 h-4" /><span>{t('letraTitle')}</span></span>
        <span className="text-[10px] text-theme-ink/70">{activeStepEntries.length} {t('syllableCount')}</span>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {availablePhrases.length > 0 && (
          <select value={rawText} onChange={(e) => handleSelectPhrase(e.target.value)} className="letra-phrase-select px-2 py-1.5 text-xs font-mono focus:outline-none rounded max-w-full sm:max-w-[200px]">
            <option value="">{t('patternPhraseCustom')}</option>
            {availablePhrases.map((phrase, i) => <option key={i} value={phrase}>{phrase}</option>)}
          </select>
        )}
        <input
          type="text" value={rawText} placeholder="Ex: Eu vou va-di-ar..." onFocus={(e) => setFocusPhrase(e.target.value)}
          onChange={(e) => { setRawText(e.target.value); updatePattern(activePattern.id, { assignedLyricsText: e.target.value }); }}
          onBlur={(e) => { if (e.target.value !== focusPhrase) onCommitHistory?.(); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          className="letra-phrase-input flex-1 px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-theme-accent rounded"
        />
        <button type="button" onClick={handleAlign} className="cordel-btn-primary px-3 py-1.5 text-xs font-mono flex items-center gap-1 font-bold rounded cursor-pointer">
          <CordelSpark className="w-3.5 h-3.5" /><span>{t('alignBtn')}</span>
        </button>
      </div>
      {activePattern.assignedPhoneticText && (
        <div className="text-[10px] font-mono text-stone-400 italic px-1 flex items-center gap-1"><span className="text-stone-500">🔤</span><span>{activePattern.assignedPhoneticText}</span></div>
      )}
      <p className="text-[10px] font-mono text-theme-ink/80 leading-snug px-0.5 flex items-center gap-1"><CordelBulb className="w-3.5 h-3.5 text-theme-accent shrink-0" /><span>{t('syntaxGuide')}</span></p>
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 cordel-scrollbar">
        {activeStepEntries.length === 0 ? (
          <span className="text-[11px] font-mono text-theme-ink/50 italic">{t('letraNoActiveNotes')}</span>
        ) : (
          activeStepEntries.map(({ step: st, arrayIdx }, cardIdx) => {
            const hasSpace = (st.syllable ?? '').endsWith(' ');
            return (
              <div key={arrayIdx} className="flex flex-col items-center bg-white/5 border border-theme-border/60 p-1 min-w-[62px] shrink-0 rounded-none">
                <div className="flex items-center justify-between w-full px-0.5 text-[9px] font-mono">
                  <span className="opacity-50">#{cardIdx + 1}</span>
                  <span className="text-theme-accent font-black">{st.note}</span>
                </div>
                <input
                  type="text" value={st.syllable ?? ''} onFocus={(e) => setFocusSyl(e.target.value)}
                  onChange={(e) => handleSyllableChange(arrayIdx, e.target.value)}
                  onBlur={(e) => { if (e.target.value !== focusSyl) onCommitHistory?.(); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  className="letra-syllable-input w-full text-center text-[11px] font-mono px-0.5 py-0.5 mt-0.5 focus:outline-none rounded-none"
                />
                <button
                  type="button" onClick={() => handleToggleTrailingSpace(arrayIdx)}
                  className={`mt-1 px-1 py-0.5 text-[8.5px] font-mono w-full transition-all rounded-none cursor-pointer ${hasSpace ? 'letra-space-btn-active' : 'bg-white/5 text-theme-ink/60 hover:bg-white/10'}`}
                  title={hasSpace ? t('letraSpaceTooltip') : t('letraTiedTooltip')}
                >
                  {hasSpace ? t('letraSpaceBadge') : t('letraTiedBadge')}
                </button>
                <div className="flex items-center justify-between w-full mt-1 px-0.5">
                  <button type="button" onClick={() => handleShiftSyllable(arrayIdx, -1)} className="p-0.5 hover:bg-white/10 rounded-none cursor-pointer"><ChevronLeft className="w-3 h-3 text-theme-ink/60" /></button>
                  <button type="button" onClick={() => handleShiftSyllable(arrayIdx, 1)} className="p-0.5 hover:bg-white/10 rounded-none cursor-pointer"><ChevronRight className="w-3 h-3 text-theme-ink/60" /></button>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="flex items-center gap-2 pt-1 border-t border-theme-border/30 text-[11px] font-mono">
        <span className="text-theme-ink/70">{t('letraWordsLabel')}</span>
        <span className="letra-reconstructed-badge italic font-bold px-2 py-0.5 rounded-none">{reconstructedWords ? `« ${reconstructedWords} »` : t('letraEmptyWords')}</span>
      </div>
    </div>
  );
};
