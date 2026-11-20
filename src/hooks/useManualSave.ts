/**
 * useManualSave.ts
 * Hook de sauvegarde manuelle forcée 100 % locale (IndexedDB) tant que le morceau n'est pas exporté (< 60 lignes).
 * Raccourci clavier universel Ctrl+S / Cmd+S et feedback pendant 2500 ms.
 */
import { useState, useCallback, useEffect } from 'react';
import type { ToadaProject } from '../types/toadaProject.types';
import { saveProjectToIndexedDB } from '../utils/projectAutoSave';
import { saveToadaToLibrary } from '../utils/toadaLibraryStorage';
import { useLanguage } from '../i18n/LanguageContext';
import { resolveCanonicalToadaPackId } from '../utils/toadaPackIdResolver';

export function useManualSave(project: ToadaProject, _isUserLoggedIn?: boolean) {
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const normalized: ToadaProject = { ...project, id: resolveCanonicalToadaPackId(project) };
      await saveProjectToIndexedDB(normalized);
      await saveToadaToLibrary(normalized);
      window.dispatchEvent(new CustomEvent('toada-saved', { detail: { id: normalized.id } }));

      setIsSavedSuccess(true);
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { type: 'success', message: t('toadaSavedToast') },
      }));
      setTimeout(() => setIsSavedSuccess(false), 2500);
    } catch (err: any) {
      console.error('[useManualSave] Erreur lors de la sauvegarde locale :', err);
    } finally {
      setIsSaving(false);
    }
  }, [project, isSaving, t]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSave]);

  return { isSaving, isSavedSuccess, handleSave };
}
