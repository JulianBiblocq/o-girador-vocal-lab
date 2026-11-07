/**
 * UncertainNotesResolverBar.tsx
 * Barre de résolution en 1 clic des briques en « Point de Doute » (`?`) au-dessus du Piano Roll (< 110 lignes).
 */
import React from 'react';
import { HelpCircle, Check, CheckCircle2 } from 'lucide-react';
import type { VocalStepData } from '../../types/vocalPack.types';
import { noteNameToMidi, midiToNoteName } from '../../utils/noteUtils';
import { formatReferencePitchSolfege } from '../../audio/projectScaleAnalyzer';
import { moveBrick } from './pianoRollInteractions';
import { useLanguage } from '../../i18n/LanguageContext';

export interface UncertainNotesResolverBarProps {
  allSteps: VocalStepData[];
  hasAnacrusis?: boolean;
  beatsPerMeasure?: number;
  resPerBeat?: number;
  onUpdateSteps: (newSteps: VocalStepData[], commit?: boolean) => void;
  onPlayNotePreview?: (midi: number) => void;
}

function formatStepMeasureBeatLabel(stepIdx: number, hasAnac: boolean, beatsPerMeasure: number, resPerBeat: number): string {
  const globalBeat = Math.floor(stepIdx / Math.max(1, resPerBeat)), anacBeats = hasAnac ? beatsPerMeasure : 0;
  if (globalBeat < anacBeats) return `Ana•T${globalBeat + 1}`;
  const mainBeat = globalBeat - anacBeats;
  return `M${Math.floor(mainBeat / Math.max(1, beatsPerMeasure)) + 1}•T${(mainBeat % Math.max(1, beatsPerMeasure)) + 1}`;
}

export const UncertainNotesResolverBar: React.FC<UncertainNotesResolverBarProps> = ({
  allSteps, hasAnacrusis = true, beatsPerMeasure = 4, resPerBeat = 4, onUpdateSteps, onPlayNotePreview,
}) => {
  const { language } = useLanguage(), isBr = language === 'br';
  const activeRoots = allSteps.map((step, idx) => ({ step, idx })).filter(({ step }) => step.active && !step.isTie && step.note !== '───');
  const uncertainBricks = activeRoots.filter(({ step }) => Boolean(step.isUncertain));

  if (activeRoots.length === 0) return null;
  if (uncertainBricks.length === 0) {
    return (
      <div className="px-2.5 py-1 rounded bg-emerald-700/10 border border-emerald-500/40 text-emerald-900 dark:text-emerald-300 text-[11px] font-mono font-bold inline-flex items-center gap-1.5 w-fit">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        <span>{isBr ? '0 dúvida — Todas as notas da frase estão validadas' : '0 doute — Toutes les notes de la phrase sont validées'}</span>
      </div>
    );
  }

  const handleChooseNote = (rootIdx: number, targetNote: string) => {
    const targetMidi = noteNameToMidi(targetNote) || allSteps[rootIdx]?.midiNumber || 60;
    onUpdateSteps(moveBrick(allSteps, rootIdx, targetMidi), true);
    onPlayNotePreview?.(targetMidi);
  };

  const handleValidateAll = () => {
    const cleared = allSteps.map((st) => (st.isUncertain ? { ...st, isUncertain: false, alternativeNote: undefined, doubtReason: undefined } : st));
    onUpdateSteps(cleared, true);
  };

  return (
    <div className="cordel-card p-2 rounded border border-amber-500/60 bg-amber-500/10 flex flex-col gap-1.5 text-xs font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-[#9a3412] dark:text-amber-300 inline-flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 shrink-0" />
          <span>{isBr ? `${uncertainBricks.length} ponto(s) de dúvida (?) — Escolha a nota cantada em 1 clique :` : `${uncertainBricks.length} point(s) de doute (?) — Choisissez la note chantée en 1 clic :`}</span>
        </span>
        <button type="button" onClick={handleValidateAll} className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs">
          <Check className="w-3.5 h-3.5" /><span>{isBr ? 'Validar todas as notas propostas' : 'Valider toutes les notes proposées'}</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {uncertainBricks.map(({ step, idx }) => {
          const posLabel = formatStepMeasureBeatLabel(idx, hasAnacrusis, beatsPerMeasure, resPerBeat);
          const sylLabel = step.syllable?.trim() || '•';
          const mainNote = step.note || midiToNoteName(step.midiNumber);
          const altNote = step.alternativeNote || midiToNoteName((step.midiNumber || 60) + 2);
          const mainSolfege = formatReferencePitchSolfege(mainNote, language), altSolfege = formatReferencePitchSolfege(altNote, language);
          return (
            <div key={idx} className="px-2 py-1 rounded bg-[var(--cordel-surface)] border border-amber-500/50 inline-flex items-center gap-1.5 text-[11px]">
              <span className="font-bold text-[#9a3412] dark:text-amber-300">?</span>
              <span className="font-bold">"{sylLabel}"</span>
              <span className="text-[10px] opacity-75">({posLabel}) :</span>
              <button type="button" onClick={() => handleChooseNote(idx, mainNote)} className="px-1.5 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold cursor-pointer">
                {isBr ? `Manter ${mainSolfege}` : `Garder ${mainSolfege}`}
              </button>
              <button type="button" onClick={() => handleChooseNote(idx, altNote)} className="px-1.5 py-0.5 rounded bg-[#9a3412] hover:opacity-90 text-white font-bold cursor-pointer">
                {isBr ? `Escolher ${altSolfege}` : `Choisir ${altSolfege}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
