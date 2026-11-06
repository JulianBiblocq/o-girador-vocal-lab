/**
 * realtimePitchDetector.ts
 * Détection de hauteur temps réel par autocorrélation normalisée + ratio harmonique H1/H2
 * anti-erreur d'octave (vocal fry / harmonique 2) + ZCR & clarté (< 110 lignes).
 */
import { frequencyToMidiFloat } from '../utils/noteUtils';

export interface PitchDetectionResult {
  pitchMidi: number;
  freq: number;
  rms: number;
  clarity?: number;
  zcr?: number;
}

function computeGoertzelEnergy(buf: Float32Array, sampleRate: number, targetFreq: number): number {
  if (targetFreq <= 30 || targetFreq >= sampleRate * 0.45) return 0;
  const n = Math.min(buf.length, 1024);
  const w = (2 * Math.PI * targetFreq) / sampleRate;
  const coeff = 2 * Math.cos(w);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    s0 = buf[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2) / (n * n);
}

function normCorrAtLag(buf: Float32Array, lag: number): number {
  const size = buf.length;
  if (lag <= 2 || lag >= size / 2) return 0;
  let corr = 0, norm1 = 0, norm2 = 0;
  for (let i = 0; i < size - lag; i++) {
    const a = buf[i], b = buf[i + lag];
    corr += a * b;
    norm1 += a * a;
    norm2 += b * b;
  }
  const denom = Math.sqrt(norm1 * norm2);
  return denom > 1e-12 ? corr / denom : 0;
}

export function detectRealtimePitch(
  buffer: Float32Array,
  sampleRate: number,
  minRms = 0.015
): PitchDetectionResult {
  const size = buffer.length;
  let sumSq = 0, zeroCrossings = 0;
  for (let i = 0; i < size; i++) {
    const v = buffer[i];
    sumSq += v * v;
    if (i > 0 && ((buffer[i - 1] >= 0 && v < 0) || (buffer[i - 1] < 0 && v >= 0))) zeroCrossings++;
  }
  const rms = Math.sqrt(sumSq / Math.max(1, size));
  const zcr = size > 1 ? zeroCrossings / (size - 1) : 0;
  if (rms < minRms) {
    return { pitchMidi: 0, freq: 0, rms, clarity: 0, zcr };
  }

  const minPeriod = Math.max(4, Math.floor(sampleRate / 1050));
  const maxPeriod = Math.min(Math.floor(size / 2) - 2, Math.floor(sampleRate / 65));

  let bestPeriod = -1, maxCorrelation = 0;
  for (let lag = minPeriod; lag <= maxPeriod; lag++) {
    const c = normCorrAtLag(buffer, lag);
    if (c > maxCorrelation) {
      maxCorrelation = c;
      bestPeriod = lag;
    }
  }

  if (maxCorrelation < 0.65 || bestPeriod <= 0) {
    return { pitchMidi: 0, freq: 0, rms, clarity: maxCorrelation, zcr };
  }

  // Interpolation parabolique autour du pic d'autocorrélation
  const cPrev = normCorrAtLag(buffer, bestPeriod - 1);
  const cNext = normCorrAtLag(buffer, bestPeriod + 1);
  const denom = cPrev - 2 * maxCorrelation + cNext;
  const delta = Math.abs(denom) > 1e-9 ? Math.max(-0.5, Math.min(0.5, (0.5 * (cPrev - cNext)) / denom)) : 0;
  let refinedPeriod = bestPeriod + delta;

  // Vérification harmonique H1 / H2 pour éviter les sauts d'octave (harmonique 2 ou sous-octave vocal fry)
  const candFreq = sampleRate / refinedPeriod;
  const eFund = computeGoertzelEnergy(buffer, sampleRate, candFreq);
  const doublePeriod = Math.round(refinedPeriod * 2);
  if (doublePeriod <= maxPeriod) {
    const corrSub = normCorrAtLag(buffer, doublePeriod);
    const eHalf = computeGoertzelEnergy(buffer, sampleRate, candFreq * 0.5);
    if (corrSub >= maxCorrelation * 0.84 && eHalf > eFund * 0.42) {
      refinedPeriod *= 2;
    }
  }
  const halfPeriod = Math.round(refinedPeriod * 0.5);
  if (halfPeriod >= minPeriod) {
    const corrHarm = normCorrAtLag(buffer, halfPeriod);
    const eDouble = computeGoertzelEnergy(buffer, sampleRate, candFreq * 2);
    if (corrHarm >= maxCorrelation * 0.90 && eFund < eDouble * 0.18) {
      refinedPeriod *= 0.5;
    }
  }

  const freq = sampleRate / refinedPeriod;
  const pitchMidi = frequencyToMidiFloat(freq);
  return { pitchMidi, freq, rms, clarity: maxCorrelation, zcr };
}
