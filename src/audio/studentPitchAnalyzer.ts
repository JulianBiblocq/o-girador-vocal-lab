/**
 * studentPitchAnalyzer.ts
 * Analyse pédagogique 3 piliers (🎯 Justesse avec invariance d'octave mod 12, 🥁 Attaque rythmique, 🌬️ Tenue) (< 130 lignes).
 */
import type { PitchCurvePoint, VocalStepData } from '../types/vocalPack.types';
import { extractContinuousPitchCurve } from './pitchExtractor';

export interface StudentAnalysisParams {
  rawPCM: Float32Array; sampleRate: number; totalDurationSec: number;
  targetSteps: VocalStepData[]; bpm: number; beatsPerMeasure?: number; shouldAnalyzeNotes: boolean;
}

export interface StudentAnalysisResult {
  studentPitchCurve: PitchCurvePoint[]; okNotes: number; totalNotes: number; accuracyScore: number;
  pitchAccuracyPct: number; avgCentsOffset: number; attackPrecisionPct: number; avgAttackDelayMs: number; stabilityPct: number;
}

export function foldStudentPitchToTargetOctave(studentMidiFloat: number, targetMidi: number): number {
  if (studentMidiFloat <= 0 || targetMidi <= 0) return studentMidiFloat;
  let d = studentMidiFloat - targetMidi;
  while (d > 6) d -= 12;
  while (d < -6) d += 12;
  return targetMidi + d;
}

interface TargetNoteGroup {
  startStep: number; endStep: number; tStart: number; tEnd: number; midiNumber: number; stepsCount: number;
}

function buildTargetNoteGroups(targetSteps: VocalStepData[], stepDurSec: number): TargetNoteGroup[] {
  const groups: TargetNoteGroup[] = [];
  for (let i = 0; i < targetSteps.length; i++) {
    const s = targetSteps[i];
    if (!s.active || s.midiNumber <= 0 || s.note === '───') continue;
    let ties = 0;
    while (i + 1 + ties < targetSteps.length && targetSteps[i + 1 + ties].note === '───') ties++;
    const endStep = i + ties;
    groups.push({
      startStep: i,
      endStep,
      tStart: i * stepDurSec,
      tEnd: (endStep + 1) * stepDurSec,
      midiNumber: s.midiNumber,
      stepsCount: 1 + ties,
    });
    i += ties;
  }
  return groups;
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

  const stepDurSec = (60 / Math.max(30, bpm)) / 4;
  const groups = buildTargetNoteGroups(targetSteps, stepDurSec);
  const medianTargetMidi = groups.length > 0
    ? groups[Math.floor(groups.length / 2)].midiNumber
    : 60;

  const studentPitchCurve: PitchCurvePoint[] = rawCurve.map((pt) => {
    const grp = groups.find((g) => pt.timeSec >= g.tStart - 0.08 && pt.timeSec <= g.tEnd + 0.08);
    const refMidi = grp ? grp.midiNumber : medianTargetMidi;
    return { timeSec: pt.timeSec, midiFloat: foldStudentPitchToTargetOctave(pt.midiFloat, refMidi) };
  });

  if (!shouldAnalyzeNotes || groups.length === 0) {
    return {
      studentPitchCurve, okNotes: 0, totalNotes: 0, accuracyScore: 100,
      pitchAccuracyPct: 100, avgCentsOffset: 0, attackPrecisionPct: 100, avgAttackDelayMs: 0, stabilityPct: 100,
    };
  }

  let okNotes = 0, totalNotes = 0;
  let centsSum = 0, attackScoreSum = 0, attackDelaySumMs = 0, attackCount = 0;
  let stabilityScoreSum = 0, stabilityCount = 0;

  for (const grp of groups) {
    const inWindow = studentPitchCurve.filter((p) => p.timeSec >= grp.tStart && p.timeSec <= grp.tEnd);
    if (inWindow.length === 0) continue;

    totalNotes++;
    const diffs = inWindow.map((p) => p.midiFloat - grp.midiNumber);
    const avgDiffSt = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    centsSum += avgDiffSt * 100;
    if (Math.abs(avgDiffSt) <= 0.45) okNotes++;

    const onsetPt = studentPitchCurve.find((p) => p.timeSec >= grp.tStart - 0.10 && p.timeSec <= grp.tEnd);
    if (onsetPt) {
      const delayMs = (onsetPt.timeSec - grp.tStart) * 1000;
      attackDelaySumMs += delayMs;
      const absMs = Math.abs(delayMs);
      const aScore = absMs <= 65 ? 100 : Math.max(0, Math.round(100 * (1 - (absMs - 65) / 185)));
      attackScoreSum += aScore;
      attackCount++;
    }

    if (grp.stepsCount >= 2 && inWindow.length >= 2) {
      const variance = diffs.reduce((acc, d) => acc + Math.pow((d - avgDiffSt) * 100, 2), 0) / diffs.length;
      const stdCents = Math.sqrt(variance);
      const stab = stdCents <= 25 ? 100 : Math.max(20, Math.round(100 - (stdCents - 25) * 1.4));
      stabilityScoreSum += stab;
      stabilityCount++;
    }
  }

  const pitchAccuracyPct = totalNotes > 0 ? Math.round((okNotes / totalNotes) * 100) : 0;
  const avgCentsOffset = totalNotes > 0 ? Math.round(centsSum / totalNotes) : 0;
  const attackPrecisionPct = attackCount > 0 ? Math.round(attackScoreSum / attackCount) : pitchAccuracyPct;
  const avgAttackDelayMs = attackCount > 0 ? Math.round(attackDelaySumMs / attackCount) : 0;
  const stabilityPct = stabilityCount > 0 ? Math.round(stabilityScoreSum / stabilityCount) : pitchAccuracyPct;
  const accuracyScore = Math.round(pitchAccuracyPct * 0.55 + attackPrecisionPct * 0.25 + stabilityPct * 0.20);

  return {
    studentPitchCurve, okNotes, totalNotes, accuracyScore,
    pitchAccuracyPct, avgCentsOffset, attackPrecisionPct, avgAttackDelayMs, stabilityPct,
  };
}
