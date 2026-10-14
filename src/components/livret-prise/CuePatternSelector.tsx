/**
 * CuePatternSelector.tsx
 * Sélecteur compact de l'appel précédent (M-2 & M-1) pendant l'enregistrement.
 */
import React from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Headphones, CheckCircle2 } from 'lucide-react';

export const CuePatternSelector: React.FC<{ disabled?: boolean }> = ({ disabled = false }) => {
  const { project, activePattern, cueMode, setCueMode, getPreviousConductorPattern } = useToadaProject();
  const { t } = useLanguage();

  const previousPattern = getPreviousConductorPattern();
  const otherRecordedPatterns = project.patterns.filter(
    (p) => p.id !== activePattern.id && p.recordingResult !== null && p.recordingResult.pcm.length > 0
  );

  // Détermination du pattern effectif
  const effectiveCuePattern =
    cueMode === 'none'
      ? null
      : cueMode === 'auto_previous'
      ? previousPattern
      : project.patterns.find((p) => p.id === cueMode) ?? null;

  const isCueReady = effectiveCuePattern && effectiveCuePattern.recordingResult !== null;

  return (
    <div className="cordel-card p-2 w-full flex flex-wrap items-center justify-between gap-2 bg-black/40 text-xs font-mono select-none">
      <div className="flex items-center gap-2">
        <Headphones className="w-3.5 h-3.5 text-theme-accent shrink-0" />
        <span className="font-bold text-theme-ink/80 text-[11px]">{t('cueSelectorLabel')}</span>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={cueMode}
          disabled={disabled}
          onChange={(e) => setCueMode(e.target.value)}
          className="bg-black/60 border border-theme-border/50 text-[11px] font-mono text-theme-ink px-2 py-1 outline-none rounded-none cursor-pointer"
        >
          <option value="none" className="bg-theme-bg text-theme-ink">
            {t('cueNone')}
          </option>
          <option value="auto_previous" className="bg-theme-bg text-theme-ink">
            {t('cueAutoPrevious')} {previousPattern ? `(${previousPattern.name})` : ''}
          </option>
          {otherRecordedPatterns.map((p) => (
            <option key={p.id} value={p.id} className="bg-theme-bg text-theme-ink">
              {t('cueCustomPrefix')} {p.name} ({p.role.toUpperCase()} • {p.measuresCount} M)
            </option>
          ))}
        </select>

        {isCueReady && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-500/40 px-1.5 py-0.5">
            <CheckCircle2 className="w-3 h-3 text-cyan-400" />
            <span>{t('cueReadyBadge', { measures: effectiveCuePattern.measuresCount })}</span>
          </span>
        )}
      </div>
    </div>
  );
};
