/**
 * ambitusSweepAndStairs.ts
 * Analyse du balayage de voix initial (percentiles 10/90 %)
 * et generateur d'escalier de 5 a 6 marches musicales (< 110 lignes).
 */
import type { ValidationSample } from './ambitusValidator';
import { midiToNoteName } from '../utils/noteUtils';

export interface SweepAnalysisResult {
  candidateLowMidi: number;
  candidateHighMidi: number;
  validFramesCount: number;
  hasEnoughPower: boolean;
}

export interface StaircaseStep {
  stepIndex: number;
  midi: number;
  noteName: string;
  durationSec: number;
}

export interface StaircasePlan {
  steps: StaircaseStep[];
  totalDurationSec: number;
  stepDurationSec: number;
}

export function analyzeAmbitusSweep(
  samples: ValidationSample[],
  minProjectionRms: number
): SweepAnalysisResult {
  const voiced = samples.filter((s) => s.pitchMidi >= 36 && s.pitchMidi <= 88 && s.rms >= minProjectionRms * 0.65);

  if (voiced.length < 6) {
    return {
      candidateLowMidi: 55, // G3 (Sol3) par defaut
      candidateHighMidi: 67, // G4 (Sol4) par defaut
      validFramesCount: voiced.length,
      hasEnoughPower: false,
    };
  }

  const sortedPitches = voiced.map((s) => s.pitchMidi).sort((a, b) => a - b);
  const p10Index = Math.min(sortedPitches.length - 1, Math.floor(sortedPitches.length * 0.10));
  const p90Index = Math.min(sortedPitches.length - 1, Math.floor(sortedPitches.length * 0.90));

  let low = Math.round(sortedPitches[p10Index]);
  let high = Math.round(sortedPitches[p90Index]);

  low = Math.max(38, Math.min(72, low));
  high = Math.max(low + 4, Math.min(84, high));

  return {
    candidateLowMidi: low,
    candidateHighMidi: high,
    validFramesCount: voiced.length,
    hasEnoughPower: true,
  };
}

export function buildAmbitusStaircase(
  lowMidi: number,
  highMidi: number,
  count = 5,
  stepDurationSec = 1.8
): StaircasePlan {
  const numSteps = Math.max(4, Math.min(7, count));
  const span = Math.max(numSteps - 1, highMidi - lowMidi);
  const steps: StaircaseStep[] = [];

  for (let i = 0; i < numSteps; i++) {
    const rawMidi = lowMidi + Math.round((span * i) / (numSteps - 1));
    const midi = Math.min(highMidi, Math.max(lowMidi, rawMidi));
    steps.push({
      stepIndex: i,
      midi,
      noteName: midiToNoteName(midi),
      durationSec: stepDurationSec,
    });
  }

  return {
    steps,
    totalDurationSec: numSteps * stepDurationSec,
    stepDurationSec,
  };
}
