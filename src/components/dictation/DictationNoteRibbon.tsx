/**
 * DictationNoteRibbon.tsx
 * Ruban éditable des notes captées par le Cherche-Notes Puxador (Code Papier + Solfège,
 * écoute unitaire ou séquentielle, copie ligne papier et association à la phrase active) (< 115 lignes).
 */
import React from 'react';
import { Play, Copy, Trash2, CheckCircle2, X, Plus } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatPaperNoteCode, formatSolfegeNoteWithOctave } from '../../audio/forcedMelodyAligner';

export interface DictationNoteRibbonProps {
  notes: number[];
  viewOffsetSt: number;
  currentCandidateMidi: number;
  onAddCurrentNote: () => void;
  onPlayNote: (sungMidi: number) => void;
  onRemoveAt: (index: number) => void;
  onPlaySequence: () => void;
  onCopyPaperLine: () => void;
  onClear: () => void;
  onAttachToPattern: () => void;
}

export const DictationNoteRibbon: React.FC<DictationNoteRibbonProps> = ({
  notes,
  viewOffsetSt,
  currentCandidateMidi,
  onAddCurrentNote,
  onPlayNote,
  onRemoveAt,
  onPlaySequence,
  onCopyPaperLine,
  onClear,
  onAttachToPattern,
}) => {
  const { t, language } = useLanguage();

  return (
    <div className="cordel-card-sm p-3 rounded flex flex-col gap-2.5 font-mono text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-black uppercase text-theme-ink">
          {t('dialRibbonTitle')} ({notes.length})
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onAddCurrentNote}
            className="cordel-btn px-2 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>{formatPaperNoteCode(currentCandidateMidi + viewOffsetSt)}</span>
          </button>
          <button
            type="button"
            disabled={notes.length === 0}
            onClick={onPlaySequence}
            className="cordel-btn px-2 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{t('dialPlaySequenceBtn')}</span>
          </button>
          <button
            type="button"
            disabled={notes.length === 0}
            onClick={onCopyPaperLine}
            className="cordel-btn px-2 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <Copy className="w-3 h-3" />
            <span>{t('dialCopyPaperBtn')}</span>
          </button>
          <button
            type="button"
            disabled={notes.length === 0}
            onClick={onClear}
            className="cordel-btn px-2 py-1 rounded text-[11px] font-bold text-red-600 dark:text-red-400 inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <Trash2 className="w-3 h-3" />
            <span>{t('dialClearRibbonBtn')}</span>
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="py-2.5 px-3 rounded border border-dashed border-[var(--cordel-border-sub)] text-[11px] opacity-75 text-center">
          {t('dialRibbonEmpty')}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 max-h-28 overflow-y-auto py-0.5">
          {notes.map((m, idx) => {
            const disp = m + viewOffsetSt;
            return (
              <div key={`${idx}-${m}`} className="inline-flex items-center rounded border border-amber-500/50 bg-amber-500/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => onPlayNote(m)}
                  className="px-2 py-1 text-left hover:bg-amber-500/20 cursor-pointer flex items-baseline gap-1"
                  title={t('dialListenNoteTitle')}
                >
                  <span className="font-black text-xs text-[#9a3412] dark:text-amber-300">{formatPaperNoteCode(disp)}</span>
                  <span className="text-[10px] opacity-75">{formatSolfegeNoteWithOctave(disp, language)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveAt(idx)}
                  className="px-1.5 py-1 hover:bg-red-500/20 text-red-600 dark:text-red-400 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        disabled={notes.length === 0}
        onClick={onAttachToPattern}
        className="cordel-btn-primary w-full py-2 px-3 rounded font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
      >
        <CheckCircle2 className="w-4 h-4" />
        <span>{t('dialAttachToPatternBtn')}</span>
      </button>
    </div>
  );
};
