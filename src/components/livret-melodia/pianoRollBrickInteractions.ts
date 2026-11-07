/**
 * pianoRollBrickInteractions.ts
 * Édition directe ultra-rapide des briques à la souris au Livret 4 (< 125 lignes) :
 * - Détection de la poignée de redimensionnement droite (8 derniers pixels d'une brique)
 * - Étirement / raccourcissement de la tenue (isTie: true, '───')
 * - Soudure directe de deux briques voisines (Shift+Clic, Double-clic jonction ou bouton [ Lier ])
 */
import type { VocalStepData } from '../../types/vocalPack.types';
import { getStepHorizontalBoundsPx } from '../../utils/tripletBeatHelper';
import { findBrickRange } from './pianoRollInteractions';

export function isOnBrickRightResizeHandle(
  xPx: number,
  canvasWidthPx: number,
  totalSteps: number,
  brickEndIndex: number,
  handleWidthPx = 8,
  steps?: VocalStepData[]
): boolean {
  if (totalSteps <= 0 || canvasWidthPx <= 0) return false;
  const brickRightX = steps && steps.length > 0
    ? (() => { const b = getStepHorizontalBoundsPx(steps, brickEndIndex, canvasWidthPx, false); return b.xPx + b.widthPx; })()
    : (brickEndIndex + 1) * (canvasWidthPx / totalSteps);
  return xPx >= brickRightX - handleWidthPx && xPx <= brickRightX + 3;
}

export function findBrickJunctionAtX(
  steps: VocalStepData[],
  xPx: number,
  canvasWidthPx: number,
  tolerancePx = 8
): number | null {
  if (!steps.length || canvasWidthPx <= 0) return null;
  for (let i = 1; i < steps.length; i++) {
    const cur = steps[i];
    if (cur.tripletSlot === 'unused') continue;
    const prevIdx = steps[i - 1]?.tripletSlot === 'unused' ? i - 2 : i - 1;
    const prev = prevIdx >= 0 ? steps[prevIdx] : undefined;
    if (cur.active && cur.note !== '───' && prev?.active) {
      const boundaryX = getStepHorizontalBoundsPx(steps, i, canvasWidthPx, false).xPx;
      if (Math.abs(xPx - boundaryX) <= tolerancePx) return i;
    }
  }
  return null;
}

export function resizeBrickRightEdge(
  steps: VocalStepData[],
  rootIndex: number,
  targetEndIndex: number
): VocalStepData[] {
  const range = findBrickRange(steps, rootIndex);
  if (!range) return steps;

  const next = steps.map((s) => ({ ...s }));
  const rootMidi = next[range.rootIndex].midiNumber;
  const clampedTarget = Math.max(range.rootIndex, Math.min(next.length - 1, targetEndIndex));

  if (clampedTarget > range.endIndex) {
    for (let i = range.endIndex + 1; i <= clampedTarget; i++) {
      if (next[i].tripletSlot === 'unused') continue;
      next[i] = {
        ...next[i], active: true, midiNumber: rootMidi, note: '───',
        isTie: true, syllable: '', syllableAttack: false, velocity: 90,
      };
    }
  } else if (clampedTarget < range.endIndex) {
    for (let i = clampedTarget + 1; i <= range.endIndex; i++) {
      if (next[i].tripletSlot === 'unused') continue;
      next[i] = {
        ...next[i], active: false, midiNumber: 0, note: '',
        isTie: false, syllable: '', syllableAttack: false, velocity: 0,
      };
    }
  }
  return next;
}

export function weldAdjacentBricks(
  steps: VocalStepData[],
  stepIndex: number,
  maxSemitoneDiff = 12
): VocalStepData[] {
  const targetRange = findBrickRange(steps, stepIndex);
  if (!targetRange) return steps;

  let firstRange = targetRange;
  let secondRange: { rootIndex: number; endIndex: number } | null = null;

  let prevIdx = targetRange.rootIndex - 1;
  while (prevIdx >= 0 && !steps[prevIdx].active) prevIdx--;
  if (prevIdx >= 0) {
    const prevRange = findBrickRange(steps, prevIdx);
    if (prevRange) {
      firstRange = prevRange;
      secondRange = targetRange;
    }
  } else {
    let nextIdx = targetRange.endIndex + 1;
    while (nextIdx < steps.length && !steps[nextIdx].active) nextIdx++;
    if (nextIdx < steps.length) {
      secondRange = findBrickRange(steps, nextIdx);
    }
  }

  if (!secondRange) return steps;
  const firstMidi = steps[firstRange.rootIndex].midiNumber;
  const secondMidi = steps[secondRange.rootIndex].midiNumber;
  if (Math.abs(firstMidi - secondMidi) > maxSemitoneDiff) return steps;

  const next = steps.map((s) => ({ ...s }));
  for (let i = firstRange.rootIndex + 1; i <= secondRange.endIndex; i++) {
    next[i] = {
      ...next[i], active: true, midiNumber: firstMidi, note: '───',
      isTie: true, syllable: '', syllableAttack: false, velocity: 90,
    };
  }
  return next;
}
