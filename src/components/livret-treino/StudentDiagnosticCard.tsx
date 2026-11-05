/**
 * StudentDiagnosticCard.tsx
 * Carte de diagnostic pédagogique en 4 piliers (🎯 Justesse, 🥁 Attaque, 🌬️ Tenue, 🔔 Projection Roda) + Réécoute comparative (< 120 lignes).
 */
import React from 'react';
import type { StudentAnalysisResult } from '../../audio/studentPitchAnalyzer';
import type { ComparativePlaybackMode } from '../../audio/StudentTrainerEngine';
import type { SessionProjectionSummary } from '../../audio/rodaResonanceAnalyzer';
import { useLanguage } from '../../i18n/LanguageContext';
import { Target, Drum, Wind, Bell, Headphones, Mic, Crown, Square, Download } from 'lucide-react';

interface StudentDiagnosticCardProps {
  result: StudentAnalysisResult;
  projectionSummary?: SessionProjectionSummary | null;
  isPlayingComparative: boolean;
  activeComparativeMode: ComparativePlaybackMode;
  onPlayComparative: (mode: ComparativePlaybackMode) => void;
  onStopComparative: () => void;
  onExport: () => void;
}

export const StudentDiagnosticCard: React.FC<StudentDiagnosticCardProps> = ({
  result,
  projectionSummary,
  isPlayingComparative,
  activeComparativeMode,
  onPlayComparative,
  onStopComparative,
  onExport,
}) => {
  const { t } = useLanguage();
  const centsText = Math.abs(result.avgCentsOffset) <= 10
    ? t('studentDiagCentered')
    : `${result.avgCentsOffset > 0 ? '+' : ''}${result.avgCentsOffset} cents`;
  const attackText = Math.abs(result.avgAttackDelayMs) <= 35
    ? t('studentDiagOnTime')
    : `${result.avgAttackDelayMs > 0 ? '+' : ''}${result.avgAttackDelayMs} ms`;

  const projPct = projectionSummary?.avgProjectionScorePct ?? 0;
  const projStatus = projectionSummary?.dominantStatus ?? 'timide';
  const projBadge = projStatus === 'roda_optimal'
    ? t('rodaBadgeOptimal')
    : projStatus === 'forcage'
    ? t('rodaBadgeForcage')
    : t('rodaBadgeTimide');

  return (
    <div className="cordel-card p-3 flex flex-col gap-3 rounded select-none">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="cordel-card-sm p-2.5 rounded flex items-center justify-between border-l-4 border-l-emerald-600">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono font-bold uppercase text-[var(--cordel-secondary-text)] flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-emerald-600" /><span>{t('studentDiagPitchTitle')}</span>
            </span>
            <span className="text-xs font-mono text-theme-ink/80 mt-0.5">{result.okNotes}/{result.totalNotes} • {centsText}</span>
          </div>
          <span className="text-lg font-mono font-black text-emerald-700 dark:text-emerald-400">{result.pitchAccuracyPct}%</span>
        </div>

        <div className="cordel-card-sm p-2.5 rounded flex items-center justify-between border-l-4 border-l-amber-600">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono font-bold uppercase text-[var(--cordel-secondary-text)] flex items-center gap-1">
              <Drum className="w-3.5 h-3.5 text-amber-600" /><span>{t('studentDiagAttackTitle')}</span>
            </span>
            <span className="text-xs font-mono text-theme-ink/80 mt-0.5">{attackText}</span>
          </div>
          <span className="text-lg font-mono font-black text-amber-700 dark:text-amber-400">{result.attackPrecisionPct}%</span>
        </div>

        <div className="cordel-card-sm p-2.5 rounded flex items-center justify-between border-l-4 border-l-sky-600">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono font-bold uppercase text-[var(--cordel-secondary-text)] flex items-center gap-1">
              <Wind className="w-3.5 h-3.5 text-sky-600" /><span>{t('studentDiagStabilityTitle')}</span>
            </span>
            <span className="text-xs font-mono text-theme-ink/80 mt-0.5">{t('studentDiagScoreGlobal', { score: result.accuracyScore })}</span>
          </div>
          <span className="text-lg font-mono font-black text-sky-700 dark:text-sky-400">{result.stabilityPct}%</span>
        </div>

        <div className="cordel-card-sm p-2.5 rounded flex items-center justify-between border-l-4 border-l-purple-600">
          <div className="flex flex-col">
            <span className="text-[10px] font-mono font-bold uppercase text-[var(--cordel-secondary-text)] flex items-center gap-1">
              <Bell className="w-3.5 h-3.5 text-purple-600" /><span>{t('studentDiagProjectionTitle')}</span>
            </span>
            <span className="text-xs font-mono text-theme-ink/80 mt-0.5">{projBadge}</span>
          </div>
          <span className="text-lg font-mono font-black text-purple-700 dark:text-purple-400">{projPct}%</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--cordel-border-sub)]">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['mix', 'student', 'mestre'] as ComparativePlaybackMode[]).map((m) => {
            const active = isPlayingComparative && activeComparativeMode === m;
            const Icon = m === 'mix' ? Headphones : m === 'student' ? Mic : Crown;
            const label = m === 'mix' ? t('studentListenMixBtn') : m === 'student' ? t('btn_listen_student_solo') : t('studentListenMestreBtn');
            return (
              <button
                key={m} type="button" onClick={() => (active ? onStopComparative() : onPlayComparative(m))}
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded flex items-center gap-1.5 cursor-pointer ${active ? 'bg-red-800 text-white animate-pulse' : 'cordel-btn'}`}
              >
                {active ? <Square className="w-3 h-3 fill-current" /> : <Icon className="w-3.5 h-3.5 text-theme-accent" />}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
        <button type="button" onClick={onExport} className="cordel-btn py-1 px-2.5 flex items-center gap-1 text-xs font-mono rounded cursor-pointer">
          <Download className="w-3.5 h-3.5" /><span>{t('export_student_report')}</span>
        </button>
      </div>
    </div>
  );
};
