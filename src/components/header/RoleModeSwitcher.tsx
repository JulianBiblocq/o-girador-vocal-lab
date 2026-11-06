/**
 * RoleModeSwitcher.tsx
 * Commutateur Cordel de prévisualisation [ Studio | Élève ] pour les utilisateurs autorisés.
 * Strictement < 150 lignes.
 */

import React from 'react';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { canAccessVocalStudio } from '../../utils/vocalPermissions';
import { useLanguage } from '../../i18n/LanguageContext';
import { Mic, GraduationCap } from 'lucide-react';

export const RoleModeSwitcher: React.FC = () => {
  const viewRoleMode = useVocalTransportStore((s) => s.viewRoleMode);
  const setViewRoleMode = useVocalTransportStore((s) => s.setViewRoleMode);
  const { t } = useLanguage();

  if (!canAccessVocalStudio()) return null;

  return (
    <div className="h-9 cordel-card-sm inline-flex items-center p-0.5 text-xs font-mono select-none">
      <button
        type="button"
        onClick={() => setViewRoleMode('studio')}
        className={`h-full px-2.5 font-bold transition-all flex items-center gap-1 cursor-pointer rounded ${
          viewRoleMode === 'studio'
            ? 'bg-theme-wood text-[var(--cordel-on-primary)] font-black shadow-sm'
            : 'opacity-60 hover:opacity-100 text-theme-ink'
        }`}
        title={t('roleStudio')}
      >
        <Mic className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t('roleStudio')}</span>
      </button>
      <button
        type="button"
        onClick={() => setViewRoleMode('eleve')}
        className={`h-full px-2.5 font-bold transition-all flex items-center gap-1 cursor-pointer rounded ${
          viewRoleMode === 'eleve'
            ? 'bg-theme-wood text-[var(--cordel-on-primary)] font-black shadow-sm'
            : 'opacity-60 hover:opacity-100 text-theme-ink'
        }`}
        title={t('roleEleve')}
      >
        <GraduationCap className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t('roleEleve')}</span>
      </button>
    </div>
  );
};
