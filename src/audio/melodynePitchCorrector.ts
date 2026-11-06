/**
 * melodynePitchCorrector.ts
 * Processeur DSP non-destructif Melodyne Studio / Cubase VariAudio par brique :
 * Résolution locale brique par brique (melodynePullPct 0..100%), décomposition f0(t) C1 Hermite (35 ms) et synthèse TD-PSOLA (< 130 lignes).
 */
import type { PitchCurvePoint, VocalStepData, MelodyneRegion } from '../types/vocalPack.types';
import {
  foldOctaveDistance, resolveMelodyneGridGeometry, computeIntervalMedianPitch, buildNoteBrickSpans,
  resolveLocalBrickTargetAtTime, decomposePitchAtTime, computeTargetMidiAtTime, type NoteBrickSpan,
} from './melodynePitchDecomposer';
import { analyzeVoicingAndEpochs, type TdPsolaAnalysis } from './tdPsolaEpochDetector';
import { applyTdPsolaPitchCorrection, smoothShiftFramesZeroPhase, type TdPsolaRegionTarget } from './tdPsolaPitchShifter';

export { foldOctaveDistance };

export interface BrickPitchOffset {
  startSec: number; endSec: number; holdStartSec: number;
  targetMidi: number; sungMedian: number; deltaSemitones: number; effectiveShift: number;
}

