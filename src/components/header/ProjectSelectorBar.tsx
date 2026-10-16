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

export const ProjectSelectorBar: React.FC = () => {
  const { project } = useToadaProject();
  const { currentUser, groupId, loginWithGoogle } = useOrganizadorAuth();
  const [isOrganizadorOpen, setIsOrganizadorOpen] = useState(false);

  // Prise en charge automatique des deep-links (?mode=eleve, ?toadaId=..., ?songId=...)
  useOrganizadorDeepLink(groupId);

  return (
    <div className="flex items-center gap-2 flex-wrap relative z-40">
      <MidiConnectionBadge />
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
    </div>
  );
};
