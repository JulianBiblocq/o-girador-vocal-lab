/**
 * pitchStepSegmentation.ts
 * Filtrage des creux consonantiques (< 120ms), découpage de pitchCurve et médiane tronquée locale (< 140 lignes).
 */
import type { PitchCurvePoint, VocalStepData } from '../types/vocalPack.types';
import { midiToNoteName } from '../utils/noteUtils';
import { snapMidiToScale, type ScaleType } from './scaleQuantizer';

export interface PitchSegment {
  id: number; startSec: number; endSec: number; points: PitchCurvePoint[];
  medianMidiFloat: number; medianMidi: number;
}

export interface SegmentationOptions {
  minDurationSec?: number; pitchJumpThreshold?: number; maxTimeGapSec?: number;
}

export function filterConsonantPitchDips(pitchCurve: PitchCurvePoint[], maxDipDurationSec = 0.125, minDropSemitones = 3.2): PitchCurvePoint[] {
  if (!pitchCurve || pitchCurve.length < 3) return pitchCurve;
  const out = pitchCurve.map((p) => ({ ...p })), n = out.length;
  let i = 0;
  while (i < n) {
    if (out[i].midiFloat < 36) { i++; continue; }
    let prevIdx = i - 1;
    while (prevIdx >= 0 && out[prevIdx].midiFloat < 36 && out[i].timeSec - out[prevIdx].timeSec <= 0.18) prevIdx--;
    const prevMidi = (prevIdx >= 0 && out[prevIdx].midiFloat >= 36 && out[i].timeSec - out[prevIdx].timeSec <= 0.18) ? out[prevIdx].midiFloat : null;
    if (prevMidi !== null && prevMidi - out[i].midiFloat >= minDropSemitones) {
      let j = i;
      while (j + 1 < n && out[j + 1].midiFloat >= 36 && out[j + 1].timeSec - out[i].timeSec <= maxDipDurationSec && prevMidi - out[j + 1].midiFloat >= minDropSemitones * 0.75) j++;
      let nextIdx = j + 1;
      while (nextIdx < n && out[nextIdx].midiFloat < 36 && out[nextIdx].timeSec - out[j].timeSec <= 0.15) nextIdx++;
      const nextMidi = (nextIdx < n && out[nextIdx].midiFloat >= 36 && out[nextIdx].timeSec - out[j].timeSec <= 0.15) ? out[nextIdx].midiFloat : null;
      if (out[j].timeSec - out[i].timeSec <= maxDipDurationSec && (nextMidi === null || nextMidi - out[i].midiFloat >= minDropSemitones * 0.75)) {
        const refStart = prevMidi, refEnd = nextMidi ?? prevMidi;
        for (let k = i; k <= j; k++) out[k].midiFloat = refStart + (j > i ? (k - i) / (j - i) : 0.5) * (refEnd - refStart);
        i = j + 1; continue;
      }
    }
    i++;
  }
  return out;
}

export function computeTrimmedMedianMidi(
  pitchCurve: PitchCurvePoint[], startSec: number, endSec: number, trimRatio = 0.15
): { midi: number; midiFloat: number } | null {
  if (!pitchCurve || pitchCurve.length === 0 || endSec <= startSec) return null;
  let pts = pitchCurve.filter((p) => p.timeSec >= startSec && p.timeSec <= endSec && p.midiFloat >= 36 && p.midiFloat <= 96);
  if (pts.length === 0) pts = pitchCurve.filter((p) => p.timeSec >= startSec - 0.025 && p.timeSec <= endSec + 0.025 && p.midiFloat >= 36 && p.midiFloat <= 96);
  if (pts.length === 0) return null;

  const sorted = pts.map((p) => p.midiFloat).sort((a, b) => a - b);
  const n = sorted.length, trimCount = n >= 4 ? Math.max(1, Math.floor(n * trimRatio)) : 0;
  const central = n === 3 ? sorted.slice(1) : sorted.slice(trimCount, n - trimCount);
  const mid = Math.floor(central.length / 2);
  const midiFloat = central.length % 2 === 0 ? (central[mid - 1] + central[mid]) / 2 : central[mid];
  return { midi: Math.round(midiFloat), midiFloat };
}

