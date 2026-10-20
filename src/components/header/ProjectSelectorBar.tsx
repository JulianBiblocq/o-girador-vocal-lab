/**
 * ProjectSelectorBar.tsx
 * Barre d'actions Cloud allégée : MIDI, Toadas Dropdown & Sauvegarder/Exporter Dropdown (< 75 lignes).
 */
import React, { useState } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useOrganizadorAuth } from '../../hooks/useOrganizadorAuth';
import { useOrganizadorDeepLink } from '../../hooks/useOrganizadorDeepLink';
import { ToadaLibraryDropdown } from './ToadaLibraryDropdown';
import { SaveAndExportDropdown } from './SaveAndExportDropdown';
import { MidiConnectionBadge } from './MidiConnectionBadge';
import { OrganizadorToadaModal } from '../modals/OrganizadorToadaModal';
import { ToadaLexiconModal } from '../lexicon/ToadaLexiconModal';
import { BookOpen } from 'lucide-react';

export const ProjectSelectorBar: React.FC = () => {
  const { project } = useToadaProject();
  const { currentUser, groupId, loginWithGoogle } = useOrganizadorAuth();
  const [isOrganizadorOpen, setIsOrganizadorOpen] = useState(false);
  const [isLexiconOpen, setIsLexiconOpen] = useState(false);

  // Prise en charge automatique des deep-links (?mode=eleve, ?toadaId=..., ?songId=...)
  useOrganizadorDeepLink(groupId);

  const lexiconCount = project.toadaMeta?.notesLexique?.length || 0;

  return (
    <div className="flex items-center gap-2 flex-wrap relative z-40">
      <MidiConnectionBadge />
      <button
        type="button"
        onClick={() => setIsLexiconOpen(true)}
        title="Dictionnaire & Quiz Portugais-Français (Organizador)"
        className="h-9 px-2.5 cordel-card-sm text-xs font-mono font-bold flex items-center gap-1.5 hover:opacity-90 text-theme-ink transition-colors cursor-pointer"
      >
        <BookOpen className="w-3.5 h-3.5 text-[#8b2a1a] dark:text-[#f4a261]" />
        <span className="hidden sm:inline">Lexique PT-FR</span>
        {lexiconCount > 0 && (
          <span className="px-1.5 py-0.2 text-[10px] bg-[var(--cordel-wood)] text-[var(--cordel-on-primary)] font-bold rounded">
            {lexiconCount}
          </span>
        )}
      </button>
      <ToadaLibraryDropdown
        onOpenOrganizador={() => setIsOrganizadorOpen(true)}
        groupName={groupId || undefined}
      />
      <SaveAndExportDropdown
        project={project}
        isUserLoggedIn={Boolean(currentUser)}
      />

      {isOrganizadorOpen && (
        <OrganizadorToadaModal
          isOpen={isOrganizadorOpen}
          onClose={() => setIsOrganizadorOpen(false)}
          groupId={groupId}
          isUserLoggedIn={Boolean(currentUser)}
          onLogin={loginWithGoogle}
        />
      )}

      {isLexiconOpen && (
        <ToadaLexiconModal
          isOpen={isLexiconOpen}
          onClose={() => setIsLexiconOpen(false)}
        />
      )}
    </div>
  );
};
