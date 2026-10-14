/**
 * stepQuantizer.ts
 * Quantification MIDI avec règle anti-plosive (30 ms), cœur de voyelle,
 * hystérésis de 35 cents et détection automatique des notes tenues ('───').
 */
import type { PitchCurvePoint, VocalStepData } from '../types/vocalPack.types';
import { midiToNoteName } from '../utils/noteUtils';

export interface QuantizerParams {
  pitchCurve: PitchCurvePoint[];
  bpm: number;
  beatsPerMeasure: number;
  measuresCount: number;
  beatResolutions: number[];
  trimStartSec: number;
  trimEndSec: number;
}

export interface QuantizedGridResult {
  anacrusisSteps: VocalStepData[];
  gridSteps: VocalStepData[];
  totalSteps: number;
}

export function quantizePitchToSteps(params: QuantizerParams): QuantizedGridResult {
  const { pitchCurve, bpm, beatsPerMeasure, measuresCount, beatResolutions, trimStartSec, trimEndSec } = params;

  const beatDuration = 60 / bpm;
  const totalMeasures = 1 + measuresCount; // M-1 + M1..MN

  const allSteps: VocalStepData[] = [];
  let globalStepIndex = 0;
  let previousActiveMidi = -1;

  for (let m = 0; m < totalMeasures; m++) {
    for (let b = 0; b < beatsPerMeasure; b++) {
      const beatGlobalIndex = m * beatsPerMeasure + b;
      const beatStartTime = beatGlobalIndex * beatDuration;
      const resolution = beatResolutions[b] || 4;
      const stepDuration = beatDuration / resolution;

      for (let s = 0; s < resolution; s++) {
        const stepStart = beatStartTime + s * stepDuration;
        const stepEnd = stepStart + stepDuration;

        // Vérification de la fenêtre active Trim
        if (stepEnd <= trimStartSec || stepStart >= trimEndSec) {
          allSteps.push({ stepIndex: globalStepIndex++, active: false, note: '', midiNumber: 0, velocity: 0, decay: stepDuration });
          previousActiveMidi = -1;
          continue;
        }

        // Règle anti-plosives (30 ms) & Cœur de voyelle
        const antiPlosiveMargin = Math.min(0.030, stepDuration * 0.25);
        const exitMargin = Math.min(0.020, stepDuration * 0.20);
        const coreStart = stepStart + antiPlosiveMargin;
        const coreEnd = stepEnd - exitMargin;

        const pointsInCore = pitchCurve.filter((p) => p.timeSec >= coreStart && p.timeSec <= coreEnd);

        if (pointsInCore.length < 2) {
          allSteps.push({ stepIndex: globalStepIndex++, active: false, note: '', midiNumber: 0, velocity: 0, decay: stepDuration });
          previousActiveMidi = -1;
          continue;
        }

        // Médiane des hauteurs dans le cœur de voyelle
        const sortedMidis = pointsInCore.map((p) => p.midiFloat).sort((a, b) => a - b);
        const medianMidi = sortedMidis[Math.floor(sortedMidis.length / 2)];

        // Hystérésis bienveillante de 35 cents pour lisser le vibrato
        let targetMidi: number;
        if (previousActiveMidi > 0 && Math.abs(medianMidi - previousActiveMidi) <= 0.35) {
          targetMidi = previousActiveMidi;
        } else {
          targetMidi = Math.round(medianMidi);
        }

        // Détection des notes tenues ('───')
        const prevStep = allSteps[allSteps.length - 1];
        const isHeldTie = prevStep && prevStep.active && prevStep.midiNumber === targetMidi;

        if (isHeldTie) {
          allSteps.push({
            stepIndex: globalStepIndex++,
            active: true,
            note: '───',
            midiNumber: targetMidi,
            syllable: '',
            velocity: 90,
            decay: stepDuration,
          });
        } else {
          allSteps.push({
            stepIndex: globalStepIndex++,
            active: true,
            note: midiToNoteName(targetMidi),
            midiNumber: targetMidi,
            syllable: '',
            velocity: 100,
            decay: stepDuration,
          });
        }
        previousActiveMidi = targetMidi;
      }
    }
  }

  // Partition Anacrouse (M-1) et Grille principale (M1..MN)
  const anacrusisStepsCount = beatsPerMeasure * (beatResolutions[0] || 4);
  const anacrusisSteps = allSteps.filter((_, idx) => idx < anacrusisStepsCount);
  const gridSteps = allSteps.slice(anacrusisStepsCount).map((st, i) => ({ ...st, stepIndex: i }));

  return {
    anacrusisSteps,
    gridSteps,
    totalSteps: allSteps.length,
  };
}
