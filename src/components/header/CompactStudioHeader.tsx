/**
 * CompactStudioHeader.tsx
 * En-tête compact 1 ligne Studio (3 poinçons + Sync) et En-tête Dédié Élève épuré (< 125 lignes).
 */
import React, { useState } from 'react';
import { Sun, Moon, Headphones, ArrowLeft, BookOpen, Compass } from 'lucide-react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useOrganizadorAuth } from '../../hooks/useOrganizadorAuth';
import { useOrganizadorDeepLink } from '../../hooks/useOrganizadorDeepLink';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { canAccessVocalStudio } from '../../utils/vocalPermissions';
import { useLanguage } from '../../i18n/LanguageContext';
import { BrandHeaderLogo } from './BrandHeaderLogo';
import { ToadaLibraryDropdown } from './ToadaLibraryDropdown';
import { BpmStampPopover } from './BpmStampPopover';
import { TonalityStampPopover } from './TonalityStampPopover';
import { HardwareStampPopover } from './HardwareStampPopover';
import { SyncAndExportDropdown } from './SyncAndExportDropdown';
import { UserAvatarMenu } from './UserAvatarMenu';
import { PwaInstallButton } from './PwaInstallButton';
import { OrganizadorToadaModal } from '../modals/OrganizadorToadaModal';
import { ToadaLexiconModal } from '../lexicon/ToadaLexiconModal';

interface Props {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  isInstalled: boolean;
  onTriggerInstall: () => void;
}

export const CompactStudioHeader: React.FC<Props> = ({
  theme, onToggleTheme, isInstalled, onTriggerInstall,
}) => {
  const { project, loadProject } = useToadaProject();
  const { currentUser, groupId, isLoading, loginWithGoogle } = useOrganizadorAuth();
  const viewRoleMode = useVocalTransportStore((s) => s.viewRoleMode);
  const userPermissions = useVocalTransportStore((s) => s.userPermissions);
  const canAccessStudio = canAccessVocalStudio(userPermissions);
  const activeLivret = useVocalTransportStore((s) => s.activeLivret);
  const setActiveLivret = useVocalTransportStore((s) => s.setActiveLivret);
  const setViewRoleMode = useVocalTransportStore((s) => s.setViewRoleMode);
  const { locale, setLocale, t } = useLanguage();
  const [isOrganizadorOpen, setIsOrganizadorOpen] = useState(false);
  const [isLexiconOpen, setIsLexiconOpen] = useState(false);

  useOrganizadorDeepLink(groupId, isLoading);
  const isEleve = viewRoleMode === 'eleve';
  const lexCount = project.toadaMeta?.notesLexique?.length || 0;

  return (
    <header className="relative z-40 w-full cordel-card px-4 py-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 flex-wrap">
        <BrandHeaderLogo />
        <ToadaLibraryDropdown onOpenOrganizador={() => setIsOrganizadorOpen(true)} groupName={groupId || undefined} />
      </div>

      {!isEleve && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <BpmStampPopover />
          <TonalityStampPopover />
          <HardwareStampPopover />
          <button
            type="button"
            onClick={() => useVocalTransportStore.getState().setDictationModalOpen(true)}
            title={t('dialOpenDictationTitle')}
            className="h-8 px-2.5 cordel-card-sm text-xs font-mono font-bold inline-flex items-center gap-1.5 cursor-pointer hover:border-amber-500/60"
          >
            <Compass className="w-3.5 h-3.5 text-[#9a3412] dark:text-amber-300" />
            <span className="hidden lg:inline">{t('dialOpenDictationBtn')}</span>
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {isEleve ? (
          <>
            {lexCount > 0 && (
              <button type="button" onClick={() => setIsLexiconOpen(true)} title={t('lexiconBtnTitle')} className="h-8 px-2.5 cordel-card-sm text-xs font-mono font-bold inline-flex items-center gap-1.5 cursor-pointer">
                <BookOpen className="w-3.5 h-3.5 text-theme-accent" />
                <span className="hidden sm:inline">{t('lexiconBtnLabel')}</span>
                <span className="px-1 text-[10px] bg-theme-wood text-[var(--cordel-on-primary)] rounded">{lexCount}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveLivret(activeLivret === 'reglages' ? 'treino' : 'reglages')}
              className={`h-8 px-2.5 text-xs font-mono font-bold inline-flex items-center gap-1.5 rounded cursor-pointer transition-colors ${activeLivret === 'reglages' ? 'cordel-btn-primary' : 'cordel-card-sm hover:border-amber-500/60'}`}
            >
              <Headphones className="w-3.5 h-3.5 text-current" />
              <span>{t('btnStudentMicHeadphones')}</span>
            </button>
            {canAccessStudio && (
              <button
                type="button"
                onClick={() => setViewRoleMode('studio')}
                className="h-8 px-2.5 rounded bg-[#9a3412] text-[#f4ecd8] border border-[var(--cordel-border)] text-xs font-mono font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t('btnBackToStudio')}</span>
              </button>
            )}
          </>
        ) : (
          <SyncAndExportDropdown project={project} groupId={groupId} isUserLoggedIn={Boolean(currentUser)} onProjectUpdate={loadProject} onOpenLexicon={() => setIsLexiconOpen(true)} />
        )}

        <PwaInstallButton isInstalled={isInstalled} onInstall={onTriggerInstall} />

        <div className="h-8 cordel-card-sm inline-flex items-center p-0.5 text-[11px] font-mono select-none">
          <button type="button" onClick={() => setLocale('fr')} className={`h-full px-2 font-bold flex items-center justify-center cursor-pointer rounded ${locale === 'fr' ? 'bg-theme-wood text-[var(--cordel-on-primary)]' : 'opacity-65 hover:opacity-100'}`}>FR</button>
          <button type="button" onClick={() => setLocale('br')} className={`h-full px-2 font-bold flex items-center justify-center cursor-pointer rounded ${locale === 'br' ? 'bg-theme-wood text-[var(--cordel-on-primary)]' : 'opacity-65 hover:opacity-100'}`}>BR</button>
        </div>

        <button type="button" onClick={onToggleTheme} className="h-8 w-8 cordel-card-sm inline-flex items-center justify-center cursor-pointer" title={t('themeToggle')}>
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-theme-accent" /> : <Moon className="w-3.5 h-3.5 text-theme-accent" />}
        </button>

        <UserAvatarMenu isInstalled={isInstalled} onInstall={onTriggerInstall} />
      </div>

      {isOrganizadorOpen && <OrganizadorToadaModal isOpen={isOrganizadorOpen} onClose={() => setIsOrganizadorOpen(false)} groupId={groupId} isUserLoggedIn={Boolean(currentUser)} onLogin={loginWithGoogle} />}
      {isLexiconOpen && <ToadaLexiconModal isOpen={isLexiconOpen} onClose={() => setIsLexiconOpen(false)} />}
    </header>
  );
};
