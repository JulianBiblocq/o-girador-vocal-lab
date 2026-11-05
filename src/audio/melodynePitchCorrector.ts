/**
 * melodynePitchCorrector.ts
 * Processeur DSP non-destructif Melodyne Studio 2.0 :
 * Résolution locale brique par brique, décomposition f0(t) à 3 DDL et synthèse TD-PSOLA (< 130 lignes).
 */
import type { PitchCurvePoint, VocalStepData, MelodyneRegion } from '../types/vocalPack.types';
import {
  foldOctaveDistance,
  resolveMelodyneGridGeometry,
  computeIntervalMedianPitch,
  buildNoteBrickSpans,
  resolveLocalBrickTargetAtTime,
  decomposePitchAtTime,
  computeTargetMidiAtTime,
  type NoteBrickSpan,
} from './melodynePitchDecomposer';
import { analyzeVoicingAndEpochs, type TdPsolaAnalysis } from './tdPsolaEpochDetector';
import { applyTdPsolaPitchCorrection, type TdPsolaRegionTarget } from './tdPsolaPitchShifter';

export { foldOctaveDistance };

export interface BrickPitchOffset {
  startSec: number; endSec: number; holdStartSec: number;
  targetMidi: number; sungMedian: number; deltaSemitones: number; effectiveShift: number;
}

export function findTargetMidiForRegion(
  r: MelodyneRegion, allSteps: VocalStepData[], totalDurationSec: number,
  fallbackMidi = 60, tGridStart?: number, gridDur?: number, queryTimeSec?: number
): number {
  if (r.targetMidiOverride && r.targetMidiOverride > 0) return r.targetMidiOverride;
  if (!allSteps || allSteps.length === 0 || totalDurationSec <= 0) return fallbackMidi;
  const bricks = buildNoteBrickSpans(allSteps, [], totalDurationSec, tGridStart, gridDur);
  const t = queryTimeSec !== undefined ? queryTimeSec : (r.startSec + r.endSec) / 2;
  return resolveLocalBrickTargetAtTime(bricks, t, fallbackMidi, r.targetMidiOverride).targetMidi;
}

export function computeRegionMedianPitch(
  rawPitchCurve: PitchCurvePoint[], startSec: number, endSec: number, fallbackMidi = 60
): number {
  return computeIntervalMedianPitch(rawPitchCurve, startSec, endSec, fallbackMidi);
}

function isRegionActive(r: MelodyneRegion): boolean {
  return (r.pitchCenterPct ?? 0) > 0 || (r.driftCorrectionPct ?? 0) > 0 || (r.flattenPct ?? 0) > 0;
}

export function computeCorrectedPitchCurve(
  rawPitchCurve: PitchCurvePoint[], allSteps: VocalStepData[], totalDurationSec: number,
  regions: MelodyneRegion[] = [], tGridStart?: number, gridDur?: number
): PitchCurvePoint[] {
  if (!regions || regions.length === 0 || !rawPitchCurve || rawPitchCurve.length === 0) return rawPitchCurve;
  const activeRegions = regions.filter(isRegionActive);
  if (activeRegions.length === 0) return rawPitchCurve;

  const bricks = buildNoteBrickSpans(allSteps, rawPitchCurve, totalDurationSec, tGridStart, gridDur);
  return rawPitchCurve.map((pt) => {
    if (pt.midiFloat < 36) return pt;
    const r = activeRegions.find((reg) => pt.timeSec >= reg.startSec && pt.timeSec <= reg.endSec);
    if (!r) return pt;
    const decomp = decomposePitchAtTime(rawPitchCurve, bricks, pt.timeSec, Math.round(pt.midiFloat), r.targetMidiOverride);
    const { correctedMidi } = computeTargetMidiAtTime(decomp, r);
    return { timeSec: pt.timeSec, midiFloat: Math.round(correctedMidi * 100) / 100 };
  });
}

export function correctAudioPitchWithMelodyne(
  rawAudio: Float32Array, sampleRate: number, totalDurationSec: number,
  rawPitchCurve: PitchCurvePoint[], allSteps: VocalStepData[], regions: MelodyneRegion[],
  tGridStart?: number, gridDur?: number, precomputedAnalysis?: TdPsolaAnalysis, precomputedBricks?: NoteBrickSpan[]
): Float32Array {
  if (!regions || regions.length === 0 || !rawAudio || rawAudio.length === 0) return new Float32Array(rawAudio);
  const activeRegions = regions.filter(isRegionActive);
  if (activeRegions.length === 0) return new Float32Array(rawAudio);

  const bricks = precomputedBricks ?? buildNoteBrickSpans(allSteps, rawPitchCurve, totalDurationSec, tGridStart, gridDur);
  const analysis = precomputedAnalysis ?? analyzeVoicingAndEpochs(rawAudio, sampleRate, rawPitchCurve, bricks);

  const targets: TdPsolaRegionTarget[] = activeRegions.map((r) => ({
    startSec: r.startSec,
    endSec: r.endSec,
    shiftSemitonesAt: (timeSec: number) => {
      const decomp = decomposePitchAtTime(rawPitchCurve, bricks, timeSec, 60, r.targetMidiOverride);
      return computeTargetMidiAtTime(decomp, r).shiftSemitones;
    },
  }));

  return applyTdPsolaPitchCorrection(rawAudio, sampleRate, analysis, targets);
}

export function ensureRegionForMovedBrick(
  regions: MelodyneRegion[], allSteps: VocalStepData[], rootIdx: number,
  totalDurationSec: number, tGridStart?: number, gridDur?: number
): MelodyneRegion[] {
  if (!allSteps || rootIdx < 0 || rootIdx >= allSteps.length || totalDurationSec <= 0) return regions;
  const geom = resolveMelodyneGridGeometry(allSteps, totalDurationSec, tGridStart, gridDur);
  let ties = 0;
  while (rootIdx + 1 + ties < allSteps.length && (allSteps[rootIdx + 1 + ties].note === '───' || allSteps[rootIdx + 1 + ties].isTie)) ties++;
  const bStart = Math.max(0, Math.round((geom.tGridStart + (rootIdx / allSteps.length) * geom.gridDur) * 1000) / 1000);
  const bEnd = Math.min(totalDurationSec, Math.round((geom.tGridStart + ((rootIdx + 1 + ties) / allSteps.length) * geom.gridDur) * 1000) / 1000);
  const bMid = 0.5 * (bStart + bEnd);
  const covering = regions.find((r) => bMid >= r.startSec && bMid <= r.endSec);
  if (covering) {
    if (covering.pitchCenterPct > 0) return regions;
    return regions.map((r) => (r.id === covering.id ? { ...r, pitchCenterPct: 85, driftCorrectionPct: r.driftCorrectionPct ?? 80, flattenPct: r.flattenPct ?? 0 } : r));
  }
  const adjacent = regions.find((r) => Math.abs(r.endSec - bStart) <= 0.06 || Math.abs(bEnd - r.startSec) <= 0.06);
  if (adjacent) {
    return regions.map((r) => (r.id === adjacent.id ? { ...r, startSec: Math.min(r.startSec, bStart), endSec: Math.max(r.endSec, bEnd) } : r));
  }
  return [
    ...regions,
    {
      id: `mrg_brk_${rootIdx}_${Date.now().toString(36)}`,
      startSec: bStart,
      endSec: Math.max(bStart + 0.05, bEnd),
      pitchCenterPct: 100,
      driftCorrectionPct: 80,
      flattenPct: 0,
    },
  ];
}
