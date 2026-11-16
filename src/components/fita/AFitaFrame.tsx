/**
 * AFitaFrame.tsx
 * Châssis fédérateur « A Fita » (La Bande Magnétique à 2 pistes Puxador #9a3412 / Coro #0f766e)
 * avec bobines gravées SVG, navigation de phrase et slot d'actions courtes (< 125 lignes).
 */
import React from 'react';
import { ChevronLeft, ChevronRight, Repeat } from 'lucide-react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { getPatternTwinRepeatCount, isTwinBannerDismissed, setTwinBannerDismissed } from '../common/TwinPatternsManagerBar';

interface AFitaFrameProps {
  title: string;
  isSpinning?: boolean;
  showPatternNav?: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const EngravedTapeReel: React.FC<{ spinning?: boolean }> = ({ spinning }) => (
  <svg
    viewBox="0 0 28 28"
    className={`w-6 h-6 text-[var(--cordel-text)] opacity-85 shrink-0 ${spinning ? 'fita-reel-spinning' : ''}`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    aria-hidden="true"
  >
    <circle cx="14" cy="14" r="12" />
    <circle cx="14" cy="14" r="4" fill="currentColor" fillOpacity="0.2" />
    <line x1="14" y1="2" x2="14" y2="10" />
    <line x1="3.6" y1="20" x2="10.5" y2="16" />
    <line x1="24.4" y1="20" x2="17.5" y2="16" />
  </svg>
);

export const AFitaFrame: React.FC<AFitaFrameProps> = ({
  title, isSpinning = false, showPatternNav = true, headerRight, children, className = '',
}) => {
  const { project, activePattern, setActivePatternId } = useToadaProject();
  const { t, language } = useLanguage(), isBr = language === 'br';
  const curIdx = Math.max(0, project.patterns.findIndex((p) => p.id === activePattern.id));
  const total = project.patterns.length;
  const repeatCount = getPatternTwinRepeatCount(project, activePattern.id);
  const measureSuffix = isBr ? 'C' : 'M';
  const isPux = activePattern.role === 'puxador';

  const stepPattern = (delta: number) => {
    if (total <= 1) return;
    const next = project.patterns[(curIdx + delta + total) % total];
    if (next) setActivePatternId(next.id);
  };

  return (
    <section className={`w-full cordel-card rounded overflow-hidden shadow-sm ${className}`}>
      <div className="w-full flex flex-col" aria-hidden="true">
        <div className="h-[3px] w-full bg-[#9a3412]" />
        <div className="h-[3px] w-full bg-[#0f766e]" />
      </div>

      <div className="px-3 py-2 bg-[var(--cordel-subcard-bg)] border-b border-[var(--cordel-border-sub)] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="inline-flex items-center gap-2 shrink-0">
          <EngravedTapeReel spinning={isSpinning} />
          <span className="font-black uppercase tracking-wider text-[11px] text-theme-ink">{title}</span>
        </div>

        {showPatternNav && total > 0 && (
          <div className="inline-flex items-center gap-1.5 flex-wrap">
            <button type="button" onClick={() => stepPattern(-1)} disabled={total <= 1} title={t('fitaPrevPhrase')} className="p-1 cordel-card-sm rounded cursor-pointer disabled:opacity-40">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className={`px-1.5 py-0.5 text-[10px] font-black uppercase rounded text-white ${isPux ? 'bg-[#9a3412]' : 'bg-[#0f766e]'}`}>
              {isPux ? t('rolePuxador') : t('roleCoro')}
            </span>
            <select
              value={activePattern.id}
              onChange={(e) => setActivePatternId(e.target.value)}
              className="cordel-card-sm px-2 py-0.5 font-bold text-xs text-theme-ink rounded cursor-pointer max-w-[220px]"
            >
              {project.patterns.map((p, idx) => {
                const hasRec = Boolean(p.recordingResult?.pcm?.length || p.rawAudioSamples?.length);
                return (
                  <option key={p.id} value={p.id}>
                    {idx + 1}/{total} • {p.name} ({p.measuresCount}{measureSuffix}){hasRec ? ' ✓' : ''}
                  </option>
                );
              })}
            </select>
            <button type="button" onClick={() => stepPattern(1)} disabled={total <= 1} title={t('fitaNextPhrase')} className="p-1 cordel-card-sm rounded cursor-pointer disabled:opacity-40">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            {repeatCount > 1 && (
              <button
                type="button"
                onClick={() => setTwinBannerDismissed(project, activePattern, !isTwinBannerDismissed(activePattern))}
                className="px-2 py-0.5 cordel-card-sm rounded text-[10.5px] font-bold inline-flex items-center gap-1 cursor-pointer hover:border-amber-500/70"
                title={isBr ? 'Gerir tomadas gêmeas' : 'Gérer les prises jumelles'}
              >
                <Repeat className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>{isBr ? `Gêmeos (${repeatCount})` : `Jumeaux (${repeatCount})`}</span>
              </button>
            )}
          </div>
        )}

        <div className="inline-flex items-center gap-2 flex-wrap">
          {headerRight}
          <EngravedTapeReel spinning={isSpinning} />
        </div>
      </div>

      <div className="p-3 sm:p-4 flex flex-col gap-3">{children}</div>
    </section>
  );
};
