/**
 * useManualSave.ts
 * Hook de sauvegarde manuelle forcée (IndexedDB + Cloud Firestore si connecté) (< 65 lignes).
 * Raccourci clavier universel Ctrl+S / Cmd+S et feedback 2s.
 */
import { useState, useCallback, useEffect } from 'react';
import type { ToadaProject } from '../types/toadaProject.types';
import { saveProjectToIndexedDB } from '../utils/projectAutoSave';
import { saveToadaToLibrary } from '../utils/toadaLibraryStorage';
import { publishToadaToSequencer } from '../services/cloudToadaPublisher';
import { useLanguage } from '../i18n/LanguageContext';

export function useManualSave(project: ToadaProject, isUserLoggedIn: boolean) {
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      // 1. Sauvegarde locale immédiate (IndexedDB + Bibliothèque Mes Toadas)
      await saveProjectToIndexedDB(project);
      await saveToadaToLibrary(project);

      // Notification locale pour rafraîchir le menu Mes Toadas
      window.dispatchEvent(new CustomEvent('toada-saved', { detail: { id: project.id } }));

      // 2. Synchronisation Cloud Firestore en parallèle si connecté
      if (isUserLoggedIn) {
        publishToadaToSequencer(project).catch((err) => {
          console.warn('[useManualSave] Sync Cloud en arrière-plan :', err);
        });
      }

      setIsSavedSuccess(true);
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { type: 'success', message: t('toadaSavedToast') },
      }));
      setTimeout(() => setIsSavedSuccess(false), 2000);
    } catch (err: any) {
      console.error('[useManualSave] Erreur lors de la sauvegarde :', err);
    } finally {
      setIsSaving(false);
    }
  }, [project, isUserLoggedIn, isSaving, t]);

  // Support du raccourci clavier universel Ctrl+S / Cmd+S
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
