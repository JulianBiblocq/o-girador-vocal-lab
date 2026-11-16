/**
 * RodaProjectionGauge.tsx
 * Jauge visuelle temps réel « Projection Roda (Masque 3 kHz) » pilotable par ref GPU (0 re-render 60 Hz) (< 95 lignes).
 */
import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { RodaProjectionStatus } from '../../audio/rodaResonanceAnalyzer';
import { Bell, AlertTriangle, Wind } from 'lucide-react';

export interface RodaProjectionGaugeProps {
  projectionScorePct: number;
  status: RodaProjectionStatus;
  isActive?: boolean;
  liveUpdaterRef?: React.MutableRefObject<((pct: number, status: RodaProjectionStatus) => void) | null>;
}

export const RodaProjectionGauge: React.FC<RodaProjectionGaugeProps> = ({
  projectionScorePct,
  status,
  isActive = true,
  liveUpdaterRef,
}) => {
  const { t } = useLanguage();
  const clampedPct = Math.max(0, Math.min(100, Math.round(projectionScorePct)));
  const barFillRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const adviceRef = useRef<HTMLSpanElement>(null);

  const getTexts = (st: RodaProjectionStatus) => ({
    advice: st === 'roda_optimal' ? t('rodaStatusOptimal') : st === 'forcage' ? t('rodaStatusForcage') : t('rodaStatusTimide'),
    badge: st === 'roda_optimal' ? t('rodaBadgeOptimal') : st === 'forcage' ? t('rodaBadgeForcage') : t('rodaBadgeTimide'),
  });

  useEffect(() => {
    if (!liveUpdaterRef) return;
    liveUpdaterRef.current = (pct, st) => {
      const c = Math.max(0, Math.min(100, Math.round(pct)));
      if (barFillRef.current) barFillRef.current.style.transform = `scaleX(${(c / 100).toFixed(3)})`;
      const txts = getTexts(st);
      if (badgeRef.current) badgeRef.current.textContent = `${txts.badge} • ${c}%`;
      if (adviceRef.current) adviceRef.current.textContent = txts.advice;
    };
    return () => { liveUpdaterRef.current = null; };
  });

  const { advice, badge } = getTexts(status);
  const barColorClass = status === 'roda_optimal'
    ? 'bg-gradient-to-r from-amber-500 via-emerald-500 to-emerald-400'
    : status === 'forcage'
    ? 'bg-gradient-to-r from-amber-600 to-red-600'
    : 'bg-gradient-to-r from-amber-800/60 to-amber-500/80';

  const badgeColorClass = status === 'roda_optimal'
    ? 'bg-emerald-600/20 text-emerald-800 dark:text-emerald-300 border-emerald-600/40'
    : status === 'forcage'
    ? 'bg-red-600/20 text-red-800 dark:text-red-300 border-red-600/40'
    : 'bg-amber-600/15 text-amber-900 dark:text-amber-300 border-amber-600/30';

  const StatusIcon = status === 'roda_optimal' ? Bell : status === 'forcage' ? AlertTriangle : Wind;

  return (
    <div className="cordel-card p-2.5 w-full flex flex-col gap-1.5 select-none text-xs font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-theme-ink flex items-center gap-1.5">
            <StatusIcon className="w-3.5 h-3.5 text-theme-accent shrink-0" />
            <span>{t('rodaGaugeTitle')}</span>
          </span>
          <span ref={badgeRef} className={`px-2 py-0.5 rounded border text-[10px] font-bold ${badgeColorClass}`}>
            {badge} • {clampedPct}%
          </span>
        </div>
        <span ref={adviceRef} className={`text-[11px] font-bold ${isActive ? 'opacity-100' : 'opacity-75'}`}>
          {advice}
        </span>
      </div>

      <div className="relative w-full h-2.5 bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] rounded-full overflow-hidden">
        <div className="absolute top-0 bottom-0 w-0.5 bg-emerald-600/70 z-10" style={{ left: '40%' }} title="Seuil Voix de Roda (40 %)" />
        <div
          ref={barFillRef}
          className={`h-full w-full origin-left rounded-full will-change-transform ${barColorClass}`}
          style={{ transform: `scaleX(${(clampedPct / 100).toFixed(3)})` }}
        />
      </div>
    </div>
  );
};
