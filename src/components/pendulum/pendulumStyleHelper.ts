/**
 * pendulumStyleHelper.ts
 * Helper pur pour l'application des styles de statut et libellés du balancier 60 FPS (i18n pur via t).
 */
import type { CycleStatus } from '../../audio/cycleStatusHelper';
import type { TranslationKey, TranslationParams } from '../../i18n/i18n.types';

export function applyPhaseStyles(
  card: HTMLDivElement | null,
  recBadge: HTMLSpanElement | null,
  phaseLabel: HTMLSpanElement | null,
  status: CycleStatus,
  measuresCount: number,
  t: (key: TranslationKey, params?: TranslationParams) => string
): void {
  const isRec = status.phase === 'anacrusis' || status.phase === 'singing';
  if (card) {
    card.style.borderColor = isRec ? '#dc2626' : 'rgba(217, 119, 6, 0.5)';
    card.style.backgroundColor = isRec ? 'rgba(220, 38, 38, 0.12)' : 'rgba(0, 0, 0, 0.4)';
    card.style.boxShadow = isRec ? 'var(--cordel-shadow), 0 0 16px rgba(220, 38, 38, 0.35)' : '';
  }
  if (recBadge) {
    recBadge.textContent = isRec ? t('pendulumStatusRec') : t('pendulumStatusPrecount');
    recBadge.style.color = isRec ? '#ef4444' : 'var(--cordel-accent-text, #f59e0b)';
  }
  if (phaseLabel) {
    const bpmTotal = status.beatsPerMeasure;
    const beatNum = status.currentBeat + 1;
    if (status.phase === 'countdown') {
      phaseLabel.textContent = t('phasePrecount', { beat: beatNum, beats: bpmTotal });
    } else if (status.phase === 'anacrusis') {
      phaseLabel.textContent = t('phaseAnacrusis', { beat: beatNum, beats: bpmTotal });
    } else if (status.phase === 'singing') {
      const mNum = status.currentMeasure + 1;
      phaseLabel.textContent = t('phaseSinging', { current: mNum, total: measuresCount, beat: beatNum, beats: bpmTotal });
    } else if (status.phase === 'completed') {
      phaseLabel.textContent = t('phaseCompletedTitle');
    }
  }
}
