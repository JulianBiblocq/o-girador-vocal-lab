/**
 * RodaProjectionGauge.tsx
 * Jauge visuelle temps réel « 🔔 Projection Roda (Masque 3 kHz) » avec retour couleur (Sable ➔ Émeraude/Or) et conseil vocal (< 90 lignes).
 */
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { RodaProjectionStatus } from '../../audio/rodaResonanceAnalyzer';
import { Bell, AlertTriangle, Wind } from 'lucide-react';

export interface RodaProjectionGaugeProps {
  projectionScorePct: number;
  status: RodaProjectionStatus;
  isActive?: boolean;
}

export const RodaProjectionGauge: React.FC<RodaProjectionGaugeProps> = ({
  projectionScorePct,
  status,
  isActive = true,
}) => {
  const { t } = useLanguage();
  const clampedPct = Math.max(0, Math.min(100, Math.round(projectionScorePct)));

  const adviceText =
    status === 'roda_optimal'
      ? t('rodaStatusOptimal')
      : status === 'forcage'
      ? t('rodaStatusForcage')
      : t('rodaStatusTimide');

  const badgeText =
    status === 'roda_optimal'
      ? t('rodaBadgeOptimal')
      : status === 'forcage'
      ? t('rodaBadgeForcage')
      : t('rodaBadgeTimide');

  const barColorClass =
    status === 'roda_optimal'
      ? 'bg-gradient-to-r from-amber-500 via-emerald-500 to-emerald-400'
      : status === 'forcage'
      ? 'bg-gradient-to-r from-amber-600 to-red-600'
      : 'bg-gradient-to-r from-amber-800/60 to-amber-500/80';

  const badgeColorClass =
    status === 'roda_optimal'
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
          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${badgeColorClass}`}>
            {badgeText} • {clampedPct}%
          </span>
        </div>
        <span className={`text-[11px] font-bold ${isActive ? 'opacity-100' : 'opacity-75'}`}>
          {adviceText}
        </span>
      </div>

      <div className="relative w-full h-2.5 bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] rounded-full overflow-hidden">
        {/* Seuil cible Roda (40 %) */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-emerald-600/70 z-10"
          style={{ left: '40%' }}
          title="Seuil Voix de Roda (40 %)"
        />
        <div
          className={`h-full transition-all duration-100 ease-out rounded-full ${barColorClass}`}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
    </div>
  );
};
