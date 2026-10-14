/**
 * stepQuantizer.ts
 * Quantification MIDI avec cœur de voyelle, hystérésis réglable (80 cents),
 * filtre anti-accroc (glitch filter) et intégration de gamme musicale.
 */
import type { PitchCurvePoint, VocalStepData } from '../types/vocalPack.types';
import { midiToNoteName } from '../utils/noteUtils';
import { snapMidiToScale, type ScaleType } from './scaleQuantizer';

export interface QuantizerParams {
  pitchCurve: PitchCurvePoint[];
  bpm: number;
  beatsPerMeasure: number;
  measuresCount: number;
  beatResolutions: number[];
  trimStartSec: number;
  trimEndSec: number;
  smoothingLevel?: number; // 0..1 (défaut 0.5)
  tonic?: string;
  scaleType?: ScaleType;
}

export interface QuantizedGridResult {
  anacrusisSteps: VocalStepData[];
  gridSteps: VocalStepData[];
  totalSteps: number;
}

function filterGlitchesAndHoldTies(steps: VocalStepData[], smoothing: number): VocalStepData[] {
  const result = steps.map((s) => ({ ...s }));

  // 1. Lissage des sauts isolés de 1 ou 2 demi-tons entourés de notes stables
  for (let i = 1; i < result.length - 1; i++) {
    const prev = result[i - 1];
    const curr = result[i];
    const next = result[i + 1];
    if (prev.active && next.active && curr.active && prev.midiNumber === next.midiNumber) {
      if (Math.abs(curr.midiNumber - prev.midiNumber) <= (smoothing >= 0.7 ? 2 : 1)) {
        curr.midiNumber = prev.midiNumber;
        curr.note = '───';
      }
    }
  }

  // 2. Fusion des pas consécutifs très proches (≤ 1 demi-ton) si lissage activé
  if (smoothing >= 0.4) {
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1];
      const curr = result[i];
      if (prev.active && curr.active && Math.abs(curr.midiNumber - prev.midiNumber) <= 1) {
        curr.midiNumber = prev.midiNumber;
        curr.note = '───';
      }
    }
  }

  return result;
}

export function quantizePitchToSteps(params: QuantizerParams): QuantizedGridResult {
  const { pitchCurve, bpm, beatsPerMeasure, measuresCount, beatResolutions, trimStartSec, trimEndSec, smoothingLevel = 0.5, tonic = 'C', scaleType = 'chromatic' } = params;

  const beatDuration = 60 / bpm;
  const totalMeasures = 1 + measuresCount;
  const allSteps: VocalStepData[] = [];
  let globalStepIndex = 0;
  let previousActiveMidi = -1;
  const hysteresisCents = 0.50 + smoothingLevel * 0.40; // 50 à 90 cents

  for (let m = 0; m < totalMeasures; m++) {
    for (let b = 0; b < beatsPerMeasure; b++) {
      const beatStartTime = (m * beatsPerMeasure + b) * beatDuration;
      const resolution = beatResolutions[b] || 4;
      const stepDuration = beatDuration / resolution;

      for (let s = 0; s < resolution; s++) {
        const stepStart = beatStartTime + s * stepDuration;
        const stepEnd = stepStart + stepDuration;

        if (stepEnd <= trimStartSec || stepStart >= trimEndSec) {
          allSteps.push({ stepIndex: globalStepIndex++, active: false, note: '', midiNumber: 0, velocity: 0, decay: stepDuration });
          previousActiveMidi = -1;
          continue;
        }

        const coreStart = stepStart + Math.min(0.030, stepDuration * 0.25);
        const coreEnd = stepEnd - Math.min(0.020, stepDuration * 0.20);
        const points = pitchCurve.filter((p) => p.timeSec >= coreStart && p.timeSec <= coreEnd);

        if (points.length < 2) {
          allSteps.push({ stepIndex: globalStepIndex++, active: false, note: '', midiNumber: 0, velocity: 0, decay: stepDuration });
          previousActiveMidi = -1;
          continue;
        }

        const sorted = points.map((p) => p.midiFloat).sort((a, b) => a - b);
        const medianMidi = sorted[Math.floor(sorted.length / 2)];

        let targetMidi: number;
        if (previousActiveMidi > 0 && Math.abs(medianMidi - previousActiveMidi) <= hysteresisCents) {
          targetMidi = previousActiveMidi;
        } else {
          targetMidi = Math.round(medianMidi);
        }

        if (scaleType !== 'chromatic') {
          targetMidi = snapMidiToScale(targetMidi, tonic, scaleType);
        }

        const prevStep = allSteps[allSteps.length - 1];
        const isTie = prevStep && prevStep.active && prevStep.midiNumber === targetMidi;

        allSteps.push({
          stepIndex: globalStepIndex++,
          active: true,
          note: isTie ? '───' : midiToNoteName(targetMidi),
          midiNumber: targetMidi,
          syllable: '',
          velocity: isTie ? 90 : 100,
          decay: stepDuration,
        });
        previousActiveMidi = targetMidi;
      }
    }
  }

  const smoothed = filterGlitchesAndHoldTies(allSteps, smoothingLevel);
  const anacrusisStepsCount = beatsPerMeasure * (beatResolutions[0] || 4);

  return {
    anacrusisSteps: smoothed.slice(0, anacrusisStepsCount),
    gridSteps: smoothed.slice(anacrusisStepsCount).map((st, i) => ({ ...st, stepIndex: i })),
    totalSteps: smoothed.length,
  };
}
