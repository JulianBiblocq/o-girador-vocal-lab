/**
 * SongProgressStrip.tsx
 * Bandeau compact d'avancement du morceau (« Où j'en suis ») placé juste sous MainLivretNavbar :
 * 7 pastilles cliquables reliées par un fil conducteur Cordel + bouton [ Grille détaillée (X%) ] (< 130 lignes).
 */
import React, { useState, useMemo } from 'react';
import { Layers, Mic, Scissors, Drum, Piano, Gauge, Share2, Check, LayoutGrid } from 'lucide-react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useVocalTransportStore, type LivretType } from '../../stores/useVocalTransportStore';
import { useLanguage } from '../../i18n/LanguageContext';
import { computeProjectProgress, type ProgressStepId, type ProgressStepState } from '../../utils/projectProgressTracker';
import { SongProgressMatrixModal } from './SongProgressMatrixModal';

interface PillDef {
  id: ProgressStepId;
  labelFr: string;
  labelBr: string;
  livret: LivretType;
  foldNotes?: boolean;
  icon: React.FC<{ className?: string }>;
}

const STEP_PILLS: PillDef[] = [
  { id: 'structure', labelFr: 'Structure', labelBr: 'Estrutura', livret: 'structure', icon: Layers },
  { id: 'recording', labelFr: 'Enregistrement', labelBr: 'Gravação', livret: 'prise', icon: Mic },
  { id: 'calage', labelFr: 'Calage', labelBr: 'Alinhamento', livret: 'calage', icon: Scissors },
  { id: 'rhythm', labelFr: 'Rythme', labelBr: 'Ritmo', livret: 'melodia', foldNotes: true, icon: Drum },
  { id: 'notes', labelFr: 'Notes', labelBr: 'Notas', livret: 'melodia', foldNotes: false, icon: Piano },
  { id: 'variants', labelFr: 'Vitesses & Hauteurs', labelBr: 'Velocidades e Tons', livret: 'melodia', icon: Gauge },
  { id: 'sync', labelFr: 'Partage', labelBr: 'Compartilhar', livret: 'melodia', icon: Share2 },
];

function getPillStyle(status: ProgressStepState): string {
  if (status === 'done') {
    return 'bg-emerald-700/15 border-emerald-500/70 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-700/25';
  }
  if (status === 'partial') {
    return 'bg-amber-500/15 border-amber-500/70 text-[#9a3412] dark:text-amber-300 hover:bg-amber-500/25';
  }
  return 'bg-stone-500/10 border-[var(--cordel-border-sub)] text-theme-ink/60 hover:text-theme-ink hover:bg-stone-500/15';
}

export const SongProgressStrip: React.FC = () => {
  const { project, setActivePatternId, togglePatternFoldNotes } = useToadaProject();
  const viewRoleMode = useVocalTransportStore((s) => s.viewRoleMode);
  const setActiveLivret = useVocalTransportStore((s) => s.setActiveLivret);
  const { language } = useLanguage(), isBr = language === 'br';
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);

  const progress = useMemo(() => computeProjectProgress(project, language), [project, language]);

  if (viewRoleMode === 'eleve') return null;

  const handleStepClick = (pill: PillDef) => {
    const metric = progress.steps[pill.id];
    const targetPatternId = metric.nextIncompletePatternId || project.activePatternId || project.patterns[0]?.id;
    if (targetPatternId) {
      setActivePatternId(targetPatternId);
      if (typeof pill.foldNotes === 'boolean') {
        togglePatternFoldNotes(targetPatternId, pill.foldNotes);
      }
    }
    setActiveLivret(pill.livret);
  };

  return (
    <>
      <div
        aria-label={isBr ? 'Progresso da toada' : 'Avancement du morceau'}
        className="w-full cordel-card px-2.5 py-1.5 mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono select-none"
      >
        <div className="flex items-center gap-1 overflow-x-auto cordel-scrollbar py-0.5 flex-1">
          {STEP_PILLS.map((pill, idx) => {
            const metric = progress.steps[pill.id];
            const Icon = pill.icon;
            return (
              <React.Fragment key={pill.id}>
                <button
                  type="button"
                  onClick={() => handleStepClick(pill)}
                  title={metric.tooltip}
                  className={`px-2 py-1 rounded border flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all shrink-0 ${getPillStyle(metric.status)}`}
                >
                  {metric.status === 'done' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <Icon className="w-3.5 h-3.5 shrink-0 opacity-85" />
                  )}
                  <span className="font-black">{isBr ? pill.labelBr : pill.labelFr}</span>
                  <span className="text-[10px] font-bold opacity-90 px-1 py-0.2 rounded bg-black/5 dark:bg-white/10">
                    {metric.badgeText}
                  </span>
                </button>
                {idx < STEP_PILLS.length - 1 && (
                  <span className="w-2.5 h-[2px] bg-[var(--cordel-border-panel)] opacity-45 shrink-0 hidden md:inline-block" aria-hidden="true" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setIsMatrixOpen(true)}
          className="px-2.5 py-1 rounded cordel-btn-primary text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 shadow-2xs"
          title={isBr ? 'Abrir a grade detalhada de progresso por frase' : "Ouvrir la grille récapitulative détaillée par phrase (« Où j'en suis »)"}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>{isBr ? `Grade detalhada (${progress.overallCompletionPct}%)` : `Grille détaillée (${progress.overallCompletionPct}%)`}</span>
        </button>
      </div>

      <SongProgressMatrixModal isOpen={isMatrixOpen} onClose={() => setIsMatrixOpen(false)} />
    </>
  );
};

