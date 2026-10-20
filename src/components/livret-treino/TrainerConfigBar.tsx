/**
 * TrainerConfigBar.tsx
 * Barre de configuration sur 1 seule ligne Desktop :
 * Parcours (Motif / Toada), Role de l'eleve (Puxador / Coro / Tout), Soutien au casque & Vitesse.
 */
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

export type TrainerScope = 'pattern' | 'toada';
export type StudentRole = 'coro' | 'puxador' | 'all';
export type TrainerGuideMode = 'accompanied' | 'voice_only' | 'autonomous';

interface TrainerConfigBarProps {
  scope: TrainerScope;
  onScopeChange: (scope: TrainerScope) => void;
  studentRole: StudentRole;
  onStudentRoleChange: (role: StudentRole) => void;
  guideMode: TrainerGuideMode;
  onGuideModeChange: (mode: TrainerGuideMode) => void;
  speedRatio: number;
  onSpeedRatioChange: (ratio: number) => void;
  disabled?: boolean;
}

export const TrainerConfigBar: React.FC<TrainerConfigBarProps> = ({
  scope, onScopeChange, studentRole, onStudentRoleChange,
  guideMode, onGuideModeChange, speedRatio, onSpeedRatioChange, disabled
}) => {
  const { t } = useLanguage();

  return (
    <div className="cordel-card p-2.5 w-full flex flex-wrap items-center justify-between gap-2.5 select-none">
      {/* 1. Parcours */}
      <div className="flex items-center gap-1.5 text-xs font-mono">
        <span className="text-[10px] text-theme-ink/60 uppercase font-bold">Parcours:</span>
        <button
          type="button" disabled={disabled} onClick={() => onScopeChange('pattern')}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            scope === 'pattern' ? 'cordel-btn-primary' : 'cordel-btn opacity-70 hover:opacity-100'
          }`}
        >
          {t('trainer_scope_pattern')}
        </button>
        <button
          type="button" disabled={disabled} onClick={() => onScopeChange('toada')}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            scope === 'toada' ? 'cordel-btn-primary' : 'cordel-btn opacity-70 hover:opacity-100'
          }`}
        >
          {t('trainer_scope_toada')}
        </button>
      </div>

      {/* 2. Role eleve */}
      <div className="flex items-center gap-1.5 text-xs font-mono">
        <span className="text-[10px] text-theme-ink/60 uppercase font-bold">Role:</span>
        <button
          type="button" disabled={disabled} onClick={() => onStudentRoleChange('coro')}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            studentRole === 'coro' ? 'bg-role-coro text-[#f4ecd8] font-black shadow-sm' : 'cordel-btn opacity-70 hover:opacity-100'
          }`}
        >
          {t('trainer_role_coro')}
        </button>
        <button
          type="button" disabled={disabled} onClick={() => onStudentRoleChange('puxador')}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            studentRole === 'puxador' ? 'bg-role-puxador text-[#f4ecd8] font-black shadow-sm' : 'cordel-btn opacity-70 hover:opacity-100'
          }`}
        >
          {t('trainer_role_puxador')}
        </button>
        <button
          type="button" disabled={disabled} onClick={() => onStudentRoleChange('all')}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            studentRole === 'all' ? 'cordel-btn-primary' : 'cordel-btn opacity-70 hover:opacity-100'
          }`}
        >
          {t('trainer_role_all')}
        </button>
      </div>

      {/* 3. Soutien au casque */}
      <div className="flex items-center gap-1.5 text-xs font-mono">
        <span className="text-[10px] text-theme-ink/60 uppercase font-bold">Casque:</span>
        <button
          type="button" disabled={disabled} onClick={() => onGuideModeChange('accompanied')}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            guideMode === 'accompanied' ? 'cordel-btn-primary' : 'cordel-btn opacity-70 hover:opacity-100'
          }`}
        >
          {t('trainer_guide_accompanied')}
        </button>
        <button
          type="button" disabled={disabled} onClick={() => onGuideModeChange('voice_only')}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            guideMode === 'voice_only' ? 'cordel-btn-primary' : 'cordel-btn opacity-70 hover:opacity-100'
          }`}
        >
          {t('trainer_guide_voice_only')}
        </button>
        <button
          type="button" disabled={disabled} onClick={() => onGuideModeChange('autonomous')}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            guideMode === 'autonomous' ? 'bg-[#9a3412] text-[#f4ecd8] border border-[#9a3412] font-black shadow-sm' : 'cordel-btn opacity-70 hover:opacity-100'
          }`}
          title="La partie que vous devez chanter est mise en sourdine pour chanter seul !"
        >
          {t('trainer_guide_autonomous')}
        </button>
      </div>

      {/* 4. Vitesse d'etude */}
      <div className="flex items-center gap-1 text-xs font-mono">
        <button
          type="button" disabled={disabled} onClick={() => onSpeedRatioChange(1.0)}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            speedRatio === 1.0 ? 'cordel-btn-primary' : 'cordel-btn opacity-70 hover:opacity-100'
          }`}
        >
          {t('trainer_speed_nominal')}
        </button>
        <button
          type="button" disabled={disabled} onClick={() => onSpeedRatioChange(0.74)}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            speedRatio === 0.74 ? 'cordel-btn-primary' : 'cordel-btn opacity-70 hover:opacity-100'
          }`}
        >
          {t('trainer_speed_slow')}
        </button>
      </div>
    </div>
  );
};
