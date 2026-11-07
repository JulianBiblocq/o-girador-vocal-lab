/**
 * tripletBeatHelper.ts
 * Calculs géométriques et temporels purs pour les temps en Triolet (³1-2-3 & ³_2-3)
 * tout en préservant l'indexation canonique à 4 entrées par temps dans `steps` (< 100 lignes).
 */
import type { MelodicStep } from '../types/livret.types';

const STEPS_PER_BEAT = 4;

export function isBeatTriplet(steps: MelodicStep[], beatStartStepIdx: number): boolean {
  if (!steps || beatStartStepIdx < 0 || beatStartStepIdx >= steps.length) return false;
  const end = Math.min(steps.length, beatStartStepIdx + STEPS_PER_BEAT);
  for (let i = beatStartStepIdx; i < end; i++) {
    if (steps[i]?.tripletSlot !== undefined) return true;
  }
  return false;
}

function getSingleStepBeatSpan(steps: MelodicStep[], stepIdx: number) {
  const beatIndex = Math.floor(stepIdx / STEPS_PER_BEAT);
  const beatStart = beatIndex * STEPS_PER_BEAT, subIdx = stepIdx - beatStart, step = steps[stepIdx];
  if (isBeatTriplet(steps, beatStart)) {
    const slot = step?.tripletSlot ?? (subIdx === 0 ? 1 : subIdx === 1 ? 2 : subIdx === 2 ? 3 : 'unused');
    if (slot === 'unused' || subIdx >= 3) return { beatIndex, startFrac: 1, endFrac: 1, hidden: true };
    return { beatIndex, startFrac: (slot - 1) / 3, endFrac: slot / 3, hidden: false };
  }
  return { beatIndex, startFrac: subIdx / STEPS_PER_BEAT, endFrac: (subIdx + 1) / STEPS_PER_BEAT, hidden: false };
}

export function findLastTiedStepIndex(steps: MelodicStep[], rootIdx: number): number {
  const root = steps[rootIdx];
  if (!root || !root.active || root.isTie || root.note === '───' || root.tripletSlot === 'unused') return rootIdx;
  let endIdx = rootIdx, k = rootIdx + 1;
  while (k < steps.length) {
    const st = steps[k];
    if (st.tripletSlot === 'unused') {
      if (k + 1 < steps.length && steps[k + 1].active && (steps[k + 1].isTie || steps[k + 1].note === '───')) { k++; continue; }
      break;
    }
    if (st.active && (st.isTie || st.note === '───')) { endIdx = k; k++; } else break;
  }
  return endIdx;
}

export function getStepTimeWindowSec(
  steps: MelodicStep[], stepIdx: number, tGridStartSec: number, beatDurationSec: number, includeTies = true
): { startSec: number; endSec: number; durationSec: number } {
  if (!steps || stepIdx < 0 || stepIdx >= steps.length || beatDurationSec <= 0) {
    return { startSec: tGridStartSec, endSec: tGridStartSec, durationSec: 0 };
  }
  const first = getSingleStepBeatSpan(steps, stepIdx);
  if (first.hidden) {
    const unusedSec = tGridStartSec + (first.beatIndex + 1) * beatDurationSec;
    return { startSec: unusedSec, endSec: unusedSec, durationSec: 0 };
  }
  const endStepIdx = includeTies ? findLastTiedStepIndex(steps, stepIdx) : stepIdx;
  const last = endStepIdx > stepIdx ? getSingleStepBeatSpan(steps, endStepIdx) : first;
  const startSec = tGridStartSec + (first.beatIndex + first.startFrac) * beatDurationSec;
  const endSec = tGridStartSec + (last.beatIndex + last.endFrac) * beatDurationSec;
  return { startSec, endSec, durationSec: Math.max(0, endSec - startSec) };
}

export function getStepHorizontalBoundsPx(
  steps: MelodicStep[], stepIdx: number, gridWidthPx: number, includeTies = true
): { xPx: number; widthPx: number; hidden: boolean } {
  if (!steps || steps.length === 0 || stepIdx < 0 || stepIdx >= steps.length || gridWidthPx <= 0) {
    return { xPx: 0, widthPx: 0, hidden: true };
  }
  const totalBeats = Math.max(1, steps.length / STEPS_PER_BEAT), beatWidthPx = gridWidthPx / totalBeats;
  const first = getSingleStepBeatSpan(steps, stepIdx);
  if (first.hidden) return { xPx: (first.beatIndex + 1) * beatWidthPx, widthPx: 0, hidden: true };
  const endStepIdx = includeTies ? findLastTiedStepIndex(steps, stepIdx) : stepIdx;
  const last = endStepIdx > stepIdx ? getSingleStepBeatSpan(steps, endStepIdx) : first;
  const xPx = (first.beatIndex + first.startFrac) * beatWidthPx;
  const rightPx = (last.beatIndex + last.endFrac) * beatWidthPx;
  return { xPx, widthPx: Math.max(0, rightPx - xPx), hidden: false };
}

export function resolveStepIndexAtXPx(
  steps: MelodicStep[], xPx: number, gridWidthPx: number, resPerBeat = STEPS_PER_BEAT
): number {
  if (!steps || steps.length === 0 || gridWidthPx <= 0) return 0;
  const totalBeats = Math.max(1, Math.floor(steps.length / resPerBeat)), beatWidthPx = gridWidthPx / totalBeats;
  const clampedX = Math.max(0, Math.min(gridWidthPx - 0.001, xPx));
  const beatIdx = Math.min(totalBeats - 1, Math.floor(clampedX / beatWidthPx)), beatStart = beatIdx * resPerBeat;
  const relFrac = Math.max(0, Math.min(0.9999, (clampedX - beatIdx * beatWidthPx) / beatWidthPx));
  if (isBeatTriplet(steps, beatStart)) return Math.min(steps.length - 1, beatStart + Math.min(2, Math.floor(relFrac * 3)));
  return Math.min(steps.length - 1, beatStart + Math.min(resPerBeat - 1, Math.floor(relFrac * resPerBeat)));
}
