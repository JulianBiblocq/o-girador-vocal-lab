/**
 * pendulumStyleHelper.ts
 * Helper pur pour l application des styles de statut et libellés du balancier 60 FPS.
 */
import type { CycleStatus } from '../../audio/cycleStatusHelper';

export function applyPhaseStyles(
  card: HTMLDivElement | null,
  recBadge: HTMLSpanElement | null,
  phaseLabel: HTMLSpanElement | null,
  status: CycleStatus,
  measuresCount: number
): void {
  const isRec = status.phase === 'anacrusis' || status.phase === 'singing';
  if (card) {
    card.style.borderColor = isRec ? '#dc2626' : 'rgba(217, 119, 6, 0.5)';
    card.style.backgroundColor = isRec ? 'rgba(220, 38, 38, 0.12)' : 'rgba(0, 0, 0, 0.4)';
    card.style.boxShadow = isRec ? 'var(--cordel-shadow), 0 0 16px rgba(220, 38, 38, 0.35)' : '';
  }
  if (recBadge) {
    recBadge.textContent = isRec ? '🔴 REC ACTIF — CHANTEZ !' : '⏳ PRÉCOMPTE : ÉCOUTEZ LE TEMPO';
    recBadge.style.color = isRec ? '#ef4444' : 'var(--cordel-accent-text, #f59e0b)';
  }
  if (phaseLabel) {
    const bpmTotal = status.beatsPerMeasure;
    if (status.phase === 'countdown') {
      phaseLabel.textContent = `DECOMPTE & TONALITE (Ecoutez : ${status.currentBeat + 1} / ${bpmTotal})`;
    } else if (status.phase === 'anacrusis') {
      phaseLabel.textContent = `ANACROUSE / ELAN (Chantez si depart en levee : ${status.currentBeat + 1} / ${bpmTotal})`;
    } else if (status.phase === 'singing') {
      phaseLabel.textContent = `CHANT : MESURE ${status.currentMeasure + 1} / ${measuresCount} (TEMPS ${status.currentBeat + 1} / ${bpmTotal})`;
    } else if (status.phase === 'completed') {
      phaseLabel.textContent = 'CYCLE TERMINE (PUNCH-OUT)';
    }
  }
}
