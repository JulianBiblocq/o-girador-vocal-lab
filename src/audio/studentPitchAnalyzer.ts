/**
 * studentPitchAnalyzer.ts
 * Analyse comparative de justesse "Zero Rouge" (<= 45 cents = vert, > 45 cents = ambre).
 * Calcule le score global de justesse sans stigmatisation punitive.
 */
import type { PitchCurvePoint, VocalStepData } from '../types/vocalPack.types';
import { extractContinuousPitchCurve } from './pitchExtractor';

export interface StudentAnalysisParams {
  rawPCM: Float32Array;
  sampleRate: number;
  totalDurationSec: number;
  targetSteps: VocalStepData[];
  bpm: number;
  beatsPerMeasure?: number;
  shouldAnalyzeNotes: boolean;
}

export interface StudentAnalysisResult {
  studentPitchCurve: PitchCurvePoint[];
  okNotes: number;
  totalNotes: number;
  accuracyScore: number;
}

export function analyzeStudentTake(params: StudentAnalysisParams): StudentAnalysisResult {
  const { rawPCM, sampleRate, totalDurationSec, targetSteps, bpm, shouldAnalyzeNotes } = params;
  if (!rawPCM || rawPCM.length === 0 || totalDurationSec <= 0) {
    return { studentPitchCurve: [], okNotes: 0, totalNotes: 0, accuracyScore: 0 };
  }

  // 1. Extraction de la courbe continue de l'eleve
  const studentPitchCurve = extractContinuousPitchCurve(rawPCM, {
    sampleRate,
    totalDurationSec,
    trimStartSec: 0,
    trimEndSec: totalDurationSec,
  });

  if (!shouldAnalyzeNotes || targetSteps.length === 0) {
    return { studentPitchCurve, okNotes: 0, totalNotes: 0, accuracyScore: 100 };
  }

  // 2. Evaluation de justesse sur chaque note cible chantee
  const stepDurSec = (60 / bpm) / 4;
  let okNotes = 0;
  let totalNotes = 0;

  for (let i = 0; i < targetSteps.length; i++) {
    const step = targetSteps[i];
    if (!step.active || step.midiNumber <= 0 || step.note === '───') continue;

    const tStart = i * stepDurSec;
    const tEnd = (i + 1) * stepDurSec;

    // Echantillons de pitch de l'eleve dans la fenetre temporelle de la note
    const inWindow = studentPitchCurve.filter((p) => p.timeSec >= tStart && p.timeSec <= tEnd);
    if (inWindow.length === 0) continue;

    totalNotes++;
    const avgStudentMidi = inWindow.reduce((acc, p) => acc + p.midiFloat, 0) / inWindow.length;
    const diffSemitones = Math.abs(avgStudentMidi - step.midiNumber);

    // Seuil de justesse bienveillant : 45 cents (0.45 demi-ton)
    if (diffSemitones <= 0.45) {
      okNotes++;
    }
  }

  const accuracyScore = totalNotes > 0 ? Math.round((okNotes / totalNotes) * 100) : 100;
  return { studentPitchCurve, okNotes, totalNotes, accuracyScore };
}
