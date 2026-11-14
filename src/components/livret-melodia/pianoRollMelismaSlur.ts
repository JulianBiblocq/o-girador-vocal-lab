/**
 * pianoRollMelismaSlur.ts
 * Rendu visuel d'un arc de liaison legato subtil entre une brique syllabique (`Ê`, `CA`)
 * et ses briques de mélisme suivantes (`_`) à hauteurs différentes sur le Piano Roll (< 145 lignes).
 */
import type { VocalStepData } from '../../types/vocalPack.types';
import { getStepHorizontalBoundsPx, findLastTiedStepIndex } from '../../utils/tripletBeatHelper';
import { midiToRowY } from './PianoRollKeyboard';

export function isMelismaBrickStep(step?: VocalStepData): boolean {
  if (!step || !step.active || step.note === '───' || step.isTie) return false;
  return Boolean(step.isMelisma || step.syllable?.trim() === '_');
}

export function drawMelismaLegatoSlurs(
  ctx: CanvasRenderingContext2D,
  allSteps: VocalStepData[],
  stepW: number,
  minMidi: number,
  maxMidi: number,
  rowHeight: number
): void {
  const gridWidth = stepW * allSteps.length;
  const h = Math.max(4, rowHeight - 3);
  ctx.save();
  ctx.strokeStyle = 'rgba(253, 224, 71, 0.88)';
  ctx.lineWidth = 1.8;

  for (let i = 0; i < allSteps.length; i++) {
    const cur = allSteps[i];
    if (cur.tripletSlot === 'unused' || !cur.active || cur.note === '───' || cur.midiNumber === null) continue;
    const endIdx = findLastTiedStepIndex(allSteps, i);
    const nextIdx = endIdx + 1;
    const next = allSteps[nextIdx];
    if (
      next &&
      isMelismaBrickStep(next) &&
      next.midiNumber !== null &&
      cur.midiNumber >= minMidi && cur.midiNumber <= maxMidi &&
      next.midiNumber >= minMidi && next.midiNumber <= maxMidi &&
      next.midiNumber !== cur.midiNumber
    ) {
      const b1 = getStepHorizontalBoundsPx(allSteps, i, gridWidth);
      const b2 = getStepHorizontalBoundsPx(allSteps, nextIdx, gridWidth);
      if (!b1.hidden && !b2.hidden && b1.widthPx > 0 && b2.widthPx > 0) {
        const y1 = midiToRowY(cur.midiNumber, maxMidi, rowHeight) + 1.5;
        const y2 = midiToRowY(next.midiNumber, maxMidi, rowHeight) + 1.5;
        const goingUp = next.midiNumber > cur.midiNumber;
        const sx = b1.xPx + Math.max(4, b1.widthPx - 4);
        const sy = goingUp ? y1 + 2 : y1 + h - 2;
        const ex = b2.xPx + 4;
        const ey = goingUp ? y2 + h - 2 : y2 + 2;
        const ctrlX = (sx + ex) / 2;
        const ctrlY = Math.min(sy, ey) - Math.max(6, rowHeight * 0.45);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(ctrlX, ctrlY, ex, ey);
        ctx.stroke();
      }
    }
    i = endIdx;
  }
  ctx.restore();
}
