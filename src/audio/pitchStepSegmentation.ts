/**
 * pitchStepSegmentation.ts
 * Découpage de la courbe de pitch verte en segments mélodiques continus (source unique de vérité).
 * Sauts francs > 1.2 demi-ton, seuil assoupli 50-60 ms, médiane MIDI exacte (< 90 lignes).
 */
import type { PitchCurvePoint } from '../types/vocalPack.types';

export interface PitchSegment {
  id: number;
  startSec: number;
  endSec: number;
  points: PitchCurvePoint[];
  medianMidiFloat: number;
  medianMidi: number;
}

export interface SegmentationOptions {
  minDurationSec?: number;
  pitchJumpThreshold?: number;
  maxTimeGapSec?: number;
}

export function segmentPitchCurve(
  pitchCurve: PitchCurvePoint[],
  options?: SegmentationOptions
): PitchSegment[] {
  if (!pitchCurve || pitchCurve.length < 2) return [];

  const minDurationSec = options?.minDurationSec ?? 0.045; // ~50 ms
  const pitchJumpThreshold = options?.pitchJumpThreshold ?? 1.2; // coupure franche > 1.2 demi-tons
  const maxTimeGapSec = options?.maxTimeGapSec ?? 0.065; // coupure silence / non voisé

  const validPoints = pitchCurve
    .filter((p) => p.midiFloat >= 36 && p.midiFloat <= 96)
    .sort((a, b) => a.timeSec - b.timeSec);

  if (validPoints.length < 2) return [];

  const rawSegments: PitchCurvePoint[][] = [];
  let currentGroup: PitchCurvePoint[] = [validPoints[0]];

  for (let i = 1; i < validPoints.length; i++) {
    const prev = validPoints[i - 1];
    const curr = validPoints[i];

    const timeGap = curr.timeSec - prev.timeSec;
    const pitchGap = Math.abs(curr.midiFloat - prev.midiFloat);

    // Découpage dès saut franc > 1.2 demi-ton ou trou temporel
    if (timeGap > maxTimeGapSec || pitchGap > pitchJumpThreshold) {
      if (currentGroup.length > 0) rawSegments.push(currentGroup);
      currentGroup = [curr];
    } else {
      currentGroup.push(curr);
    }
  }
  if (currentGroup.length > 0) rawSegments.push(currentGroup);

  const segments: PitchSegment[] = [];
  let segId = 0;

  for (const group of rawSegments) {
    const first = group[0];
    const last = group[group.length - 1];
    const duration = last.timeSec - first.timeSec + 0.01;

    // Filtre des micro-bruits < 50ms tout en préservant toutes les notes courtes
    if (duration < minDurationSec && group.length < 3) continue;

    // Médiane MIDI exacte des points verts du segment
    const sorted = group.map((p) => p.midiFloat).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const medianFloat = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    const medianMidi = Math.round(medianFloat);

    segments.push({
      id: ++segId,
      startSec: first.timeSec,
      endSec: last.timeSec + 0.015,
      points: group,
      medianMidiFloat: Math.round(medianFloat * 100) / 100,
      medianMidi,
    });
  }

  return segments;
}
