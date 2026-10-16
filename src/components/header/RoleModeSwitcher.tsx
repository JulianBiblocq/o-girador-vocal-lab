/**
 * RoleModeSwitcher.tsx
 * Commutateur Cordel de prévisualisation [ 🎙️ Studio | 🎓 Élève ] pour les utilisateurs autorisés.
 * Strictement < 150 lignes.
 */

import React from 'react';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { canAccessVocalStudio } from '../../utils/vocalPermissions';
import { useLanguage } from '../../i18n/LanguageContext';

export const RoleModeSwitcher: React.FC = () => {
  const { viewRoleMode, setViewRoleMode } = useVocalTransportStore();
  const { t } = useLanguage();

  if (!canAccessVocalStudio()) return null;

  return (
    <div className="h-9 cordel-card-sm inline-flex items-center p-0.5 text-xs font-mono select-none">
      <button
        type="button"
        onClick={() => setViewRoleMode('studio')}
        className={`h-full px-2.5 font-bold transition-all flex items-center gap-1 cursor-pointer ${
          viewRoleMode === 'studio'
            ? 'bg-theme-wood text-[#f4ecd8] font-black shadow-sm'
            : 'opacity-60 hover:opacity-100 text-theme-ink'
        }`}
        title={t('roleStudio')}
      >
        <span>🎙️</span>
        <span className="hidden sm:inline">{t('roleStudio')}</span>
      </button>
      <button
        type="button"
        onClick={() => setViewRoleMode('eleve')}
        className={`h-full px-2.5 font-bold transition-all flex items-center gap-1 cursor-pointer ${
          viewRoleMode === 'eleve'
            ? 'bg-theme-wood text-[#f4ecd8] font-black shadow-sm'
            : 'opacity-60 hover:opacity-100 text-theme-ink'
        }`}
        title={t('roleEleve')}
      >
        <span>🎓</span>
        <span className="hidden sm:inline">{t('roleEleve')}</span>
      </button>
    </div>
  );
};
