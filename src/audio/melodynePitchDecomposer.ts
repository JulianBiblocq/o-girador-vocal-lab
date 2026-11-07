/**
 * melodynePitchDecomposer.ts
 * Résolution locale multi-briques (transitions Hermite C1 de 35 ms), protection des consonnes
 * de liaison (m, n, nh, l, lh, r) par stabilité instantanée et décomposition f0(t) à 3 DDL (< 138 lignes).
 */
import type { PitchCurvePoint, VocalStepData, MelodyneRegion } from '../types/vocalPack.types';
import { getStepTimeWindowSec, findLastTiedStepIndex } from '../utils/tripletBeatHelper';
import { filterConsonantPitchDips } from './pitchStepSegmentation';

export interface NoteBrickSpan {
  rootIndex: number; startSec: number; endSec: number; attackEndSec: number;
  targetMidi: number; sungMedian: number; isManualMove?: boolean;
}

export interface PitchDecompositionPoint {
  hasVoicedPitch: boolean; rawMidi: number; targetMidi: number; sungMedian: number;
  driftSemitones: number; vibratoSemitones: number; inAttackZone: boolean; attackRamp: number;
  isManualMove?: boolean;
}

export function foldOctaveDistance(delta: number): number { return delta - 12 * Math.round(delta / 12); }

function hermiteStep01(u: number): number { const t = Math.max(0, Math.min(1, u)); return t * t * (3 - 2 * t); }

export function resolveMelodyneGridGeometry(
  allSteps: VocalStepData[], totalDurationSec: number, tGridStart?: number, gridDur?: number
) {
  const stepDur = (allSteps[0]?.decay > 0 && allSteps[0]?.decay < 5) ? allSteps[0].decay : (totalDurationSec / Math.max(1, allSteps.length));
  const effGridDur = gridDur && gridDur > 0 ? gridDur : (allSteps.length * stepDur);
  const effTGridStart = tGridStart !== undefined ? tGridStart : Math.max(0, Math.round((totalDurationSec - effGridDur - 0.25) * 1000) / 1000);
  return { tGridStart: effTGridStart, gridDur: Math.max(0.01, effGridDur) };
}

export function computeIntervalMedianPitch(
  rawPitchCurve: PitchCurvePoint[], startSec: number, endSec: number, fallbackMidi = 60
): number {
  const pts = rawPitchCurve.filter((p) => p.timeSec >= startSec - 0.005 && p.timeSec <= endSec + 0.005 && p.midiFloat >= 36);
  if (pts.length === 0) return fallbackMidi;
  const sorted = pts.map((p) => p.midiFloat).sort((a, b) => a - b), mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : 0.5 * (sorted[mid - 1] + sorted[mid]);
}

export function buildNoteBrickSpans(
  allSteps: VocalStepData[], rawPitchCurve: PitchCurvePoint[], totalDurationSec: number, tGridStart?: number, gridDur?: number
): NoteBrickSpan[] {
  if (!allSteps || allSteps.length === 0 || totalDurationSec <= 0) return [];
  const cleanCurve = filterConsonantPitchDips(rawPitchCurve);
  const geom = resolveMelodyneGridGeometry(allSteps, totalDurationSec, tGridStart, gridDur);
  const spans: NoteBrickSpan[] = [];
  const beatDur = (geom.gridDur / allSteps.length) * 4;
  for (let i = 0; i < allSteps.length; i++) {
    const step = allSteps[i];
    if (step.tripletSlot === 'unused' || !step.active || step.note === '───' || step.isTie || step.midiNumber <= 0) continue;
    const endIdx = findLastTiedStepIndex(allSteps, i);
    const { startSec, endSec } = getStepTimeWindowSec(allSteps, i, geom.tGridStart, beatDur);
    const cutRatio = step.melodyneStartRatio !== undefined ? Math.max(0, Math.min(0.85, step.melodyneStartRatio)) : 0;
    const attackEndSec = startSec + (endSec - startSec) * cutRatio;
    const rawMed = computeIntervalMedianPitch(cleanCurve, Math.min(endSec, attackEndSec), endSec, step.midiNumber);
    const sungMedian = rawMed + Math.round((step.midiNumber - rawMed) / 12) * 12;
    spans.push({ rootIndex: i, startSec, endSec, attackEndSec, targetMidi: step.midiNumber, sungMedian, isManualMove: Boolean(step.manualPitchMoved) });
    i = endIdx;
  }
  return spans;
}

