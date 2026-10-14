/**
 * LetraEditorPanel.tsx
 * Éditeur « Letra da Toada » avec alignement automatique, ruban de pastilles,
 * bouton de bascule [ ␣ Espace ] / [ - Lié ] et aperçu des mots reconstitués.
 */
import React, { useState, useMemo } from 'react';
import type { VocalStepData } from '../../types/vocalPack.types';
import { splitTextIntoLetraSyllables, mapSyllablesToSteps, reconstructWordsFromSteps } from '../../utils/syllabifier';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

interface LetraEditorPanelProps {
  allSteps: VocalStepData[];
  onUpdateSteps: (newSteps: VocalStepData[]) => void;
}

export const LetraEditorPanel: React.FC<LetraEditorPanelProps> = ({ allSteps, onUpdateSteps }) => {
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
    const nextSyl = hasSpace ? current.trimEnd() : `${current.trimEnd()} `;
    handleSyllableChange(stepIndex, nextSyl);
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
    <div className="flex flex-col gap-2 p-2.5 bg-black/50 border border-theme-border/60 rounded-xl cordel-card">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="font-bold text-amber-300">📜 LETRA DA TOADA</span>
        <span className="text-[10px] text-theme-ink/60">Bouton [␣ Espace] pour marquer la fin d'un mot</span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Ex: Eu vou va-di-ar..."
          className="flex-1 px-3 py-1 bg-black/60 border border-theme-border/50 rounded-lg text-xs font-mono text-theme-ink focus:outline-none focus:border-amber-400"
        />
        <button
          type="button"
          onClick={handleAlign}
          className="cordel-btn px-3 py-1 text-xs font-mono bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1 font-semibold"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Aligner</span>
        </button>
      </div>

      {/* Ruban des pastilles syllabiques */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 cordel-scrollbar">
        {activeSteps.length === 0 ? (
          <span className="text-[11px] font-mono text-theme-ink/50 italic">Aucune note active détectée.</span>
        ) : (
          activeSteps.map((st) => {
            const hasSpace = (st.syllable ?? '').endsWith(' ');
            return (
              <div key={st.stepIndex} className="flex flex-col items-center bg-white/5 border border-theme-border/40 rounded-lg p-1 min-w-[62px] shrink-0">
                <span className="text-[9px] font-mono text-amber-400 font-bold">{st.note}</span>
                <input
                  type="text"
                  value={st.syllable ?? ''}
                  onChange={(e) => handleSyllableChange(st.stepIndex, e.target.value)}
                  className="w-full text-center bg-black/70 border border-theme-border/30 rounded text-[11px] font-mono text-theme-ink px-0.5 py-0.5 mt-0.5 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleToggleTrailingSpace(st.stepIndex)}
                  className={`mt-1 px-1 py-0.5 rounded text-[8.5px] font-mono w-full transition-all ${
                    hasSpace ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold' : 'bg-white/5 text-theme-ink/50 hover:bg-white/10'
                  }`}
                  title={hasSpace ? 'Mot terminé (espace)' : 'Syllabe liée au mot suivant'}
                >
                  {hasSpace ? '␣ Espace' : '- Lié'}
                </button>
                <div className="flex items-center justify-between w-full mt-1 px-0.5">
                  <button type="button" onClick={() => handleShiftSyllable(st.stepIndex, -1)} className="p-0.5 hover:bg-white/10 rounded">
                    <ChevronLeft className="w-3 h-3 text-theme-ink/60" />
                  </button>
                  <button type="button" onClick={() => handleShiftSyllable(st.stepIndex, 1)} className="p-0.5 hover:bg-white/10 rounded">
                    <ChevronRight className="w-3 h-3 text-theme-ink/60" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Aperçu des mots reconstitués */}
      <div className="flex items-center gap-2 pt-1 border-t border-theme-border/30 text-[11px] font-mono">
        <span className="text-theme-ink/60">Mots reconstitués :</span>
        <span className="text-emerald-400 font-semibold italic bg-black/40 px-2 py-0.5 rounded">
          {reconstructedWords ? `« ${reconstructedWords} »` : '(vide)'}
        </span>
      </div>
    </div>
  );
};
