/**
 * useResetAllProjectTakes.ts
 * Hook partagé de réinitialisation locale de toutes les prises audio d'une Toada (< 50 lignes).
 * Applique d'abord loadProject(resetProject) puis attend persistResetProjectAudio(resetProject).
 */
import { useMemo, useCallback } from 'react';
import type { ToadaProject } from '../types/toadaProject.types';
import { useLanguage } from '../i18n/LanguageContext';
import { confirmAsync } from '../stores/useCordelDialogStore';
import { stopAllActiveAudioEngines } from '../audio/sharedAudioContext';
import {
  projectHasAnyRecordedAudio,
  resetAllProjectRecordings,
  persistResetProjectAudio,
} from '../utils/projectAudioResetter';

export function useResetAllProjectTakes(
  project: ToadaProject,
  onProjectUpdate: (next: ToadaProject) => void
) {
  const { t } = useLanguage();
  const hasAnyProjectTake = useMemo(() => projectHasAnyRecordedAudio(project), [project]);

  const handleResetAllTakes = useCallback(async () => {
    if (!hasAnyProjectTake) return;
    const confirmed = await confirmAsync({
      title: t('resetAllProjectTakesBtn'),
      message: t('resetAllProjectTakesConfirm'),
      confirmLabel: t('dialogConfirm'),
      cancelLabel: t('dialogCancel'),
      variant: 'danger',
    });
    if (!confirmed) return;

    stopAllActiveAudioEngines();
    const resetProject = resetAllProjectRecordings(project, { skipImmediatePersist: true });
    onProjectUpdate(resetProject);
    await persistResetProjectAudio(resetProject);

    window.dispatchEvent(
      new CustomEvent('app-toast', {
        detail: { type: 'success', message: `✓ ${t('resetAllProjectTakesToast')}` },
      })
    );
  }, [hasAnyProjectTake, project, onProjectUpdate, t]);

  return { hasAnyProjectTake, handleResetAllTakes };
}
