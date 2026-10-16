/**
 * slicerPegInteractions.ts
 * Logique de manipulation, hit-testing et étiquetage des piquets de temps (< 110 lignes).
 */
export type SlicerHandleType = 'trim_in' | 'trim_out' | 'peg' | 'none';

export interface SlicerHitResult {
  type: SlicerHandleType;
  pegIndex?: number;
}

export function formatPegLabel(index: number, beatsPerMeasure = 4): string {
  if (index === 0) return '📍 M1•T1';
  const m = Math.floor(index / beatsPerMeasure) + 1;
  const t = (index % beatsPerMeasure) + 1;
  return `🚩 M${m}•T${t}`;
}

export function hitTestSlicer(
  x: number, width: number, durationSec: number,
  trimInSec: number, trimOutSec: number, pegs: number[], thresholdPx = 10
): SlicerHitResult {
  if (width <= 0 || durationSec <= 0) return { type: 'none' };
  const secToX = (s: number) => (s / durationSec) * width;

  if (Math.abs(x - secToX(trimInSec)) <= thresholdPx) return { type: 'trim_in' };
  if (Math.abs(x - secToX(trimOutSec)) <= thresholdPx) return { type: 'trim_out' };

  for (let i = 0; i < pegs.length; i++) {
    if (Math.abs(x - secToX(pegs[i])) <= thresholdPx) {
      return { type: 'peg', pegIndex: i };
    }
  }
  return { type: 'none' };
}

export function addBeatPeg(pegs: number[], timeSec: number, trimIn: number, trimOut: number): number[] {
  const clamped = Math.max(trimIn + 0.05, Math.min(trimOut - 0.05, timeSec));
  const tooClose = pegs.some((p) => Math.abs(p - clamped) < 0.04);
  if (tooClose) return pegs;
  const next = [...pegs, clamped];
  next.sort((a, b) => a - b);
  return next;
}

export function moveBeatPeg(pegs: number[], index: number, newSec: number, trimIn: number, trimOut: number): number[] {
  if (index < 0 || index >= pegs.length) return pegs;
  const minBound = index === 0 ? trimIn + 0.02 : pegs[index - 1] + 0.03;
  const maxBound = index === pegs.length - 1 ? trimOut - 0.02 : pegs[index + 1] - 0.03;
  const clamped = Math.max(minBound, Math.min(maxBound, newSec));
  const next = [...pegs];
  next[index] = clamped;
  return next;
}

export function deleteBeatPeg(pegs: number[], index: number): number[] {
  if (index < 0 || index >= pegs.length) return pegs;
  return pegs.filter((_, i) => i !== index);
}
