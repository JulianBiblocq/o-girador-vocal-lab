/**
 * studentPerformanceMatcher.ts
 * Suivi causal Bayésien temps réel (Gate consonantique + Kalman 1D), estimation automatique
 * de latence système (\tau_lag) et évaluation sur le Cœur de Voyelle + Intervalles (< 138 lignes).
 */
import type { PitchCurvePoint, VocalStepData } from '../types/vocalPack.types';

export interface TargetNoteGroup {
  startStep: number; endStep: number; tStart: number; tEnd: number; midiNumber: number; stepsCount: number;
}

export function foldStudentPitchToTargetOctave(studentMidiFloat: number, targetMidi: number): number {
  if (studentMidiFloat <= 0 || targetMidi <= 0) return studentMidiFloat;
  let d = studentMidiFloat - targetMidi;
  while (d > 6) d -= 12;
  while (d < -6) d += 12;
  return targetMidi + d;
}

export function buildTargetNoteGroups(targetSteps: VocalStepData[], stepDurSec: number): TargetNoteGroup[] {
  const groups: TargetNoteGroup[] = [];
  for (let i = 0; i < targetSteps.length; i++) {
    const s = targetSteps[i];
    if (!s.active || s.midiNumber <= 0 || s.note === '───') continue;
    let ties = 0;
    while (i + 1 + ties < targetSteps.length && targetSteps[i + 1 + ties].note === '───') ties++;
    const endStep = i + ties;
    groups.push({ startStep: i, endStep, tStart: i * stepDurSec, tEnd: (endStep + 1) * stepDurSec, midiNumber: s.midiNumber, stepsCount: 1 + ties });
    i += ties;
  }
  return groups;
}

export class CausalStudentPitchTracker {
  private estMidi = 0;
  private errVar = 1.0;
  private lastVoicedSec = -10;

  public update(
    timeSec: number, rawMidi: number, rms: number, clarity = 0.85, zcr = 0.08, targetMidi = 0
  ): PitchCurvePoint | undefined {
    const isConsonantOrWeak = rms < 0.01 || zcr > 0.22 || clarity < 0.72 || rawMidi <= 0;
    if (isConsonantOrWeak) {
      if (this.estMidi > 0 && timeSec - this.lastVoicedSec <= 0.045 && rms >= 0.008) return { timeSec, midiFloat: this.estMidi };
      return undefined;
    }
    const refMidi = targetMidi > 0 ? targetMidi : (this.estMidi > 0 ? this.estMidi : rawMidi);
    const folded = foldStudentPitchToTargetOctave(rawMidi, refMidi);
    if (this.estMidi <= 0 || timeSec - this.lastVoicedSec > 0.22) {
      this.estMidi = folded; this.errVar = 0.25;
    } else {
      const predVar = this.errVar + 0.04, measNoise = Math.max(0.03, (1 - clarity) * 0.6);
      const gain = predVar / (predVar + measNoise);
      this.estMidi = this.estMidi + gain * (folded - this.estMidi);
      this.errVar = (1 - gain) * predVar;
    }
    this.lastVoicedSec = timeSec;
    return { timeSec, midiFloat: this.estMidi };
  }
}

