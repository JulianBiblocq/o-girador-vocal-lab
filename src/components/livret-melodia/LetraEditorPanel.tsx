/**
 * LetraEditorPanel.tsx
 * Barre compacte « Letra da Toada » (saisie rapide de la phrase complète + bouton [+ Aligner] + aperçu des mots) (< 85 lignes).
 * Les syllabes individuelles et liaisons [ 🔗 ] sont éditées directement dans le bandeau épinglé sous le Piano Roll.
 */
import React, { useState, useEffect, useMemo } from 'react';
import type { VocalStepData } from '../../types/vocalPack.types';
import { assignSyllablesStrictlyToExistingBricks, reconstructWordsFromSteps } from '../../utils/syllableAligner';
import { CordelScroll, CordelSpark } from '../common/CordelIcons';
import { useLanguage } from '../../i18n/LanguageContext';
import { useToadaProject } from '../../context/ToadaProjectContext';

interface LetraEditorPanelProps {
  allSteps: VocalStepData[];
  onUpdateSteps: (newSteps: VocalStepData[], commit?: boolean) => void;
  onCommitHistory?: () => void;
}

export const LetraEditorPanel: React.FC<LetraEditorPanelProps> = ({ allSteps, onUpdateSteps, onCommitHistory }) => {
  const { t } = useLanguage();
  const { activePattern, updatePattern, project } = useToadaProject();
  const [rawText, setRawText] = useState<string>(activePattern.assignedLyricsText || '');
  const [focusPhrase, setFocusPhrase] = useState('');

  useEffect(() => {
    setRawText(activePattern.assignedLyricsText || '');
  }, [activePattern.id, activePattern.assignedLyricsText]);

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

  const handleAlign = () => {
    onCommitHistory?.();
    const aligned = assignSyllablesStrictlyToExistingBricks(allSteps, rawText);
    updatePattern(activePattern.id, { assignedLyricsText: rawText, midiLocked: true });
    onUpdateSteps(aligned, true);
  };

  const activeNotesCount = useMemo(
    () => allSteps.filter((s) => s.active && s.note !== '───' && !s.isTie).length,
    [allSteps]
  );
  const reconstructedWords = useMemo(() => reconstructWordsFromSteps(allSteps), [allSteps]);

  return (
    <div className="cordel-card p-2.5 flex flex-col gap-2 rounded">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <span className="font-bold text-theme-accent flex items-center gap-1.5">
          <CordelScroll className="w-4 h-4" />
          <span>{t('letraTitle')}</span>
        </span>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-theme-ink/70">{t('letraWordsLabel')}</span>
          <span className="letra-reconstructed-badge italic font-bold px-2 py-0.5 rounded-xs">
            {reconstructedWords ? `« ${reconstructedWords} »` : t('letraEmptyWords')}
          </span>
          <span className="text-[10px] text-theme-ink/70">({activeNotesCount} {t('syllableCount')})</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {availablePhrases.length > 0 && (
          <select value={rawText} onChange={(e) => handleSelectPhrase(e.target.value)} className="letra-phrase-select px-2 py-1.5 text-xs font-mono focus:outline-none rounded max-w-full sm:max-w-[200px]">
            <option value="">{t('patternPhraseCustom')}</option>
            {availablePhrases.map((phrase, i) => <option key={i} value={phrase}>{phrase}</option>)}
          </select>
        )}
        <input
          type="text"
          value={rawText}
          placeholder="Ex: Sou ba-tu-quei-ro..."
          onFocus={(e) => setFocusPhrase(e.target.value)}
          onChange={(e) => { setRawText(e.target.value); updatePattern(activePattern.id, { assignedLyricsText: e.target.value }); }}
          onBlur={(e) => { if (e.target.value !== focusPhrase) onCommitHistory?.(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAlign(); }}
          className="letra-phrase-input flex-1 px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-theme-accent rounded"
        />
        <button type="button" onClick={handleAlign} className="cordel-btn-primary px-3.5 py-1.5 text-xs font-mono flex items-center gap-1.5 font-bold rounded cursor-pointer">
          <CordelSpark className="w-3.5 h-3.5" />
          <span>+ {t('alignBtn')}</span>
        </button>
      </div>
    </div>
  );
};
