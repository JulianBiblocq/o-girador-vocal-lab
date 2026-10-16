/**
 * melodynePitchCorrector.ts
 * Processeur DSP non-destructif par Régions Melodyne [ In ── Out ] :
 * Centrage vers la note cible, aplatissement du vibrato/fluctuations et WSOLA (< 140 lignes).
 */
import type { PitchCurvePoint, VocalStepData, MelodyneRegion } from '../types/vocalPack.types';
import { applyWsolaPitchCorrection } from './wsolaPitchShifter';

export interface BrickPitchOffset {
  startSec: number;
  endSec: number;
  holdStartSec: number;
  targetMidi: number;
  sungMedian: number;
  deltaSemitones: number;
  effectiveShift: number;
}

export function findTargetMidiForRegion(
  r: MelodyneRegion,
  allSteps: VocalStepData[],
  totalDurationSec: number,
  fallbackMidi = 60
): number {
  if (r.targetMidiOverride && r.targetMidiOverride > 0) return r.targetMidiOverride;
  if (!allSteps || allSteps.length === 0 || totalDurationSec <= 0) return fallbackMidi;

  const midSec = (r.startSec + r.endSec) / 2;
  const stepIdx = Math.max(0, Math.min(allSteps.length - 1, Math.floor((midSec / totalDurationSec) * allSteps.length)));
  const step = allSteps[stepIdx];
  if (step?.active && step.midiNumber > 0) return step.midiNumber;

  // Recherche du pas actif le plus proche
  let bestMidi = fallbackMidi, minDist = Infinity;
  for (let i = 0; i < allSteps.length; i++) {
    const s = allSteps[i];
    if (s.active && s.midiNumber > 0) {
      const sTime = (i / allSteps.length) * totalDurationSec;
      const dist = Math.abs(sTime - midSec);
      if (dist < minDist) { minDist = dist; bestMidi = s.midiNumber; }
    }
  }
  return bestMidi;
}

export function computeRegionMedianPitch(
  rawPitchCurve: PitchCurvePoint[],
  startSec: number,
  endSec: number,
  fallbackMidi = 60
): number {
  const pts = rawPitchCurve.filter((p) => p.timeSec >= startSec && p.timeSec <= endSec && p.midiFloat >= 36);
  if (pts.length === 0) return fallbackMidi;
  const sorted = pts.map((p) => p.midiFloat).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function foldOctaveDistance(delta: number): number {
  return delta - 12 * Math.round(delta / 12);
}

export function computeCorrectedPitchCurve(
  rawPitchCurve: PitchCurvePoint[],
  allSteps: VocalStepData[],
  totalDurationSec: number,
  regions: MelodyneRegion[] = []
): PitchCurvePoint[] {
  if (!regions || regions.length === 0 || rawPitchCurve.length === 0) return rawPitchCurve;

  return rawPitchCurve.map((pt) => {
    const r = regions.find((reg) => pt.timeSec >= reg.startSec && pt.timeSec <= reg.endSec);
    if (!r) return pt;

    const targetMidi = findTargetMidiForRegion(r, allSteps, totalDurationSec, Math.round(pt.midiFloat));
    const median = computeRegionMedianPitch(rawPitchCurve, r.startSec, r.endSec, targetMidi);
    const d = pt.midiFloat - median;
    const c = r.pitchCenterPct / 100;
    const f = r.flattenPct / 100;
    const deltaFolded = foldOctaveDistance(targetMidi - median);
    const newMidi = median + c * deltaFolded + (1 - f) * d;

    return { timeSec: pt.timeSec, midiFloat: Math.round(newMidi * 100) / 100 };
  });
}

export function correctAudioPitchWithMelodyne(
  rawAudio: Float32Array,
  sampleRate: number,
  totalDurationSec: number,
  rawPitchCurve: PitchCurvePoint[],
  allSteps: VocalStepData[],
  regions: MelodyneRegion[]
): Float32Array {
  if (!regions || regions.length === 0 || !rawAudio || rawAudio.length === 0) {
    return new Float32Array(rawAudio);
  }

  const offsets: BrickPitchOffset[] = [];
  const chunkDurationSec = 0.050; // Tranches temporelles de 50 ms pour modulation fine

  for (const r of regions) {
    if (r.pitchCenterPct === 0 && r.flattenPct === 0) continue;
    const targetMidi = findTargetMidiForRegion(r, allSteps, totalDurationSec);
    const median = computeRegionMedianPitch(rawPitchCurve, r.startSec, r.endSec, targetMidi);
    const c = r.pitchCenterPct / 100;
    const f = r.flattenPct / 100;
    const deltaFolded = foldOctaveDistance(targetMidi - median);

    let curT = r.startSec;
    while (curT < r.endSec) {
      const nextT = Math.min(r.endSec, curT + chunkDurationSec);
      const subPts = rawPitchCurve.filter((p) => p.timeSec >= curT && p.timeSec <= nextT && p.midiFloat >= 36);
      const subMidi = subPts.length > 0
        ? subPts.reduce((acc, p) => acc + p.midiFloat, 0) / subPts.length
        : median;

      const d = subMidi - median;
      const targetSub = median + c * deltaFolded + (1 - f) * d;
      const shift = Math.max(-3.0, Math.min(3.0, targetSub - subMidi));

      offsets.push({
        startSec: curT,
        endSec: nextT,
        holdStartSec: curT,
        targetMidi,
        sungMedian: subMidi,
        deltaSemitones: shift,
        effectiveShift: shift,
      });
      curT = nextT;
    }
  }

  if (offsets.length === 0) return new Float32Array(rawAudio);
  return applyWsolaPitchCorrection(rawAudio, sampleRate, offsets);
}
