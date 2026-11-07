/**
 * SongProgressMatrixModal.tsx
 * Grille récapitulative dépliable « Vue d'ensemble du morceau » (« Où j'en suis ») :
 * Lignes = N patterns du morceau • Colonnes = 5 étapes par phrase + bouton [ Continuer là où je me suis arrêté ] (< 130 lignes).
 */
import React from 'react';
import { Check, ArrowRight, Play, X, Mic, Scissors, Drum, Piano, Gauge, Circle } from 'lucide-react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useVocalTransportStore, type LivretType } from '../../stores/useVocalTransportStore';
import { useLanguage } from '../../i18n/LanguageContext';
import { computeProjectProgress } from '../../utils/projectProgressTracker';
import type { PatternStepStatus } from '../../types/project.types';

export interface SongProgressMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MatrixColumn {
  key: keyof PatternStepStatus;
  labelFr: string;
  labelBr: string;
  livret: LivretType;
  foldNotes?: boolean;
  icon: React.FC<{ className?: string }>;
}

const COLUMNS: MatrixColumn[] = [
  { key: 'recorded', labelFr: '1. Enregistrement', labelBr: '1. Gravação', livret: 'prise', icon: Mic },
  { key: 'trimmed', labelFr: '2. Calage', labelBr: '2. Alinhamento', livret: 'calage', icon: Scissors },
  { key: 'rhythmValidated', labelFr: '3. Rythme & Syllabes', labelBr: '3. Ritmo e Sílabas', livret: 'melodia', foldNotes: true, icon: Drum },
  { key: 'notesValidated', labelFr: '4. Notes', labelBr: '4. Notas', livret: 'melodia', foldNotes: false, icon: Piano },
  { key: 'variantsReady', labelFr: '5. Vitesses & Hauteurs', labelBr: '5. Velocidades e Tons', livret: 'melodia', icon: Gauge },
];

export const SongProgressMatrixModal: React.FC<SongProgressMatrixModalProps> = ({ isOpen, onClose }) => {
  const { project, setActivePatternId, togglePatternFoldNotes, updatePatternStepStatus } = useToadaProject();
  const setActiveLivret = useVocalTransportStore((s) => s.setActiveLivret);
  const { language } = useLanguage(), isBr = language === 'br';

  if (!isOpen) return null;
  const progress = computeProjectProgress(project, language);

  const navigateToPatternStep = (patternId: string, livret: LivretType, foldNotes?: boolean) => {
    setActivePatternId(patternId);
    if (typeof foldNotes === 'boolean') togglePatternFoldNotes(patternId, foldNotes);
    setActiveLivret(livret);
    onClose();
  };

  const handleContinueWhereLeftOff = () => {
    const { nextAction } = progress;
    if (nextAction.patternId) {
      setActivePatternId(nextAction.patternId);
      if (typeof nextAction.foldNotes === 'boolean') togglePatternFoldNotes(nextAction.patternId, nextAction.foldNotes);
    }
    setActiveLivret(nextAction.livret);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 font-mono">
      <div className="w-full max-w-5xl cordel-card flex flex-col gap-3 p-3 sm:p-4 text-theme-ink max-h-[90vh] overflow-hidden rounded shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--cordel-border-sub)] pb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-base font-black uppercase tracking-wider text-theme-wood">
              {isBr ? 'Visão geral da toada' : "Vue d'ensemble du morceau"}
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-xs font-bold text-[#9a3412] dark:text-amber-300">
              {progress.overallCompletionPct}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleContinueWhereLeftOff} className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors">
              <Play className="w-3.5 h-3.5 fill-current" /><span>{isBr ? 'Continuar de onde parei' : 'Continuer là où je me suis arrêté'}</span>
            </button>
            <button type="button" onClick={onClose} className="p-1.5 cordel-card-sm hover:bg-red-500/15 rounded cursor-pointer" title={isBr ? 'Fechar' : 'Fermer'}><X className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="overflow-auto cordel-scrollbar flex-1 border border-[var(--cordel-border-sub)] rounded">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-[var(--cordel-surface)] border-b-2 border-[var(--cordel-border-panel)] text-[11px] uppercase">
              <tr>
                <th className="p-2 font-black">{isBr ? 'Frase (Papel + Compassos)' : 'Phrase (Rôle + Mesures)'}</th>
                {COLUMNS.map((col) => {
                  const Icon = col.icon;
                  return <th key={col.key} className="p-2 font-black text-center whitespace-nowrap"><span className="inline-flex items-center gap-1"><Icon className="w-3.5 h-3.5 text-theme-accent" />{isBr ? col.labelBr : col.labelFr}</span></th>;
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--cordel-border-sub)]">
              {progress.patternRows.map(({ pattern, status }, idx) => (
                <tr key={pattern.id} className="hover:bg-amber-500/5 transition-colors">
                  <td className="p-2">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase ${pattern.role === 'puxador' ? 'bg-amber-600/20 text-amber-900 dark:text-amber-300 border border-amber-500/40' : 'bg-teal-600/20 text-teal-900 dark:text-teal-300 border border-teal-500/40'}`}>
                          {pattern.role === 'puxador' ? 'Puxador' : 'Coro'}
                        </span>
                        <span>#{idx + 1} • {pattern.name}</span>
                        <span className="text-[10px] opacity-70">({pattern.measuresCount}M)</span>
                      </div>
                      {pattern.assignedLyricsText && <span className="text-[10.5px] text-[var(--cordel-secondary-text)] truncate max-w-[240px]">{pattern.assignedLyricsText}</span>}
                    </div>
                  </td>
                  {COLUMNS.map((col) => {
                    const isDone = status[col.key];
                    return (
                      <td key={col.key} className="p-1.5 text-center align-middle">
                        <div className="inline-flex items-center justify-center gap-1">
                          <button type="button" onClick={() => updatePatternStepStatus(pattern.id, { [col.key]: !isDone })} title={isBr ? 'Clique para validar / invalidar' : 'Cliquer pour valider / invalider'} className={`px-2 py-1 rounded text-[11px] font-bold inline-flex items-center gap-1 border cursor-pointer transition-colors ${isDone ? 'bg-emerald-700/20 border-emerald-500/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-700/30' : 'border-[var(--cordel-border-sub)] text-theme-ink/40 hover:text-theme-ink/80'}`}>
                            {isDone ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Circle className="w-3 h-3" />}
                          </button>
                          {!isDone ? (
                            <button type="button" onClick={() => navigateToPatternStep(pattern.id, col.livret, col.foldNotes)} className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/50 text-[#9a3412] dark:text-amber-300 text-[10.5px] font-bold inline-flex items-center gap-1 cursor-pointer">
                              <span>{isBr ? 'A fazer' : 'À faire'}</span><ArrowRight className="w-3 h-3" />
                            </button>
                          ) : (
                            <button type="button" onClick={() => navigateToPatternStep(pattern.id, col.livret, col.foldNotes)} title={isBr ? 'Abrir este bloco nesta etapa' : 'Ouvrir cette phrase sur cette étape'} className="p-1 rounded hover:bg-white/10 text-theme-ink/60 hover:text-theme-ink cursor-pointer">
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
