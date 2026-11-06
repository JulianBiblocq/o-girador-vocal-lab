/**
 * pitchStepSegmentation.ts
 * Estimateur du « Cœur de Voyelle » pondéré par la Stabilité, Auto-Diapason & Prieur Tonal (< 130 lignes).
 */
import type { PitchCurvePoint, VocalStepData } from '../types/vocalPack.types';
import { midiToNoteName } from '../utils/noteUtils';
import { snapMidiToScale, snapMidiWithBayesianScalePrior, estimateGlobalTuningOffset, inferBestDiatonicScale, type ScaleType } from './scaleQuantizer';

export { estimateGlobalTuningOffset, inferBestDiatonicScale };

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

export function computeVowelCoreMidi(
  pitchCurve: PitchCurvePoint[], startSec: number, endSec: number, tuningOffset = 0, allowedPitchClasses?: Set<number> | null
): { midi: number; midiFloat: number } | null {
  if (!pitchCurve || pitchCurve.length === 0 || endSec <= startSec) return null;
  const dur = endSec - startSec, attTrim = Math.min(0.045, dur * 0.35), relTrim = Math.min(0.030, dur * 0.25);
  let pts = pitchCurve.filter((p) => p.timeSec >= startSec + attTrim && p.timeSec <= endSec - relTrim && p.midiFloat >= 36 && p.midiFloat <= 96);
  if (pts.length < 2) pts = pitchCurve.filter((p) => p.timeSec >= startSec && p.timeSec <= endSec && p.midiFloat >= 36 && p.midiFloat <= 96);
  if (pts.length === 0) pts = pitchCurve.filter((p) => p.timeSec >= startSec - 0.025 && p.timeSec <= endSec + 0.025 && p.midiFloat >= 36 && p.midiFloat <= 96);
  if (pts.length === 0) return null;

  const weighted = pts.map((p, idx) => {
    const prevM = pts[Math.max(0, idx - 1)].midiFloat, nextM = pts[Math.min(pts.length - 1, idx + 1)].midiFloat;
    const diff = (idx === 0 || idx === pts.length - 1) ? 2 * Math.abs(nextM - prevM) : Math.abs(nextM - prevM);
    const conf = p.confidence ?? 0.9, rms = Math.max(0.005, p.rms ?? 0.1);
    return { midiFloat: p.midiFloat - tuningOffset, weight: Math.max(1e-6, conf * conf * rms * Math.exp(-(diff * diff) / 0.08)) };
  }).sort((a, b) => a.midiFloat - b.midiFloat);

  const totalW = weighted.reduce((acc, x) => acc + x.weight, 0);
  let cumW = 0, coreFloat = weighted[Math.floor(weighted.length / 2)].midiFloat;
  for (const item of weighted) { cumW += item.weight; if (cumW >= 0.5 * totalW) { coreFloat = item.midiFloat; break; } }
  const midi = allowedPitchClasses ? snapMidiWithBayesianScalePrior(coreFloat, allowedPitchClasses, 0, 0.32) : Math.round(coreFloat);
  return { midi, midiFloat: coreFloat };
}

export function computeTrimmedMedianMidi(
  pitchCurve: PitchCurvePoint[], startSec: number, endSec: number, _trimRatio = 0.15, tuningOffset = 0, allowedPitchClasses?: Set<number> | null
): { midi: number; midiFloat: number } | null {
  return computeVowelCoreMidi(pitchCurve, startSec, endSec, tuningOffset, allowedPitchClasses);
}

