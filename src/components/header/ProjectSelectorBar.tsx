/**
 * ProjectSelectorBar.tsx
 * Barre d'actions Cloud : MIDI, Sync Organizador (avec ✓ Synchronisé ! + alertAsync Cordel), Toadas Dropdown & Export (< 95 lignes).
 */
import React, { useState } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useOrganizadorAuth } from '../../hooks/useOrganizadorAuth';
import { useOrganizadorDeepLink } from '../../hooks/useOrganizadorDeepLink';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { useLanguage } from '../../i18n/LanguageContext';
import { syncProjectWithOrganizador } from '../../utils/toadaSyncService';
import { alertAsync } from '../../stores/useCordelDialogStore';
import { useActionFeedback } from '../common/useActionFeedback';
import { ToadaLibraryDropdown } from './ToadaLibraryDropdown';
import { SaveAndExportDropdown } from './SaveAndExportDropdown';
import { MidiConnectionBadge } from './MidiConnectionBadge';
import { OrganizadorToadaModal } from '../modals/OrganizadorToadaModal';
import { ToadaLexiconModal } from '../lexicon/ToadaLexiconModal';
import { BookOpen, RefreshCw, Check } from 'lucide-react';

export const ProjectSelectorBar: React.FC = () => {
  const { project, loadProject } = useToadaProject();
  const { currentUser, groupId, isLoading, loginWithGoogle } = useOrganizadorAuth();
  const viewRoleMode = useVocalTransportStore((s) => s.viewRoleMode);
  const { t, language } = useLanguage();
  const isBr = language === 'br';
  const [isOrganizadorOpen, setIsOrganizadorOpen] = useState(false);
  const [isLexiconOpen, setIsLexiconOpen] = useState(false);
  const syncFeedback = useActionFeedback(isBr ? '✓ Sincronizado !' : '✓ Synchronisé !');

  useOrganizadorDeepLink(groupId, isLoading);

  const handleSyncOrganizador = async () => {
    await syncFeedback.trigger(async () => {
      const res = await syncProjectWithOrganizador(project, groupId);
      if (res) {
        loadProject(res.updatedProject);
        const patCount = res.updatedProject.patterns.length;
        const syncBpm = res.updatedProject.bpm;
        const label = isBr ? '✓ Sincronizado !' : '✓ Synchronisé !';
        window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'success', message: res.toastMessage } }));
        await alertAsync({
          title: label,
          message: isBr
            ? `${patCount} padrões e tempo (${syncBpm} BPM) sincronizados desde o Organizador.`
            : `${patCount} patterns et tempo (${syncBpm} BPM) synchronisés depuis Organizador.`,
          variant: 'info',
        });
        return label;
      }
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'info', message: t('projectNotFoundInOrganizador') } }));
      throw new Error('not_found');
    }).catch(() => {});
  };

  const lexiconCount = project.toadaMeta?.notesLexique?.length || 0;

  return (
    <div className="flex items-center gap-2 flex-wrap relative z-40">
      <MidiConnectionBadge />
      <button
        type="button" onClick={() => setIsLexiconOpen(true)} title={t('lexiconBtnTitle')}
        className="h-9 px-2.5 cordel-card-sm text-xs font-mono font-bold flex items-center gap-1.5 hover:opacity-90 text-theme-ink transition-colors cursor-pointer"
      >
        <BookOpen className="w-3.5 h-3.5 text-[#8b2a1a] dark:text-[#f4a261]" />
        <span className="hidden sm:inline">{t('lexiconBtnLabel')}</span>
        {lexiconCount > 0 && <span className="px-1.5 py-0.2 text-[10px] bg-[var(--cordel-wood)] text-[var(--cordel-on-primary)] font-bold rounded">{lexiconCount}</span>}
      </button>

      {viewRoleMode !== 'eleve' && (
        <button
          type="button" onClick={handleSyncOrganizador} disabled={syncFeedback.isLoading} title={t('syncOrganizadorTitle')}
          className={syncFeedback.getButtonClass('h-9 px-2.5 cordel-card-sm text-xs font-mono font-bold flex items-center gap-1.5 hover:opacity-90 text-theme-ink transition-colors cursor-pointer')}
        >
          {syncFeedback.isSuccess ? (
            <Check className="w-3.5 h-3.5" />
          ) : (
            <RefreshCw className={`w-3.5 h-3.5 text-amber-600 dark:text-amber-400 ${syncFeedback.isLoading ? 'animate-spin' : ''}`} />
          )}
          <span className="hidden md:inline">
            {syncFeedback.isLoading ? (isBr ? 'Em curso...' : 'En cours...') : syncFeedback.isSuccess ? syncFeedback.successLabel : t('syncOrganizadorLabel')}
          </span>
        </button>
      )}

      <ToadaLibraryDropdown onOpenOrganizador={() => setIsOrganizadorOpen(true)} groupName={groupId || undefined} />
      {viewRoleMode !== 'eleve' && <SaveAndExportDropdown project={project} isUserLoggedIn={Boolean(currentUser)} onProjectUpdate={loadProject} />}

      {isOrganizadorOpen && (
        <OrganizadorToadaModal isOpen={isOrganizadorOpen} onClose={() => setIsOrganizadorOpen(false)} groupId={groupId} isUserLoggedIn={Boolean(currentUser)} onLogin={loginWithGoogle} />
      )}
      {isLexiconOpen && <ToadaLexiconModal isOpen={isLexiconOpen} onClose={() => setIsLexiconOpen(false)} />}
    </div>
  );
};
