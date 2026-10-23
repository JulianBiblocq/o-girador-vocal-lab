/**
 * PatternCompassBar.tsx
 * Mini-bandeau Boussole de Pattern pour changer de phrase à la volée (< 85 lignes).
 */
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';

export const PatternCompassBar: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { project, activePattern, setActivePatternId } = useToadaProject();
  const { t } = useLanguage();

  const patterns = project.patterns;
  const currentIndex = patterns.findIndex((p) => p.id === activePattern.id);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;

  const handlePrev = () => {
    if (safeIndex > 0) setActivePatternId(patterns[safeIndex - 1].id);
    else setActivePatternId(patterns[patterns.length - 1].id);
  };

  const handleNext = () => {
    if (safeIndex < patterns.length - 1) setActivePatternId(patterns[safeIndex + 1].id);
    else setActivePatternId(patterns[0].id);
  };

  const isPuxador = activePattern.role === 'puxador';

  return (
    <div className={`cordel-card p-1.5 sm:p-2 flex items-center justify-between gap-2 select-none rounded ${className}`}>
      {/* 1. Bouton Précédent */}
      <button
        type="button"
        onClick={handlePrev}
        title={t('compassPrevTooltip')}
        className="h-8 px-2 cordel-btn font-mono text-xs flex items-center gap-1 cursor-pointer shrink-0"
      >
        <ChevronLeft className="w-4 h-4 text-theme-accent" />
        <span className="hidden sm:inline">◀</span>
      </button>

      {/* 2. Sélecteur Central de Phrase avec badge de rôle et pastille audio */}
      <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
        <span
          className={`px-1.5 py-0.5 text-[9px] font-black tracking-wider uppercase rounded shrink-0 ${
            isPuxador ? 'bg-role-puxador text-[var(--cordel-text)]' : 'bg-role-coro text-[var(--cordel-text)]'
          }`}
        >
          {isPuxador ? t('rolePuxador') : t('roleCoro')}
        </span>

        <select
          value={activePattern.id}
          onChange={(e) => setActivePatternId(e.target.value)}
          aria-label="Sélection du motif vocal actif"
          className="bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] text-xs font-mono font-bold text-theme-ink px-2 py-1 outline-none rounded cursor-pointer max-w-[200px] sm:max-w-xs md:max-w-md truncate"
        >
          {patterns.map((pat, idx) => {
            const hasAudio = pat.recordingResult !== null || Boolean(pat.pack);
            const roleTag = pat.role === 'puxador' ? '[PUX]' : '[CORO]';
            const audioDot = hasAudio ? '●' : '○';
            return (
              <option key={pat.id} value={pat.id} className="bg-[var(--cordel-surface)] text-theme-ink">
                {idx + 1}. {roleTag} {pat.name} ({pat.measuresCount}M) {audioDot}
              </option>
            );
          })}
        </select>

        <span className="text-[11px] font-mono text-[var(--cordel-secondary-text)] shrink-0 hidden md:inline">
          {safeIndex + 1}/{patterns.length}
        </span>
      </div>

      {/* 3. Bouton Suivant */}
      <button
        type="button"
        onClick={handleNext}
        title={t('compassNextTooltip')}
        className="h-8 px-2 cordel-btn font-mono text-xs flex items-center gap-1 cursor-pointer shrink-0"
      >
        <span className="hidden sm:inline">▶</span>
        <ChevronRight className="w-4 h-4 text-theme-accent" />
      </button>
    </div>
  );
};
