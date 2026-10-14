/**
 * pendulumStyleHelper.ts
 * Helper pur pour l'application des styles de statut et libellés du balancier 60 FPS bilingue.
 */
import type { CycleStatus } from '../../audio/cycleStatusHelper';

export function applyPhaseStyles(
  card: HTMLDivElement | null,
  recBadge: HTMLSpanElement | null,
  phaseLabel: HTMLSpanElement | null,
  status: CycleStatus,
  measuresCount: number,
  isPt: boolean = false
): void {
  const isRec = status.phase === 'anacrusis' || status.phase === 'singing';
  if (card) {
    card.style.borderColor = isRec ? '#dc2626' : 'rgba(217, 119, 6, 0.5)';
    card.style.backgroundColor = isRec ? 'rgba(220, 38, 38, 0.12)' : 'rgba(0, 0, 0, 0.4)';
    card.style.boxShadow = isRec ? 'var(--cordel-shadow), 0 0 16px rgba(220, 38, 38, 0.35)' : '';
  }
  if (recBadge) {
    if (isRec) {
      recBadge.textContent = isPt ? '🔴 GRAVANDO — CANTE!' : '🔴 REC ACTIF — CHANTEZ !';
      recBadge.style.color = '#ef4444';
    } else {
      recBadge.textContent = isPt
        ? '⏳ CONTAGEM: ESCUTE O ANDAMENTO (MICROFONE EM ESPERA)'
        : '⏳ PRÉCOMPTE : ÉCOUTEZ LE TEMPO (MICRO EN ATTENTE)';
      recBadge.style.color = 'var(--cordel-accent-text, #f59e0b)';
    }
  }
  if (phaseLabel) {
    const bpmTotal = status.beatsPerMeasure;
    const beatNum = status.currentBeat + 1;
    if (status.phase === 'countdown') {
      phaseLabel.textContent = isPt
        ? `CONTAGEM E TOM (Escute: ${beatNum} / ${bpmTotal})`
        : `DÉCOMPTE & TONALITÉ (Écoutez : ${beatNum} / ${bpmTotal})`;
    } else if (status.phase === 'anacrusis') {
      phaseLabel.textContent = isPt
        ? `ANACRUSE / IMPULSO (Cante se iniciar em contratempo : ${beatNum} / ${bpmTotal})`
        : `ANACROUSE / ÉLAN (Chantez si départ en levée : ${beatNum} / ${bpmTotal})`;
    } else if (status.phase === 'singing') {
      const mNum = status.currentMeasure + 1;
      phaseLabel.textContent = isPt
        ? `CANTO: COMPASSO ${mNum} / ${measuresCount} (TEMPO ${beatNum} / ${bpmTotal})`
        : `CHANT : MESURE ${mNum} / ${measuresCount} (TEMPS ${beatNum} / ${bpmTotal})`;
    } else if (status.phase === 'completed') {
      phaseLabel.textContent = isPt ? 'CICLO CONCLUÍDO (PUNCH-OUT)' : 'CYCLE TERMINÉ (PUNCH-OUT)';
    }
  }
}
