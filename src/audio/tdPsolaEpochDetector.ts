/**
 * tdPsolaEpochDetector.ts
 * Détection d'époques glottiques (GCI) par filtrage passe-bande de fondamentale à phase nulle (80–900 Hz)
 * et programmation dynamique synchrone à la période T0 (< 130 lignes).
 */
import type { PitchCurvePoint } from '../types/vocalPack.types';
import type { NoteBrickSpan } from './melodynePitchDecomposer';

export interface TdPsolaAnalysis {
  voicedMask: Uint8Array; voicedWeight: Float32Array; framePeriods: Float32Array; hopSamples: number; epochs: Int32Array;
}

function findNearestCurveMidi(curve: PitchCurvePoint[], timeSec: number): { found: boolean; midi: number } {
  if (!curve || curve.length === 0) return { found: false, midi: 60 };
  let left = 0, right = curve.length - 1;
  while (left <= right) {
    const mid = (left + right) >> 1;
    if (curve[mid].timeSec < timeSec) left = mid + 1;
    else right = mid - 1;
  }
  let bestDiff = Infinity, bestMidi = 60;
  for (let k = Math.max(0, left - 2); k <= Math.min(curve.length - 1, left + 2); k++) {
    const pt = curve[k];
    if (pt.midiFloat < 36) continue;
    const diff = Math.abs(pt.timeSec - timeSec);
    if (diff < bestDiff) { bestDiff = diff; bestMidi = pt.midiFloat; }
  }
  return { found: bestDiff <= 0.018, midi: bestMidi };
}

function isInsideProtectedAttack(bricks: NoteBrickSpan[], timeSec: number): boolean {
  for (let i = 0; i < bricks.length; i++) {
    const b = bricks[i];
    if (b.attackEndSec > b.startSec && timeSec >= b.startSec && timeSec < b.attackEndSec) return true;
  }
  return false;
}

function filterZeroPhaseFundamentalBand(rawAudio: Float32Array, sampleRate: number): Float32Array {
  const n = rawAudio.length, buf = new Float32Array(n);
  if (n < 4 || sampleRate <= 0) return new Float32Array(rawAudio);
  const hpA = Math.exp((-2 * Math.PI * 80) / sampleRate), lpA = Math.exp((-2 * Math.PI * 900) / sampleRate);
  let hp = 0, xPrev = rawAudio[0], lp = 0;
  for (let i = 0; i < n; i++) {
    const x = rawAudio[i]; hp = hpA * (hp + x - xPrev); xPrev = x; lp = lpA * lp + (1 - lpA) * hp; buf[i] = lp;
  }
  hp = 0; xPrev = buf[n - 1]; lp = 0;
  for (let i = n - 1; i >= 0; i--) {
    const x = buf[i]; hp = hpA * (hp + x - xPrev); xPrev = x; lp = lpA * lp + (1 - lpA) * hp; buf[i] = lp;
  }
  return buf;
}