export function recalibrateBricksToLocalPitchCurve(
  steps: VocalStepData[], pitchCurve: PitchCurvePoint[], gridStartSec: number, stepDurationSec: number,
  tonic = 'C', scaleType: ScaleType = 'chromatic', _smoothingLevel = 0, allowedPitchClasses?: Set<number> | number[] | null
): VocalStepData[] {
  if (!pitchCurve || pitchCurve.length === 0 || !steps.length || stepDurationSec <= 0) return steps;
  const cleanCurve = filterConsonantPitchDips(pitchCurve);
  const allowedSize = allowedPitchClasses instanceof Set ? allowedPitchClasses.size : (Array.isArray(allowedPitchClasses) ? allowedPitchClasses.length : 12);
  const isScaleLocked = scaleType !== 'chromatic' || ( Boolean(allowedPitchClasses) && allowedSize > 0 && allowedSize < 12 );
  const scaleSet = isScaleLocked
    ? (allowedPitchClasses instanceof Set ? allowedPitchClasses : (Array.isArray(allowedPitchClasses) ? new Set(allowedPitchClasses) : null))
    : null;
  const result = steps.map((s) => ({ ...s })), bricks: Array<{ startIdx: number; endIdx: number; midiFloat: number }> = [];

  for (let i = 0; i < result.length; i++) {
    if (!result[i].active || result[i].note === '───') continue;
    let endIdx = i;
    while (endIdx + 1 < result.length && result[endIdx + 1].active && result[endIdx + 1].note === '───') endIdx++;
    const local = computeVowelCoreMidi(cleanCurve, gridStartSec + i * stepDurationSec, gridStartSec + (endIdx + 1) * stepDurationSec, 0, scaleSet);
    bricks.push({ startIdx: i, endIdx, midiFloat: local ? local.midiFloat : result[i].midiNumber });
    i = endIdx;
  }

  for (let b = 0; b < bricks.length; b++) {
    const cur = bricks[b], spanSteps = cur.endIdx - cur.startIdx + 1;
    let effFloat = cur.midiFloat;
    const prevF = b > 0 ? bricks[b - 1].midiFloat : cur.midiFloat, nextF = b + 1 < bricks.length ? bricks[b + 1].midiFloat : cur.midiFloat;
    if (spanSteps <= 1 && bricks.length > 1 && (prevF - effFloat >= 3.5 || nextF - effFloat >= 3.5)) {
      effFloat = b > 0 && b + 1 < bricks.length ? (prevF + nextF) / 2 : (b > 0 ? prevF : nextF);
    }
    const targetMidi = isScaleLocked ? snapMidiToScale(effFloat, tonic, scaleType, allowedPitchClasses) : Math.round(effFloat);
    const origVoice = Math.round(cur.midiFloat * 100) / 100;
    result[cur.startIdx] = {
      ...result[cur.startIdx], midiNumber: targetMidi, note: midiToNoteName(targetMidi),
      isTie: false, originalVoiceMidi: origVoice, manualPitchMoved: false,
    };
    for (let k = cur.startIdx + 1; k <= cur.endIdx; k++) {
      result[k] = { ...result[k], midiNumber: targetMidi, note: '───', isTie: true, originalVoiceMidi: origVoice };
    }
  }
  return result;
}

export function segmentPitchCurve(pitchCurve: PitchCurvePoint[], options?: SegmentationOptions): PitchSegment[] {
  if (!pitchCurve || pitchCurve.length < 2) return [];
  const minDurationSec = options?.minDurationSec ?? 0.04, pitchJumpThreshold = options?.pitchJumpThreshold ?? 0.7, maxTimeGapSec = options?.maxTimeGapSec ?? 0.065;
  const cleanCurve = filterConsonantPitchDips(pitchCurve), tuningOffset = estimateGlobalTuningOffset(cleanCurve);
  const validPoints = cleanCurve.filter((p) => p.midiFloat >= 36 && p.midiFloat <= 96).sort((a, b) => a.timeSec - b.timeSec);
  if (validPoints.length < 2) return [];
  const rawSegments: PitchCurvePoint[][] = [];
  let currentGroup: PitchCurvePoint[] = [validPoints[0]], groupSum = validPoints[0].midiFloat;
  for (let i = 1; i < validPoints.length; i++) {
    const prev = validPoints[i - 1], curr = validPoints[i];
    if (curr.timeSec - prev.timeSec > maxTimeGapSec || Math.abs(curr.midiFloat - prev.midiFloat) > pitchJumpThreshold || Math.abs(curr.midiFloat - groupSum / currentGroup.length) >= Math.max(0.68, pitchJumpThreshold)) {
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
    const core = computeVowelCoreMidi(group, first.timeSec, last.timeSec, tuningOffset), medFloat = core ? core.midiFloat : first.midiFloat - tuningOffset;
    segments.push({ id: ++segId, startSec: first.timeSec, endSec: last.timeSec + 0.015, points: group, medianMidiFloat: Math.round(medFloat * 100) / 100, medianMidi: Math.round(medFloat) });
  }
  return segments;
}