export function buildBrickVariAudioRegions(
  allSteps: VocalStepData[], totalDurationSec: number, tGridStart?: number, gridDur?: number
): MelodyneRegion[] {
  if (!allSteps || allSteps.length === 0 || totalDurationSec <= 0) return [];
  const geom = resolveMelodyneGridGeometry(allSteps, totalDurationSec, tGridStart, gridDur);
  const out: MelodyneRegion[] = [];
  for (let i = 0; i < allSteps.length; i++) {
    const st = allSteps[i];
    if (!st.active || st.note === '───') continue;
    let ties = 0;
    while (i + 1 + ties < allSteps.length && (allSteps[i + 1 + ties].note === '───' || allSteps[i + 1 + ties].isTie)) ties++;
    const pull = Math.max(0, Math.min(100, Math.round(st.melodynePullPct ?? 0)));
    if (pull > 0) {
      const bStart = Math.max(0, Math.round((geom.tGridStart + (i / allSteps.length) * geom.gridDur) * 1000) / 1000);
      const bEnd = Math.min(totalDurationSec, Math.round((geom.tGridStart + ((i + 1 + ties) / allSteps.length) * geom.gridDur) * 1000) / 1000);
      out.push({
        id: `variaudio_brk_${i}`, startSec: bStart, endSec: Math.max(bStart + 0.04, bEnd),
        pitchCenterPct: pull, driftCorrectionPct: Math.round(pull * 0.85), flattenPct: Math.round(pull * 0.35),
        targetMidiOverride: st.midiNumber,
      });
    }
    i += ties;
  }
  return out;
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

function hermiteBorderWeight(timeSec: number, startSec: number, endSec: number, rampSec = 0.035): number {
  const dur = endSec - startSec;
  if (dur <= 0 || timeSec < startSec || timeSec > endSec) return 0;
  const effRamp = Math.min(rampSec, dur * 0.35);
  if (effRamp <= 1e-4) return 1;
  if (timeSec < startSec + effRamp) { const u = (timeSec - startSec) / effRamp; return u * u * (3 - 2 * u); }
  if (timeSec > endSec - effRamp) { const u = (endSec - timeSec) / effRamp; return u * u * (3 - 2 * u); }
  return 1;
}

export function computeCorrectedPitchCurve(
  rawPitchCurve: PitchCurvePoint[], allSteps: VocalStepData[], totalDurationSec: number,
  regions: MelodyneRegion[] = [], tGridStart?: number, gridDur?: number
): PitchCurvePoint[] {
  if (!rawPitchCurve || rawPitchCurve.length === 0) return rawPitchCurve;
  const brickRegions = buildBrickVariAudioRegions(allSteps, totalDurationSec, tGridStart, gridDur);
  const activeRegions = [...brickRegions, ...(regions || [])].filter(isRegionActive);
  if (activeRegions.length === 0) return rawPitchCurve;

  const bricks = buildNoteBrickSpans(allSteps, rawPitchCurve, totalDurationSec, tGridStart, gridDur);
  const rawShifts = new Float32Array(rawPitchCurve.length);
  const activeMask = new Uint8Array(rawPitchCurve.length);
  for (let i = 0; i < rawPitchCurve.length; i++) {
    const pt = rawPitchCurve[i];
    if (pt.midiFloat < 36) continue;
    const r = activeRegions.find((reg) => pt.timeSec >= reg.startSec && pt.timeSec <= reg.endSec);
    if (!r) continue;
    activeMask[i] = 1;
    const decomp = decomposePitchAtTime(rawPitchCurve, bricks, pt.timeSec, Math.round(pt.midiFloat), r.targetMidiOverride);
    const w = hermiteBorderWeight(pt.timeSec, r.startSec, r.endSec, 0.035);
    rawShifts[i] = computeTargetMidiAtTime(decomp, r).shiftSemitones * w;
  }
  const smoothed = smoothShiftFramesZeroPhase(rawShifts, 1);
  return rawPitchCurve.map((pt, i) => (pt.midiFloat < 36 || !activeMask[i] ? pt : { timeSec: pt.timeSec, midiFloat: Math.round((pt.midiFloat + smoothed[i]) * 100) / 100 }));
}

export function correctAudioPitchWithMelodyne(
  rawAudio: Float32Array, sampleRate: number, totalDurationSec: number,
  rawPitchCurve: PitchCurvePoint[], allSteps: VocalStepData[], regions: MelodyneRegion[],
  tGridStart?: number, gridDur?: number, precomputedAnalysis?: TdPsolaAnalysis, precomputedBricks?: NoteBrickSpan[]
): Float32Array {
  if (!rawAudio || rawAudio.length === 0) return new Float32Array(rawAudio);
  const brickRegions = buildBrickVariAudioRegions(allSteps, totalDurationSec, tGridStart, gridDur);
  const activeRegions = [...brickRegions, ...(regions || [])].filter(isRegionActive);
  if (activeRegions.length === 0) return new Float32Array(rawAudio);

  const bricks = precomputedBricks ?? buildNoteBrickSpans(allSteps, rawPitchCurve, totalDurationSec, tGridStart, gridDur);
  const analysis = precomputedAnalysis ?? analyzeVoicingAndEpochs(rawAudio, sampleRate, rawPitchCurve, bricks);

  const targets: TdPsolaRegionTarget[] = activeRegions.map((r) => ({
    startSec: r.startSec,
    endSec: r.endSec,
    shiftSemitonesAt: (timeSec: number) => {
      const decomp = decomposePitchAtTime(rawPitchCurve, bricks, timeSec, 60, r.targetMidiOverride);
      const w = hermiteBorderWeight(timeSec, r.startSec, r.endSec, 0.035);
      return computeTargetMidiAtTime(decomp, r).shiftSemitones * w;
    },
  }));

  return applyTdPsolaPitchCorrection(rawAudio, sampleRate, analysis, targets);
}

export function ensureRegionForMovedBrick(
  regions: MelodyneRegion[], allSteps: VocalStepData[], rootIdx: number,
  totalDurationSec: number, tGridStart?: number, gridDur?: number
): MelodyneRegion[] {
  if (!allSteps || rootIdx < 0 || rootIdx >= allSteps.length || totalDurationSec <= 0) return regions;
  // Si melodynePullPct === 0 (défaut), bouger la brique ajuste uniquement la note MIDI sans toucher à la voix !
  return buildBrickVariAudioRegions(allSteps, totalDurationSec, tGridStart, gridDur);
}
