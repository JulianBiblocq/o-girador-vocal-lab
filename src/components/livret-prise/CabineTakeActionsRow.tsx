/**
 * CabineTakeActionsRow.tsx
 * Barre d'actions post-enregistrement sous le transport Cabine (navigation Calage/Mélodie,
 * remise à zéro de la prise active et rappel de remise à zéro intégrale du morceau) (< 75 lignes).
 */
import React, { useCallback } from 'react';
import { RotateCcw, Scissors, Music } from 'lucide-react';
import type { VocalPatternItem, VocalAudioVariant } from '../../types/toadaProject.types';
import { useLanguage } from '../../i18n/LanguageContext';
import { confirmAsync } from '../../stores/useCordelDialogStore';
import { ResetAllTakesIcon } from '../icons/CordelActionIcons';

interface Props {
  activePatternId: string;
  activeVariantKey: string;
  hasExistingAudio: boolean;
  hasAnyProjectTake: boolean;
  disabled?: boolean;
  onOpenCalage: () => void;
  onOpenMelodia: () => void;
  updateVariant: (patternId: string, variantKey: string, partial: Partial<VocalAudioVariant>) => void;
  updatePattern: (id: string, partial: Partial<VocalPatternItem>) => void;
  onResetAllTakes: () => void;
}

export const CabineTakeActionsRow: React.FC<Props> = ({
  activePatternId, activeVariantKey, hasExistingAudio, hasAnyProjectTake, disabled = false,
  onOpenCalage, onOpenMelodia, updateVariant, updatePattern, onResetAllTakes,
}) => {
  const { t } = useLanguage();

  const handleResetActiveTake = useCallback(async () => {
    const ok = await confirmAsync({
      title: t('resetRecordingTitle'), message: t('resetRecordingConfirm'),
      confirmLabel: t('dialogConfirm'), cancelLabel: t('dialogCancel'), variant: 'warning',
    });
    if (ok) {
      updateVariant(activePatternId, activeVariantKey, { recordingResult: null });
      updatePattern(activePatternId, { recordingResult: null, rawAudioSamples: null });
    }
  }, [t, updateVariant, updatePattern, activePatternId, activeVariantKey]);

  if (!hasExistingAudio && !hasAnyProjectTake) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-[var(--cordel-border-sub)]">
      {hasExistingAudio && (
        <>
          <button type="button" disabled={disabled} onClick={onOpenCalage} className="cordel-btn-primary px-3 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
            <Scissors className="w-3.5 h-3.5" /><span>{t('fanion3Short')}</span>
          </button>
          <button type="button" disabled={disabled} onClick={onOpenMelodia} className="cordel-btn px-3 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
            <Music className="w-3.5 h-3.5 text-theme-accent" /><span>{t('fanion4Short')}</span>
          </button>
          <button type="button" disabled={disabled} onClick={handleResetActiveTake} className="cordel-card-sm px-2.5 py-1.5 text-[11px] font-mono text-red-600 dark:text-red-400 flex items-center gap-1 cursor-pointer disabled:opacity-50">
            <RotateCcw className="w-3 h-3" /><span>{t('resetRecordingTitle')}</span>
          </button>
        </>
      )}
      {hasAnyProjectTake && (
        <button
          type="button"
          disabled={disabled}
          onClick={onResetAllTakes}
          className="cordel-card-sm px-2.5 py-1.5 text-[11px] font-mono font-bold text-red-700 dark:text-red-400 hover:border-red-500/60 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <ResetAllTakesIcon className="w-3.5 h-3.5 shrink-0" />
          <span>{t('resetAllProjectTakesBtn')}</span>
        </button>
      )}
    </div>
  );
};
