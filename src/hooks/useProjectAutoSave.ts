/**
 * useProjectAutoSave.ts
 * Hook de synchronisation automatique avec IndexedDB (debounce 800 ms + flush unload) (< 85 lignes).
 * Ne court-circuite jamais un deep-link URL (?songId=, ?toadaId=).
 */
import { useEffect, useRef } from 'react';
import type { ToadaProject } from '../types/toadaProject.types';
import { saveProjectToIndexedDB, loadProjectFromIndexedDB } from '../utils/projectAutoSave';
import { saveToadaToLibrary } from '../utils/toadaLibraryStorage';
import { resolveFreshTimeAnchors } from '../utils/timeAnchorParser';
import { extractProjectRawLyricsSource } from '../audio/livretResetHelper';
import { getBeatsPerMeasure } from '../utils/musicalMath';

const AUTOSAVE_DEBOUNCE_MS = 800;

function getSummarySignature(p: ToadaProject): string {
  return `${p.id}|${p.title || ''}|${p.bpm || 88}|${p.timeSignature || '4/4'}|${p.patterns?.length || 0}`;
}

export function useProjectAutoSave(
  project: ToadaProject,
  setProject: React.Dispatch<React.SetStateAction<ToadaProject>>
) {
  const isHydratedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const latestProjectRef = useRef<ToadaProject>(project);
  const hasPendingRef = useRef(false);
  const lastSummarySigRef = useRef<string>('');

  latestProjectRef.current = project;

  // 1. Restauration initiale depuis IndexedDB (sauf si un deep-link URL est actif)
  useEffect(() => {
    let isMounted = true;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('songId') || params.get('toadaId') || params.get('loadToadaId')) {
        isHydratedRef.current = true;
        return;
      }
    }
    loadProjectFromIndexedDB().then((saved) => {
      if (isMounted && saved && saved.patterns && saved.patterns.length > 0) {
        const bpmCount = getBeatsPerMeasure(saved.timeSignature);
        const hydratedPatterns = saved.patterns.map((pat) => ({
          ...pat,
          timeAnchors: resolveFreshTimeAnchors(pat.rawLineCode, pat.timeAnchors, bpmCount, pat.hasAnacrusis === false, pat.assignedLyricsText, extractProjectRawLyricsSource(saved, pat)),
        }));
        const hydrated = { ...saved, patterns: hydratedPatterns };
        lastSummarySigRef.current = getSummarySignature(hydrated);
        setProject(hydrated);
      }
      isHydratedRef.current = true;
    });
    return () => {
      isMounted = false;
    };
  }, [setProject]);

  // 2. Sauvegarde continue automatique régulée (debounce 800 ms)
  useEffect(() => {
    if (!isHydratedRef.current) return;
    hasPendingRef.current = true;

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(async () => {
      timerRef.current = null;
      hasPendingRef.current = false;
      const cur = latestProjectRef.current;
      await Promise.all([saveProjectToIndexedDB(cur), saveToadaToLibrary(cur)]);
      const nextSig = getSummarySignature(cur);
      if (nextSig !== lastSummarySigRef.current) {
        lastSummarySigRef.current = nextSig;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('toada-saved'));
        }
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [project]);

  // 3. Flush immédiat à la fermeture de l'onglet
  useEffect(() => {
    const flushPending = () => {
      if (!hasPendingRef.current || !isHydratedRef.current) return;
      hasPendingRef.current = false;
      const cur = latestProjectRef.current;
      saveProjectToIndexedDB(cur);
      saveToadaToLibrary(cur);
    };
    window.addEventListener('pagehide', flushPending);
    window.addEventListener('beforeunload', flushPending);
    return () => {
      window.removeEventListener('pagehide', flushPending);
      window.removeEventListener('beforeunload', flushPending);
    };
  }, []);
}