export function recalibrateBricksToLocalPitchCurve(
  steps: VocalStepData[], pitchCurve: PitchCurvePoint[], gridStartSec: number, stepDurationSec: number,
  tonic = 'C', scaleType: ScaleType = 'chromatic', smoothingLevel = 0.15
): VocalStepData[] {
  if (!pitchCurve || pitchCurve.length === 0 || !steps.length || stepDurationSec <= 0) return steps;
  const cleanCurve = filterConsonantPitchDips(pitchCurve);
  const result = steps.map((s) => ({ ...s }));
  const bricks: Array<{ startIdx: number; endIdx: number; midiFloat: number }> = [];

  for (let i = 0; i < result.length; i++) {
    if (!result[i].active || result[i].note === '───') continue;
    let endIdx = i;
    while (endIdx + 1 < result.length && result[endIdx + 1].active && result[endIdx + 1].note === '───') endIdx++;
    const startSec = gridStartSec + i * stepDurationSec, endSec = gridStartSec + (endIdx + 1) * stepDurationSec;
    const local = computeTrimmedMedianMidi(cleanCurve, startSec, endSec, 0.15);
    bricks.push({ startIdx: i, endIdx, midiFloat: local ? local.midiFloat : result[i].midiNumber });
    i = endIdx;
  }

  for (let b = 0; b < bricks.length; b++) {
    const cur = bricks[b], spanSteps = cur.endIdx - cur.startIdx + 1;
    let effFloat = cur.midiFloat;
    const prevF = b > 0 ? bricks[b - 1].midiFloat : cur.midiFloat;
    const nextF = b + 1 < bricks.length ? bricks[b + 1].midiFloat : cur.midiFloat;
    // Protection anti-creux de consonne sur brique courte (1 double-croche plongeant de >= 3.2 st)
    if (spanSteps <= 1 && bricks.length > 1 && (prevF - effFloat >= 3.2 || nextF - effFloat >= 3.2)) {
      effFloat = b > 0 && b + 1 < bricks.length ? (prevF + nextF) / 2 : (b > 0 ? prevF : nextF);
    } else if (smoothingLevel > 0.25 && bricks.length > 1) {
      const maxJump = 0.6 + smoothingLevel * 1.4;
      const pWeight = Math.abs(prevF - effFloat) <= maxJump ? (smoothingLevel - 0.25) * 0.45 : 0;
      const nWeight = Math.abs(nextF - effFloat) <= maxJump ? (smoothingLevel - 0.25) * 0.45 : 0;
      effFloat = (effFloat + prevF * pWeight + nextF * nWeight) / (1 + pWeight + nWeight);
    }
    let targetMidi = Math.round(effFloat);
    if (scaleType !== 'chromatic') targetMidi = snapMidiToScale(targetMidi, tonic, scaleType);
    result[cur.startIdx] = { ...result[cur.startIdx], midiNumber: targetMidi, note: midiToNoteName(targetMidi), isTie: false };
    for (let k = cur.startIdx + 1; k <= cur.endIdx; k++) {
      result[k] = { ...result[k], midiNumber: targetMidi, note: '───', isTie: true };
    }
  }
  return result;
}

export function segmentPitchCurve(pitchCurve: PitchCurvePoint[], options?: SegmentationOptions): PitchSegment[] {
  if (!pitchCurve || pitchCurve.length < 2) return [];
  const minDurationSec = options?.minDurationSec ?? 0.04, pitchJumpThreshold = options?.pitchJumpThreshold ?? 0.7, maxTimeGapSec = options?.maxTimeGapSec ?? 0.065;
  const cleanCurve = filterConsonantPitchDips(pitchCurve);
  const validPoints = cleanCurve.filter((p) => p.midiFloat >= 36 && p.midiFloat <= 96).sort((a, b) => a.timeSec - b.timeSec);
  if (validPoints.length < 2) return [];

  const rawSegments: PitchCurvePoint[][] = [];
  let currentGroup: PitchCurvePoint[] = [validPoints[0]], groupSum = validPoints[0].midiFloat;
  for (let i = 1; i < validPoints.length; i++) {
    const prev = validPoints[i - 1], curr = validPoints[i], timeGap = curr.timeSec - prev.timeSec;
    const frameJump = Math.abs(curr.midiFloat - prev.midiFloat), drift = Math.abs(curr.midiFloat - groupSum / currentGroup.length);
    if (timeGap > maxTimeGapSec || frameJump > pitchJumpThreshold || drift >= Math.max(0.68, pitchJumpThreshold)) {
      if (currentGroup.length > 0) rawSegments.push(currentGroup);
      currentGroup = [curr]; groupSum = curr.midiFloat;
    } else { currentGroup.push(curr); groupSum += curr.midiFloat; }
  }
  if (currentGroup.length > 0) rawSegments.push(currentGroup);

  const segments: PitchSegment[] = [];
  let segId = 0;
  for (const group of rawSegments) {
    const first = group[0], last = group[group.length - 1];
    if (last.timeSec - first.timeSec + 0.01 < minDurationSec && group.length < 2) continue;
    const sorted = group.map((p) => p.midiFloat).sort((a, b) => a - b);
    const n = sorted.length, trim = n >= 5 ? Math.floor(n * 0.2) : 0, central = sorted.slice(trim, n - trim);
    const mid = Math.floor(central.length / 2), medianFloat = central.length % 2 === 0 ? (central[mid - 1] + central[mid]) / 2 : central[mid];
    segments.push({ id: ++segId, startSec: first.timeSec, endSec: last.timeSec + 0.015, points: group, medianMidiFloat: Math.round(medianFloat * 100) / 100, medianMidi: Math.round(medianFloat) });
  }
  return segments;
}
