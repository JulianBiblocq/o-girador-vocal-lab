/**
 * useProjectAutoSave.ts
 * Hook de synchronisation automatique avec IndexedDB (debounce 300 ms) (< 70 lignes).
 * Ne court-circuite jamais un deep-link URL (?songId=, ?toadaId=).
 */
import { useEffect, useRef } from 'react';
import type { ToadaProject } from '../types/toadaProject.types';
import { saveProjectToIndexedDB, loadProjectFromIndexedDB } from '../utils/projectAutoSave';
import { saveToadaToLibrary } from '../utils/toadaLibraryStorage';

export function useProjectAutoSave(
  project: ToadaProject,
  setProject: React.Dispatch<React.SetStateAction<ToadaProject>>
) {
  const isHydratedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

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
        setProject(saved);
      }
      isHydratedRef.current = true;
    });
    return () => {
      isMounted = false;
    };
  }, [setProject]);

  // 2. Sauvegarde continue automatique (debounce 300ms)
  useEffect(() => {
    if (!isHydratedRef.current) return;

    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      saveProjectToIndexedDB(project);
      saveToadaToLibrary(project);
      timerRef.current = null;
    }, 300);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [project]);
}
