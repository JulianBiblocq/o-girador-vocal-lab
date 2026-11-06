/**
 * studentPitchAnalyzer.ts
 * Analyse pédagogique 3 piliers (Justesse Cœur de Voyelle + Intervalles mod 12,
 * Attaque compensée en latence \tau_lag, Stabilité) (< 120 lignes).
 */
import type { PitchCurvePoint, VocalStepData } from '../types/vocalPack.types';
import { extractContinuousPitchCurve } from './pitchExtractor';
import {
  computeRobustStudentPitchScore,
  foldStudentPitchToTargetOctave,
} from './studentPerformanceMatcher';

export { foldStudentPitchToTargetOctave };

export interface StudentAnalysisParams {
  rawPCM: Float32Array; sampleRate: number; totalDurationSec: number;
  targetSteps: VocalStepData[]; bpm: number; beatsPerMeasure?: number; shouldAnalyzeNotes: boolean;
}

export interface StudentAnalysisResult {
  studentPitchCurve: PitchCurvePoint[]; okNotes: number; totalNotes: number; accuracyScore: number;
  pitchAccuracyPct: number; avgCentsOffset: number; attackPrecisionPct: number; avgAttackDelayMs: number; stabilityPct: number;
}

export function analyzeStudentTake(params: StudentAnalysisParams): StudentAnalysisResult {
  const { rawPCM, sampleRate, totalDurationSec, targetSteps, bpm, shouldAnalyzeNotes } = params;
  if (!rawPCM || rawPCM.length === 0 || totalDurationSec <= 0) {
    return {
      studentPitchCurve: [], okNotes: 0, totalNotes: 0, accuracyScore: 0,
      pitchAccuracyPct: 0, avgCentsOffset: 0, attackPrecisionPct: 0, avgAttackDelayMs: 0, stabilityPct: 0,
    };
  }

  const rawCurve = extractContinuousPitchCurve(rawPCM, {
    sampleRate, totalDurationSec, trimStartSec: 0, trimEndSec: totalDurationSec,
  });

  const {
    groups, alignedCurve, noteDiffs, recalibBias, coreStds, attackDelaysMs,
  } = computeRobustStudentPitchScore(rawCurve, targetSteps, bpm);

  if (!shouldAnalyzeNotes || groups.length === 0) {
    return {
      studentPitchCurve: alignedCurve, okNotes: 0, totalNotes: 0, accuracyScore: 100,
      pitchAccuracyPct: 100, avgCentsOffset: 0, attackPrecisionPct: 100, avgAttackDelayMs: 0, stabilityPct: 100,
    };
  }

  const totalNotes = noteDiffs.length;
  if (totalNotes === 0) {
    return {
      studentPitchCurve: alignedCurve, okNotes: 0, totalNotes: 0, accuracyScore: 0,
      pitchAccuracyPct: 0, avgCentsOffset: 0, attackPrecisionPct: 0, avgAttackDelayMs: 0, stabilityPct: 0,
    };
  }

  let okNotes = 0, centsSum = 0, pitchScoreSum = 0;
  for (let i = 0; i < totalNotes; i++) {
    const rawDiff = noteDiffs[i];
    const recalDiff = rawDiff - recalibBias;
    // 70 % justesse recalibrée (intervalles relatifs) + 30 % justesse absolue au diapason
    const effErrSt = 0.70 * Math.abs(recalDiff) + 0.30 * Math.abs(rawDiff);
    centsSum += (0.70 * recalDiff + 0.30 * rawDiff) * 100;
    if (effErrSt <= 0.45) okNotes++;
    const noteScore = effErrSt <= 0.12
      ? 100
      : Math.max(0, Math.round(100 * (1 - (effErrSt - 0.12) / 0.88)));
    pitchScoreSum += noteScore;
  }

  const okRatioPct = (okNotes / totalNotes) * 100;
  const contPitchPct = pitchScoreSum / totalNotes;
  const pitchAccuracyPct = Math.round(0.55 * contPitchPct + 0.45 * okRatioPct);
  const avgCentsOffset = Math.round(centsSum / totalNotes);

  let attackScoreSum = 0, attackDelaySumMs = 0;
  for (const delayMs of attackDelaysMs) {
    attackDelaySumMs += delayMs;
    const absMs = Math.abs(delayMs);
    const aScore = absMs <= 25
      ? 100
      : absMs <= 65
        ? Math.round(100 - ((absMs - 25) / 40) * 8)
        : Math.max(0, Math.round(92 * (1 - (absMs - 65) / 185)));
    attackScoreSum += aScore;
  }
  const attackPrecisionPct = attackDelaysMs.length > 0
    ? Math.round(attackScoreSum / attackDelaysMs.length)
    : pitchAccuracyPct;
  const avgAttackDelayMs = attackDelaysMs.length > 0
    ? Math.round(attackDelaySumMs / attackDelaysMs.length)
    : 0;

  let stabilityScoreSum = 0;
  for (const stdCents of coreStds) {
    const stab = stdCents <= 25 ? 100 : Math.max(20, Math.round(100 - (stdCents - 25) * 1.4));
    stabilityScoreSum += stab;
  }
  const stabilityPct = coreStds.length > 0
    ? Math.round(stabilityScoreSum / coreStds.length)
    : pitchAccuracyPct;

  const accuracyScore = Math.round(pitchAccuracyPct * 0.55 + attackPrecisionPct * 0.25 + stabilityPct * 0.20);

  return {
    studentPitchCurve: alignedCurve, okNotes, totalNotes, accuracyScore,
    pitchAccuracyPct, avgCentsOffset, attackPrecisionPct, avgAttackDelayMs, stabilityPct,
  };
}
