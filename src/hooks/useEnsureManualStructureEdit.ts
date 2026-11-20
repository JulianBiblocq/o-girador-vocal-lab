/**
 * useEnsureManualStructureEdit.ts
 * Garde-fou « Modifier la structure » : un clic sur Ajouter / Insérer / Supprimer bascule automatiquement du mode
 * Organizador au mode édition, avec une confirmation légère uniquement la 1re fois de la session (< 45 lignes).
 */
import { useCallback, useRef } from 'react';
import { confirmAsync } from '../stores/useCordelDialogStore';
import { useLanguage } from '../i18n/LanguageContext';

const CONFIRMED_KEY = 'cantador_structure_edit_confirmed';

function readConfirmed(): boolean {
  try { return sessionStorage.getItem(CONFIRMED_KEY) === '1'; } catch { return false; }
}

export function useEnsureManualStructureEdit(isManualEdit: boolean, setManualEdit: (value: boolean) => void): () => Promise<boolean> {
  const { t } = useLanguage();
  const confirmedRef = useRef<boolean>(readConfirmed());

  return useCallback(async () => {
    if (isManualEdit) return true;
    if (!confirmedRef.current) {
      const ok = await confirmAsync({
        title: t('structureEditConfirmTitle'), message: t('structureEditConfirmMsg'),
        confirmLabel: t('structureEditConfirmOk'), cancelLabel: t('dialogCancel'), variant: 'info',
      });
      if (!ok) return false;
      confirmedRef.current = true;
      try { sessionStorage.setItem(CONFIRMED_KEY, '1'); } catch { /* stockage indisponible */ }
    }
    setManualEdit(true);
    return true;
  }, [isManualEdit, setManualEdit, t]);
}
