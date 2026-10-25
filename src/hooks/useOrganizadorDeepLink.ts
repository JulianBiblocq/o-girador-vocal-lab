/**
 * useOrganizadorDeepLink.ts
 * Prise en charge des paramètres d'URL d'Organizador & Sequenciador (< 110 lignes) :
 * ?mode=eleve, ?toadaId=..., ?songId=...
 */
import { useEffect, useRef } from 'react';
import { useToadaProject } from '../context/ToadaProjectContext';
import { useVocalTransportStore } from '../stores/useVocalTransportStore';
import { fetchToadaPackById, fetchOrganizadorToadaById } from '../services/firebaseClient';
import { parseToadaDocument } from '../utils/toadaSheetParser';
import { generateToadaFromSheet } from '../utils/toadaConductorGenerator';

export function useOrganizadorDeepLink(groupId: string | null) {
  const { project, loadProject } = useToadaProject();
  const hasExecutedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || hasExecutedRef.current) return;
    hasExecutedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const toadaId = params.get('toadaId') || params.get('loadToadaId');
    const songId = params.get('songId');

    if (!mode && !toadaId && !songId) return;

    // Nettoyage de l'URL pour éviter les re-chargements involontaires au refresh
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('mode');
    cleanUrl.searchParams.delete('toadaId');
    cleanUrl.searchParams.delete('loadToadaId');
    cleanUrl.searchParams.delete('songId');
    window.history.replaceState({}, document.title, cleanUrl.pathname + (cleanUrl.search ? cleanUrl.search : '') + cleanUrl.hash);

    // 1. Bascule de rôle & sous-onglet Livret 3
    if (mode === 'eleve') {
      const transport = useVocalTransportStore.getState();
      transport.setViewRoleMode('eleve');
      transport.setActiveLivret('treino');
      transport.setTreinoSubTab(toadaId || songId ? 'chanter_toada' : 'ambitus');
    }

    // 2. Chargement de la Toada ou de la Fiche de Paroles
    const executeLoad = async () => {
      if (toadaId) {
        try {
          const pack = await fetchToadaPackById(toadaId);
          if (pack) {
            loadProject(pack);
            window.dispatchEvent(
              new CustomEvent('app-toast', {
                detail: { type: 'success', message: `Toada « ${pack.title} » chargée depuis le Cloud !` },
              })
            );
            return;
          }
        } catch (err) {
          console.warn('[useOrganizadorDeepLink] Échec chargement toada pack :', err);
        }
      }

      if (songId) {
        try {
          const doc = await fetchOrganizadorToadaById(songId, groupId);
          if (doc) {
            const parsed = parseToadaDocument(doc, 'puxador');
            const updated = generateToadaFromSheet(project, parsed);
            loadProject(updated);
            window.dispatchEvent(
              new CustomEvent('app-toast', {
                detail: { type: 'success', message: `Fiche « ${doc.titre} » chargée depuis Organizador !` },
              })
            );
          }
        } catch (err) {
          console.warn('[useOrganizadorDeepLink] Échec chargement song fiche :', err);
        }
      }
    };

    executeLoad();
  }, [groupId, project, loadProject]);
}
