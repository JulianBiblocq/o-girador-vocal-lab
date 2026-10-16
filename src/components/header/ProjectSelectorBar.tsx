/**
 * ProjectSelectorBar.tsx
 * Barre d'actions supérieure Cloud : Auth, Mes Toadas, Fiches Organizador & Pont Sequenciador (< 125 lignes).
 */
import React, { useState } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { useOrganizadorAuth } from '../../hooks/useOrganizadorAuth';
import { useOrganizadorDeepLink } from '../../hooks/useOrganizadorDeepLink';
import { publishToadaToSequencer } from '../../services/cloudToadaPublisher';
import { confirmAsync } from '../../stores/useCordelDialogStore';
import { AuthUserButton } from './AuthUserButton';
import { ToadaLibraryDropdown } from './ToadaLibraryDropdown';
import { MidiConnectionBadge } from './MidiConnectionBadge';
import { OrganizadorToadaModal } from '../modals/OrganizadorToadaModal';
import { Scroll, CloudUpload, Loader2, ExternalLink } from 'lucide-react';

export const ProjectSelectorBar: React.FC = () => {
  const { project } = useToadaProject();
  const { t } = useLanguage();
  const viewRoleMode = useVocalTransportStore((s) => s.viewRoleMode);
  const { currentUser, groupId, isLoading: isAuthLoading, loginWithGoogle, logout } = useOrganizadorAuth();

  // Prise en charge automatique des deep-links (?mode=eleve, ?toadaId=..., ?songId=...)
  useOrganizadorDeepLink(groupId);

  const [isOrganizadorOpen, setIsOrganizadorOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const res = await publishToadaToSequencer(project);
      setPublishedUrl(res.sequenciadorUrl);
      const openNow = await confirmAsync({
        title: t('toadaPublishedSuccess'),
        message: `${project.title} a été synchronisée dans le Cloud. Souhaitez-vous l'ouvrir immédiatement dans Sequenciador ?`,
        confirmLabel: t('openInSequencer'),
        cancelLabel: t('dialogCancel'),
      });
      if (openNow) window.open(res.sequenciadorUrl, '_blank');
    } catch (err: any) {
      console.error('[ProjectSelectorBar] Échec publication :', err);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'error', message: `Échec publication : ${err?.message || 'erreur'}` } }));
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <AuthUserButton
        currentUser={currentUser}
        isLoading={isAuthLoading}
        onLogin={loginWithGoogle}
        onLogout={logout}
      />
      <MidiConnectionBadge />
      <ToadaLibraryDropdown />

      {viewRoleMode !== 'eleve' && (
        <>
          <button
            type="button"
            onClick={() => setIsOrganizadorOpen(true)}
            title={t('fichesOrganizador')}
            className="h-9 px-3 cordel-card-sm text-xs font-mono font-bold flex items-center gap-1.5 bg-black/40 hover:bg-black/60 text-theme-ink transition-colors cursor-pointer"
          >
            <Scroll className="w-4 h-4 text-[var(--cordel-accent-text)]" />
            <span className="hidden md:inline">{t('fichesOrganizador')}</span>
          </button>

          <button
            type="button"
            disabled={isPublishing}
            onClick={handlePublish}
            title={t('sendToSequencerTooltip')}
            className="h-9 px-3 cordel-card-sm text-xs font-mono font-bold flex items-center gap-1.5 bg-theme-wood hover:bg-theme-wood/90 text-[#f4ecd8] transition-colors cursor-pointer disabled:opacity-50"
          >
            {isPublishing ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#f4ecd8]" />
            ) : (
              <CloudUpload className="w-4 h-4 text-[#f4ecd8]" />
            )}
            <span className="hidden md:inline">
              {isPublishing ? t('toadaPublishing') : t('sendToSequencer')}
            </span>
          </button>

          {publishedUrl && (
            <button
              type="button"
              onClick={() => window.open(publishedUrl, '_blank')}
              title={t('openInSequencer')}
              className="h-9 px-2.5 cordel-card-sm text-xs font-mono font-bold flex items-center gap-1 bg-amber-600/30 text-amber-300 border border-amber-500/50 hover:bg-amber-600/50 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{t('openInSequencer')}</span>
            </button>
          )}
        </>
      )}

      {isOrganizadorOpen && (
        <OrganizadorToadaModal
          isOpen={isOrganizadorOpen}
          onClose={() => setIsOrganizadorOpen(false)}
          groupId={groupId}
          isUserLoggedIn={Boolean(currentUser)}
          onLogin={loginWithGoogle}
        />
      )}
    </div>
  );
};