export function analyzeVoicingAndEpochs(
  rawAudio: Float32Array, sampleRate: number, rawPitchCurve: PitchCurvePoint[], bricks: NoteBrickSpan[] = []
): TdPsolaAnalysis {
  const n = rawAudio.length, hopSamples = Math.max(1, Math.round(sampleRate * 0.005)), numFrames = Math.ceil(n / hopSamples);
  const frameVoiced = new Uint8Array(numFrames), framePeriods = new Float32Array(numFrames);
  const zcrHalfWin = Math.max(16, Math.round(sampleRate * 0.006)), minPeriod = sampleRate / 900, maxPeriod = sampleRate / 65;
  let lastValidPeriod = sampleRate / 220;

  for (let f = 0; f < numFrames; f++) {
    const center = Math.min(n - 1, f * hopSamples + (hopSamples >> 1)), timeSec = center / sampleRate;
    const pitchInfo = findNearestCurveMidi(rawPitchCurve, timeSec);
    if (pitchInfo.found) lastValidPeriod = Math.max(minPeriod, Math.min(maxPeriod, sampleRate / (440 * Math.pow(2, (pitchInfo.midi - 69) / 12))));
    framePeriods[f] = lastValidPeriod;
    if (!pitchInfo.found || isInsideProtectedAttack(bricks, timeSec)) { frameVoiced[f] = 0; continue; }
    const w0 = Math.max(0, center - zcrHalfWin), w1 = Math.min(n - 1, center + zcrHalfWin);
    let crossings = 0, sumSq = 0;
    for (let i = w0; i < w1; i++) {
      const s0 = rawAudio[i], s1 = rawAudio[i + 1];
      if ((s0 >= 0 && s1 < 0) || (s0 < 0 && s1 >= 0)) crossings++;
      sumSq += s0 * s0;
    }
    const count = Math.max(1, w1 - w0);
    frameVoiced[f] = (crossings / count < 0.28 && Math.sqrt(sumSq / count) > 0.0015) ? 1 : 0;
  }

  const voicedMask = new Uint8Array(n), voicedWeight = new Float32Array(n);
  for (let i = 0; i < n; i++) { const v = frameVoiced[Math.min(numFrames - 1, Math.floor(i / hopSamples))]; voicedMask[i] = v; voicedWeight[i] = v; }

  const fadeLen = Math.max(4, Math.round(sampleRate * 0.005));
  for (let i = 1; i < n; i++) {
    if (voicedMask[i - 1] === 0 && voicedMask[i] === 1) {
      for (let k = 0; k < fadeLen && i + k < n && voicedMask[i + k] === 1; k++) voicedWeight[i + k] = Math.min(voicedWeight[i + k], 0.5 * (1 - Math.cos(Math.PI * ((k + 1) / fadeLen))));
    } else if (voicedMask[i - 1] === 1 && voicedMask[i] === 0) {
      for (let k = 0; k < fadeLen && i - 1 - k >= 0 && voicedMask[i - 1 - k] === 1; k++) voicedWeight[i - 1 - k] = Math.min(voicedWeight[i - 1 - k], 0.5 * (1 - Math.cos(Math.PI * ((k + 1) / fadeLen))));
    }
  }

  const f0Wave = filterZeroPhaseFundamentalBand(rawAudio, sampleRate), marks: number[] = [];
  let cursor = 0;
  while (cursor < n) {
    const T0 = framePeriods[Math.min(numFrames - 1, Math.floor(cursor / hopSamples))];
    if (voicedMask[cursor] === 0) { cursor += Math.max(8, Math.round(T0 * 0.5)); continue; }
    const searchEnd = Math.min(n - 1, Math.round(cursor + T0));
    let bestIdx = cursor, bestVal = -Infinity;
    for (let s = cursor; s <= searchEnd; s++) {
      const val = f0Wave[s] + 0.35 * rawAudio[s];
      if (val > bestVal) { bestVal = val; bestIdx = s; }
    }
    let mk = bestIdx; marks.push(mk);
    while (mk < n) {
      const period = framePeriods[Math.min(numFrames - 1, Math.floor(mk / hopSamples))], expected = mk + period;
      if (expected >= n || voicedMask[Math.min(n - 1, Math.round(expected))] === 0) { cursor = Math.round(expected + period * 0.5); break; }
      const tol = Math.max(2, Math.round(period * 0.22));
      const s0 = Math.max(mk + Math.round(period * 0.62), Math.round(expected - tol)), s1 = Math.min(n - 1, Math.round(expected + tol));
      let peakIdx = Math.min(n - 1, Math.round(expected)), peakScore = -Infinity;
      for (let s = s0; s <= s1; s++) {
        const phaseCost = (s - expected) / tol, score = (f0Wave[s] + 0.35 * rawAudio[s]) - 0.12 * phaseCost * phaseCost;
        if (score > peakScore) { peakScore = score; peakIdx = s; }
      }
      mk = peakIdx; marks.push(mk);
    }
  }
  return { voicedMask, voicedWeight, framePeriods, hopSamples, epochs: Int32Array.from(marks) };
}
