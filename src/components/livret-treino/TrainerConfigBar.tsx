/**
 * TrainerConfigBar.tsx
 * Barre de configuration du Studio Élève 2.0 : Sélecteur de Motif (avec badges ⭐/👑), Parcours, Rôle, Guide Casque, Paliers Progressifs (75➔88➔100%) (< 130 lignes).
 */
import React from 'react';
import { Repeat, Trophy } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { PatternSpeedMastery } from '../../utils/progressiveSpeedMastery';

export type TrainerScope = 'pattern' | 'toada';
export type StudentRole = 'coro' | 'puxador' | 'all';
export type TrainerGuideMode = 'accompanied' | 'voice_only' | 'autonomous';

export interface TrainerPatternOption {
  id: string;
  name: string;
  role: string;
  badge: string;
}

interface TrainerConfigBarProps {
  scope: TrainerScope; onScopeChange: (scope: TrainerScope) => void;
  studentRole: StudentRole; onStudentRoleChange: (role: StudentRole) => void;
  guideMode: TrainerGuideMode; onGuideModeChange: (mode: TrainerGuideMode) => void;
  speedRatio: number; onSpeedRatioChange: (ratio: number) => void;
  loopEnabled?: boolean; onToggleLoop?: () => void;
  autoProgressionEnabled?: boolean; onToggleAutoProgression?: () => void;
  patternMastery?: PatternSpeedMastery; masteredPatternsCount?: number; totalPatternsCount?: number;
  patternOptions?: TrainerPatternOption[]; activePatternId?: string; onSelectPattern?: (id: string) => void;
  disabled?: boolean;
}

export const TrainerConfigBar: React.FC<TrainerConfigBarProps> = ({
  scope, onScopeChange, studentRole, onStudentRoleChange,
  guideMode, onGuideModeChange, speedRatio, onSpeedRatioChange,
  loopEnabled = false, onToggleLoop, autoProgressionEnabled = true, onToggleAutoProgression,
  patternMastery, masteredPatternsCount = 0, totalPatternsCount = 1,
  patternOptions, activePatternId, onSelectPattern, disabled,
}) => {
  const { t } = useLanguage();
  const speedTiers = [
    { ratio: 0.75, label: t('speedTier75Label'), badge: patternMastery?.tier75 ? '✓' : '' },
    { ratio: 0.88, label: t('speedTier88Label'), badge: patternMastery?.tier88 ? '✓' : '' },
    { ratio: 1.0, label: t('speedTier100Label'), badge: patternMastery?.tier100 ? '★' : '' },
  ];

  return (
    <div className="cordel-card p-2.5 w-full flex flex-col gap-2 select-none">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-mono flex-wrap">
          {patternOptions && patternOptions.length > 0 && onSelectPattern && (
            <select
              disabled={disabled} value={activePatternId}
              onChange={(e) => onSelectPattern(e.target.value)}
              className="cordel-input px-2 py-1 text-[11px] font-bold rounded cursor-pointer"
            >
              {patternOptions.map((po) => (
                <option key={po.id} value={po.id}>
                  {po.badge ? `${po.badge} ` : ''}[{po.role.toUpperCase()}] {po.name}
                </option>
              ))}
            </select>
          )}
          {(['pattern', 'toada'] as TrainerScope[]).map((sc) => (
            <button
              key={sc} type="button" disabled={disabled} onClick={() => onScopeChange(sc)}
              className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${scope === sc ? 'cordel-btn-primary' : 'cordel-btn opacity-75 hover:opacity-100'}`}
            >{sc === 'pattern' ? t('trainer_scope_pattern') : t('trainer_scope_toada')}</button>
          ))}
        </div>

        <div className="flex items-center gap-1 text-xs font-mono">
          <button
            type="button" disabled={disabled} onClick={() => onStudentRoleChange('coro')}
            className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${studentRole === 'coro' ? 'bg-role-coro text-[#f4ecd8] font-black shadow-sm' : 'cordel-btn opacity-75 hover:opacity-100'}`}
          >{t('trainer_role_coro')}</button>
          <button
            type="button" disabled={disabled} onClick={() => onStudentRoleChange('puxador')}
            className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${studentRole === 'puxador' ? 'bg-role-puxador text-[#f4ecd8] font-black shadow-sm' : 'cordel-btn opacity-75 hover:opacity-100'}`}
          >{t('trainer_role_puxador')}</button>
          <button
            type="button" disabled={disabled} onClick={() => onStudentRoleChange('all')}
            className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${studentRole === 'all' ? 'cordel-btn-primary' : 'cordel-btn opacity-75 hover:opacity-100'}`}
          >{t('trainer_role_all')}</button>
        </div>

        <div className="flex items-center gap-1 text-xs font-mono">
          {(['accompanied', 'voice_only', 'autonomous'] as TrainerGuideMode[]).map((gm) => (
            <button
              key={gm} type="button" disabled={disabled} onClick={() => onGuideModeChange(gm)}
              className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
                guideMode === gm
                  ? gm === 'autonomous' ? 'bg-[#9a3412] text-[#f4ecd8] border border-[#9a3412] font-black shadow-sm' : 'cordel-btn-primary'
                  : 'cordel-btn opacity-75 hover:opacity-100'
              }`}
            >{gm === 'accompanied' ? t('trainer_guide_accompanied') : gm === 'voice_only' ? t('trainer_guide_voice_only') : t('trainer_guide_autonomous')}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[var(--cordel-border-sub)] text-xs font-mono">
        <div className="flex flex-wrap items-center gap-1">
          {speedTiers.map(({ ratio, label, badge }) => (
            <button
              key={ratio} type="button" disabled={disabled} onClick={() => onSpeedRatioChange(ratio)}
              className={`px-2 py-1 text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer ${Math.abs(speedRatio - ratio) < 0.03 ? 'cordel-btn-primary' : 'cordel-btn opacity-80 hover:opacity-100'}`}
            ><span>{label}</span>{badge && <span>{badge}</span>}</button>
          ))}
          {onToggleAutoProgression && (
            <button
              type="button" disabled={disabled} onClick={onToggleAutoProgression}
              className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${autoProgressionEnabled ? 'bg-emerald-700 text-white font-black' : 'cordel-btn opacity-75 hover:opacity-100'}`}
            >{t('autoProgressionToggleBtn')}</button>
          )}
          {onToggleLoop && (
            <button
              type="button" disabled={disabled} onClick={onToggleLoop}
              className={`px-2 py-1 text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer ${loopEnabled ? 'bg-amber-600 text-white font-black' : 'cordel-btn opacity-75 hover:opacity-100'}`}
              title={t('trainerLoopBtn')}
            ><Repeat className="w-3.5 h-3.5" /><span>{t('trainerLoopBtn')}</span></button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {patternMastery?.tier100 && (
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/40 font-bold text-[11px]">{t('patternMasteredCrownBadge')}</span>
          )}
          <span className="px-2 py-0.5 rounded bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] font-bold text-[11px] flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>{t('toadaMasteryProgressLabel', { mastered: masteredPatternsCount, total: totalPatternsCount })}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