export function estimateStudentSystemLagSec(rawCurve: PitchCurvePoint[], groups: TargetNoteGroup[]): number {
  if (rawCurve.length === 0 || groups.length === 0) return 0;
  let bestLag = 0, bestScore = -1e9;
  for (let lagMs = -80; lagMs <= 200; lagMs += 2) {
    const lag = lagMs / 1000;
    let score = 0;
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi], tIn = g.tStart + lag, tOut = g.tEnd + lag;
      const coreIn = Math.min(tOut - 0.01, tIn + 0.045), coreOut = Math.max(coreIn + 0.01, tOut - 0.030);
      let inCount = 0;
      for (let i = 0; i < rawCurve.length; i++) {
        const pt = rawCurve[i];
        if (pt.timeSec >= tIn && pt.timeSec <= tOut) {
          inCount++; score += 0.35;
          if (pt.timeSec >= coreIn && pt.timeSec <= coreOut) {
            const diff = Math.abs(foldStudentPitchToTargetOctave(pt.midiFloat, g.midiNumber) - g.midiNumber);
            score += 1.4 - 2.2 * Math.min(1.5, diff * diff);
          }
        }
        if (pt.timeSec >= tIn - 0.05 && pt.timeSec <= tIn + 0.06) {
          const prev = i > 0 ? rawCurve[i - 1] : null;
          if (!prev || pt.timeSec - prev.timeSec >= 0.025) {
            const dt = pt.timeSec - tIn;
            score += 3.0 * Math.exp(-(dt * dt) / (2 * 0.016 * 0.016));
          }
        }
      }
      if (inCount === 0) score -= 1.0;
    }
    score -= Math.abs(lag) * 0.08;
    if (score > bestScore) { bestScore = score; bestLag = lag; }
  }
  return bestLag;
}

export function computeRobustStudentPitchScore(rawCurve: PitchCurvePoint[], targetSteps: VocalStepData[], bpm: number) {
  const stepDurSec = (60 / Math.max(30, bpm)) / 4;
  const groups = buildTargetNoteGroups(targetSteps, stepDurSec);
  const lagSec = estimateStudentSystemLagSec(rawCurve, groups);
  const medianTarget = groups.length > 0 ? groups[Math.floor(groups.length / 2)].midiNumber : 60;

  const alignedCurve: PitchCurvePoint[] = rawCurve.map((pt) => {
    const t = Math.max(0, pt.timeSec - lagSec);
    const grp = groups.find((g) => t >= g.tStart - 0.04 && t <= g.tEnd + 0.04);
    return { timeSec: t, midiFloat: foldStudentPitchToTargetOctave(pt.midiFloat, grp ? grp.midiNumber : medianTarget) };
  });

  const noteDiffs: number[] = [], coreStds: number[] = [], attackDelaysMs: number[] = [];
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    const allIn = alignedCurve.filter((p) => p.timeSec >= g.tStart - 0.015 && p.timeSec <= g.tEnd + 0.015);
    if (allIn.length === 0) continue;
    const core = allIn.filter((p) => p.timeSec >= g.tStart + 0.045 && p.timeSec <= g.tEnd - 0.030);
    const used = core.length >= 2 ? core : allIn;
    const sortedDiffs = used.map((p) => p.midiFloat - g.midiNumber).sort((a, b) => a - b);
    const medDiff = sortedDiffs[Math.floor(sortedDiffs.length / 2)];
    noteDiffs.push(medDiff);
    if (g.stepsCount >= 2 && used.length >= 2) {
      const v = used.reduce((acc, p) => acc + Math.pow((p.midiFloat - g.midiNumber - medDiff) * 100, 2), 0) / used.length;
      coreStds.push(Math.sqrt(v));
    }
    let onsetSec: number | null = null;
    for (let i = 0; i < alignedCurve.length; i++) {
      const pt = alignedCurve[i];
      if (pt.timeSec < g.tStart - 0.07 || pt.timeSec > g.tEnd) continue;
      const prev = i > 0 ? alignedCurve[i - 1] : null;
      if (!prev || pt.timeSec - prev.timeSec >= 0.025 || pt.timeSec >= g.tStart - 0.015) { onsetSec = pt.timeSec; break; }
    }
    if (onsetSec !== null) attackDelaysMs.push((onsetSec - g.tStart) * 1000);
  }

  const sortedGlobal = [...noteDiffs].sort((a, b) => a - b);
  const globalBias = sortedGlobal.length > 0 ? sortedGlobal[Math.floor(sortedGlobal.length / 2)] : 0;
  const recalibBias = Math.abs(globalBias) <= 0.40 ? globalBias : 0;
  return { groups, alignedCurve, lagSec, noteDiffs, recalibBias, coreStds, attackDelaysMs };
}
