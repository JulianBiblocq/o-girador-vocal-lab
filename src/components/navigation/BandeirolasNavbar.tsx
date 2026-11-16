/**
 * BandeirolasNavbar.tsx
 * Cordelette à 4 Fanions Studio (pointe convexe vers le bas SVG 0,0->100,0->100,76->50,100->0,76)
 * + badge matriciel [X%] et boutons décrochés à droite [Vue Élève] & [Réglages] (< 130 lignes).
 */
import React, { useState, useMemo } from 'react';
import { Layers, Mic, Scissors, Music, LayoutGrid, Headphones, Settings } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useVocalTransportStore, type LivretType } from '../../stores/useVocalTransportStore';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { computeProjectProgress, type ProgressStepId, type ProgressStepState } from '../../utils/projectProgressTracker';
import { SongProgressMatrixModal } from './SongProgressMatrixModal';

interface FanionDef {
  id: LivretType;
  labelKey: 'fanion1Short' | 'fanion2Short' | 'fanion3Short' | 'fanion4Short';
  stepKey: ProgressStepId;
  icon: React.FC<{ className?: string }>;
}

const STUDIO_FANIONS: FanionDef[] = [
  { id: 'structure', labelKey: 'fanion1Short', stepKey: 'structure', icon: Layers },
  { id: 'prise', labelKey: 'fanion2Short', stepKey: 'recording', icon: Mic },
  { id: 'calage', labelKey: 'fanion3Short', stepKey: 'calage', icon: Scissors },
  { id: 'melodia', labelKey: 'fanion4Short', stepKey: 'notes', icon: Music },
];

function stateSymbol(status: ProgressStepState): string {
  if (status === 'done') return '✓';
  if (status === 'partial') return '◐';
  return '○';
}

export const BandeirolasNavbar: React.FC = () => {
  const activeLivret = useVocalTransportStore((s) => s.activeLivret);
  const setActiveLivret = useVocalTransportStore((s) => s.setActiveLivret);
  const viewRoleMode = useVocalTransportStore((s) => s.viewRoleMode);
  const setViewRoleMode = useVocalTransportStore((s) => s.setViewRoleMode);
  const { project } = useToadaProject();
  const { t, language } = useLanguage();
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);

  const progress = useMemo(() => computeProjectProgress(project, language), [project, language]);

  if (viewRoleMode === 'eleve') return null;

  return (
    <>
      <nav aria-label="Bandeirolas Studio" className="relative w-full mt-2 mb-4 select-none">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--cordel-border)] opacity-85 pointer-events-none" aria-hidden="true" />

        <div className="flex flex-wrap items-start justify-between gap-3 pt-[2px]">
          <div className="flex items-start gap-2 sm:gap-3 overflow-x-auto pb-1 cordel-scrollbar">
            {STUDIO_FANIONS.map(({ id, labelKey, stepKey, icon: Icon }) => {
              const isActive = activeLivret === id;
              const metric = progress.steps[stepKey];
              const fillColor = isActive ? '#9a3412' : 'var(--cordel-surface)';
              const textClass = isActive ? 'text-[#f4ecd8]' : 'text-theme-ink hover:text-[#9a3412] dark:hover:text-amber-300';

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveLivret(id)}
                  title={metric.tooltip}
                  className={`relative px-3.5 sm:px-4 pt-2 pb-4 min-w-[116px] sm:min-w-[132px] flex flex-col items-center justify-center gap-0.5 font-mono text-xs cursor-pointer transition-transform shrink-0 ${isActive ? 'translate-y-[1px] font-black' : 'opacity-90 hover:opacity-100 font-bold'} ${textClass}`}
                >
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-[1.5px_2px_0px_rgba(0,0,0,0.45)]" aria-hidden="true">
                    <polygon
                      points="1,1 99,1 99,76 50,98.5 1,76"
                      fill={fillColor}
                      stroke="var(--cordel-border)"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                  <span className="relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{t(labelKey)}</span>
                  </span>
                  <span className={`relative z-10 text-[10px] leading-tight font-bold ${isActive ? 'text-amber-200' : metric.status === 'done' ? 'text-emerald-700 dark:text-emerald-400' : 'opacity-75'}`}>
                    {stateSymbol(metric.status)} {metric.badgeText}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setIsMatrixOpen(true)}
              title={language === 'br' ? 'Grade detalhada por frase' : 'Grille récapitulative par phrase'}
              className="mt-1.5 h-8 px-2.5 cordel-card-sm rounded font-mono text-xs font-black inline-flex items-center gap-1.5 cursor-pointer hover:border-amber-500/70 shrink-0 text-[#9a3412] dark:text-amber-300"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{progress.overallCompletionPct}%</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setViewRoleMode('eleve')}
              className="h-8 px-3 rounded bg-[#0f766e] hover:opacity-90 text-white border border-[var(--cordel-border)] font-mono text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Headphones className="w-3.5 h-3.5" />
              <span>{t('btnStudentPreview')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveLivret('reglages')}
              className={`h-8 px-3 rounded font-mono text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${activeLivret === 'reglages' ? 'cordel-btn-primary' : 'cordel-card-sm hover:border-amber-500/60'}`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{t('btnReglagesShort')}</span>
            </button>
          </div>
        </div>
      </nav>

      <SongProgressMatrixModal isOpen={isMatrixOpen} onClose={() => setIsMatrixOpen(false)} />
    </>
  );
};
