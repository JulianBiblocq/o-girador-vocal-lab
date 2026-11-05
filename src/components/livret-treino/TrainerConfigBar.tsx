/**
 * TrainerConfigBar.tsx
 * Barre de configuration du Studio Élève 2.0 : Parcours (Motif / Appel-Réponse), Rôle, Guide Casque, Vitesse (100/85/75%) & Boucle 🔁 (< 120 lignes).
 */
import React from 'react';
import { Repeat } from 'lucide-react';
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
  loopEnabled?: boolean;
  onToggleLoop?: () => void;
  disabled?: boolean;
}

export const TrainerConfigBar: React.FC<TrainerConfigBarProps> = ({
  scope, onScopeChange, studentRole, onStudentRoleChange,
  guideMode, onGuideModeChange, speedRatio, onSpeedRatioChange,
  loopEnabled = false, onToggleLoop, disabled,
}) => {
  const { t } = useLanguage();

  return (
    <div className="cordel-card p-2.5 w-full flex flex-wrap items-center justify-between gap-2 select-none">
      {/* 1. Parcours */}
      <div className="flex items-center gap-1 text-xs font-mono">
        <button
          type="button" disabled={disabled} onClick={() => onScopeChange('pattern')}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            scope === 'pattern' ? 'cordel-btn-primary' : 'cordel-btn opacity-75 hover:opacity-100'
          }`}
        >
          {t('trainer_scope_pattern')}
        </button>
        <button
          type="button" disabled={disabled} onClick={() => onScopeChange('toada')}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            scope === 'toada' ? 'cordel-btn-primary' : 'cordel-btn opacity-75 hover:opacity-100'
          }`}
        >
          {t('trainer_scope_toada')}
        </button>
      </div>

      {/* 2. Role eleve */}
      <div className="flex items-center gap-1 text-xs font-mono">
        <button
          type="button" disabled={disabled} onClick={() => onStudentRoleChange('coro')}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            studentRole === 'coro' ? 'bg-role-coro text-[#f4ecd8] font-black shadow-sm' : 'cordel-btn opacity-75 hover:opacity-100'
          }`}
        >
          {t('trainer_role_coro')}
        </button>
        <button
          type="button" disabled={disabled} onClick={() => onStudentRoleChange('puxador')}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            studentRole === 'puxador' ? 'bg-role-puxador text-[#f4ecd8] font-black shadow-sm' : 'cordel-btn opacity-75 hover:opacity-100'
          }`}
        >
          {t('trainer_role_puxador')}
        </button>
        <button
          type="button" disabled={disabled} onClick={() => onStudentRoleChange('all')}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            studentRole === 'all' ? 'cordel-btn-primary' : 'cordel-btn opacity-75 hover:opacity-100'
          }`}
        >
          {t('trainer_role_all')}
        </button>
      </div>

      {/* 3. Soutien au casque (3 modes) */}
      <div className="flex items-center gap-1 text-xs font-mono">
        <button
          type="button" disabled={disabled} onClick={() => onGuideModeChange('accompanied')}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            guideMode === 'accompanied' ? 'cordel-btn-primary' : 'cordel-btn opacity-75 hover:opacity-100'
          }`}
        >
          {t('trainer_guide_accompanied')}
        </button>
        <button
          type="button" disabled={disabled} onClick={() => onGuideModeChange('voice_only')}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            guideMode === 'voice_only' ? 'cordel-btn-primary' : 'cordel-btn opacity-75 hover:opacity-100'
          }`}
        >
          {t('trainer_guide_voice_only')}
        </button>
        <button
          type="button" disabled={disabled} onClick={() => onGuideModeChange('autonomous')}
          className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
            guideMode === 'autonomous' ? 'bg-[#9a3412] text-[#f4ecd8] border border-[#9a3412] font-black shadow-sm' : 'cordel-btn opacity-75 hover:opacity-100'
          }`}
        >
          {t('trainer_guide_autonomous')}
        </button>
      </div>

      {/* 4. Vitesse (100% / 85% / 75% hauteur constante) & Boucle 🔁 */}
      <div className="flex items-center gap-1 text-xs font-mono">
        {[1.0, 0.85, 0.75].map((spd) => (
          <button
            key={spd} type="button" disabled={disabled} onClick={() => onSpeedRatioChange(spd)}
            className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer ${
              Math.abs(speedRatio - spd) < 0.02 ? 'cordel-btn-primary' : 'cordel-btn opacity-75 hover:opacity-100'
            }`}
          >
            {Math.round(spd * 100)}%
          </button>
        ))}
        {onToggleLoop && (
          <button
            type="button" disabled={disabled} onClick={onToggleLoop}
            className={`px-2 py-1 text-[11px] font-bold rounded flex items-center gap-1 cursor-pointer ${
              loopEnabled ? 'bg-amber-600 text-white font-black' : 'cordel-btn opacity-75 hover:opacity-100'
            }`}
            title={t('trainerLoopBtn')}
          >
            <Repeat className="w-3.5 h-3.5" /><span>{t('trainerLoopBtn')}</span>
          </button>
        )}
      </div>
    </div>
  );
};