export function resolveLocalBrickTargetAtTime(
  bricks: NoteBrickSpan[], timeSec: number, fallbackMidi = 60, overrideMidi?: number
): { brick: NoteBrickSpan | null; targetMidi: number; sungMedian: number; inAttackZone: boolean; attackRamp: number; isManualMove?: boolean } {
  if (bricks.length === 0) {
    return { brick: null, targetMidi: overrideMidi && overrideMidi > 0 ? overrideMidi : fallbackMidi, sungMedian: fallbackMidi, inAttackZone: false, attackRamp: 1, isManualMove: false };
  }
  let idx = bricks.findIndex((b) => timeSec >= b.startSec && timeSec <= b.endSec);
  if (idx === -1) {
    let minD = Infinity;
    for (let k = 0; k < bricks.length; k++) {
      const d = timeSec < bricks[k].startSec ? bricks[k].startSec - timeSec : timeSec - bricks[k].endSec;
      if (d < minD) { minD = d; idx = k; }
    }
  }
  const brick = bricks[Math.max(0, idx)];
  let targetMidi = overrideMidi && overrideMidi > 0 ? overrideMidi : brick.targetMidi;
  if (!overrideMidi && idx > 0) {
    const prev = bricks[idx - 1], dt = timeSec - brick.startSec;
    if (dt >= 0 && dt < 0.035 && brick.startSec - prev.endSec <= 0.04 && prev.targetMidi !== brick.targetMidi) {
      targetMidi = prev.targetMidi + hermiteStep01(dt / 0.035) * (brick.targetMidi - prev.targetMidi);
    }
  }
  const effStart = Math.max(brick.startSec, brick.attackEndSec);
  const inAttackZone = timeSec < effStart || timeSec > brick.endSec;
  let attackRamp = inAttackZone ? 0 : 1;
  if (!inAttackZone) {
    const dtStart = timeSec - effStart, dtEnd = brick.endSec - timeSec;
    if (dtStart < 0.035) attackRamp = Math.min(attackRamp, hermiteStep01(dtStart / 0.035));
    if (dtEnd < 0.035) attackRamp = Math.min(attackRamp, hermiteStep01(dtEnd / 0.035));
  }
  return { brick, targetMidi, sungMedian: brick.sungMedian, inAttackZone, attackRamp, isManualMove: brick.isManualMove };
}

export function decomposePitchAtTime(
  rawPitchCurve: PitchCurvePoint[], bricks: NoteBrickSpan[], timeSec: number, fallbackMidi = 60, overrideMidi?: number
): PitchDecompositionPoint {
  const loc = resolveLocalBrickTargetAtTime(bricks, timeSec, fallbackMidi, overrideMidi);
  if (!rawPitchCurve || rawPitchCurve.length === 0) return { hasVoicedPitch: false, rawMidi: loc.targetMidi, ...loc, driftSemitones: 0, vibratoSemitones: 0 };
  let nearestDiff = Infinity, rawMidi = loc.sungMedian, nearestIdx = 0;
  for (let i = 0; i < rawPitchCurve.length; i++) {
    const p = rawPitchCurve[i], d = Math.abs(p.timeSec - timeSec);
    if (p.midiFloat >= 36 && d < nearestDiff) { nearestDiff = d; rawMidi = p.midiFloat; nearestIdx = i; }
  }
  const hasVoicedPitch = nearestDiff <= 0.018;
  const pPrev = rawPitchCurve[Math.max(0, nearestIdx - 1)], pNext = rawPitchCurve[Math.min(rawPitchCurve.length - 1, nearestIdx + 1)];
  const slopeStPerSec = pNext && pPrev && pNext.timeSec > pPrev.timeSec ? Math.abs(pNext.midiFloat - pPrev.midiFloat) / (pNext.timeSec - pPrev.timeSec) : 0;
  const liaisonStability = slopeStPerSec > 16 ? Math.exp(-((slopeStPerSec - 16) * (slopeStPerSec - 16)) / 900) : 1;

  const bStart = loc.brick ? loc.brick.startSec : Math.max(0, timeSec - 0.25), bEnd = loc.brick ? loc.brick.endSec : timeSec + 0.25;
  const halfW = 0.091, wStart = Math.max(bStart, Math.min(bEnd - 2 * halfW, timeSec - halfW)), wEnd = Math.min(bEnd, Math.max(bStart + 2 * halfW, timeSec + halfW));
  const winPts = rawPitchCurve.filter((p) => p.timeSec >= wStart && p.timeSec <= wEnd && p.midiFloat >= 36);
  let slowPitch = rawMidi;
  if (winPts.length >= 2) {
    const n = winPts.length, meanT = winPts.reduce((a, p) => a + p.timeSec, 0) / n, meanY = winPts.reduce((a, p) => a + p.midiFloat, 0) / n;
    let stt = 0, sty = 0;
    for (const p of winPts) { const dt = p.timeSec - meanT; stt += dt * dt; sty += dt * (p.midiFloat - meanY); }
    slowPitch = meanY + Math.max(-1.5, Math.min(1.5, (stt > 1e-6 ? sty / stt : 0) * (timeSec - meanT)));
  }
  return { hasVoicedPitch, rawMidi, ...loc, attackRamp: loc.attackRamp * liaisonStability, driftSemitones: slowPitch - loc.sungMedian, vibratoSemitones: rawMidi - slowPitch };
}

export function computeTargetMidiAtTime(
  decomp: PitchDecompositionPoint, region: MelodyneRegion
): { correctedMidi: number; shiftSemitones: number } {
  if (!decomp.hasVoicedPitch || decomp.inAttackZone) return { correctedMidi: decomp.rawMidi, shiftSemitones: 0 };
  const c = (region.pitchCenterPct ?? 0) / 100, d = (region.driftCorrectionPct ?? 80) / 100, f = (region.flattenPct ?? 0) / 100;
  let centerDelta = foldOctaveDistance(decomp.targetMidi - decomp.sungMedian);
  if (!decomp.isManualMove && !region.targetMidiOverride && Math.abs(centerDelta) > 2.5) centerDelta = 0;
  const targetModel = decomp.sungMedian + c * centerDelta + (1 - d) * decomp.driftSemitones + (1 - f) * decomp.vibratoSemitones;
  const shift = Math.max(-12, Math.min(12, decomp.attackRamp * (targetModel - decomp.rawMidi)));
  return { correctedMidi: decomp.rawMidi + shift, shiftSemitones: shift };
}
