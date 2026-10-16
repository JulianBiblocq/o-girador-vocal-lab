/**
 * pitchExtractor.ts
 * Algorithme YIN avec pré-filtrage Biquad (95-1200 Hz), continuité temporelle
 * anti-sous-harmoniques et interpolation parabolique sub-sample (< 120 lignes).
 */
import type { PitchCurvePoint } from '../types/vocalPack.types';
import { frequencyToMidiFloat } from '../utils/noteUtils';
import { sanitizePitchCurve, type RawPitchPoint } from './pitchCurveSanitizer';
import { preFilterAudioForPitchDetection } from './pitchPreFilter';

export interface PitchExtractorOptions {
  sampleRate: number;
  totalDurationSec: number;
  trimStartSec: number;
  trimEndSec: number;
  yinThreshold?: number;
  rmsGate?: number;
}

export function extractContinuousPitchCurve(pcm: Float32Array, options: PitchExtractorOptions): PitchCurvePoint[] {
  const { sampleRate, totalDurationSec, trimStartSec, trimEndSec, yinThreshold = 0.20, rmsGate = 0.012 } = options;
  if (!pcm || pcm.length === 0) return [];

  // Pré-filtrage Biquad dédié YIN (coupe les bruits de pas < 95 Hz et les sifflantes > 1200 Hz)
  const analysisPCM = preFilterAudioForPitchDetection(pcm, sampleRate, 95, 1200);

  const windowSize = 1024, hopSize = Math.max(128, Math.floor(sampleRate * 0.01));
  const minFreq = 65, maxFreq = 1050; // C2..C6
  const minPeriod = Math.floor(sampleRate / maxFreq), maxPeriod = Math.min(windowSize - 1, Math.floor(sampleRate / minFreq));

  const diff = new Float32Array(maxPeriod + 1);
  const rawPoints: RawPitchPoint[] = [];
  const totalFrames = Math.floor((pcm.length - windowSize) / hopSize);
  let prevTau = -1;

  for (let frame = 0; frame < totalFrames; frame++) {
    const startIdx = frame * hopSize, timeSec = startIdx / sampleRate;
    if (timeSec < trimStartSec - 0.02 || timeSec > trimEndSec + 0.02) continue;
    if (timeSec > totalDurationSec) break;

    let sumSq = 0, zc = 0;
    for (let j = 0; j < windowSize; j++) {
      const s = pcm[startIdx + j];
      sumSq += s * s;
      if (j > 0 && ((s >= 0 && pcm[startIdx + j - 1] < 0) || (s < 0 && pcm[startIdx + j - 1] >= 0))) zc++;
    }
    const rms = Math.sqrt(sumSq / windowSize);
    if (rms < rmsGate) { prevTau = -1; continue; }
    const zcr = zc / windowSize;

    diff[0] = 0;
    for (let tau = 1; tau <= maxPeriod; tau++) {
      let d = 0;
      for (let j = 0; j < windowSize; j++) {
        const delta = analysisPCM[startIdx + j] - analysisPCM[startIdx + j + tau];
        d += delta * delta;
      }
      diff[tau] = d;
    }

    diff[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau <= maxPeriod; tau++) {
      runningSum += diff[tau];
      diff[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
    }

    let bestTau = -1;
    for (let tau = minPeriod; tau <= maxPeriod; tau++) {
      if (diff[tau] < yinThreshold) {
        while (tau + 1 <= maxPeriod && diff[tau + 1] < diff[tau]) tau++;
        bestTau = tau;
        break;
      }
    }

    // Continuité temporelle anti-sous-harmonique (détecte le saut d'octave basse ~ 2*prevTau)
    if (bestTau !== -1 && prevTau > 0 && bestTau >= prevTau * 1.76 && bestTau <= prevTau * 2.24) {
      let halfTau = Math.max(minPeriod, Math.min(maxPeriod, Math.round(bestTau / 2)));
      for (let t = Math.max(minPeriod, halfTau - 2); t <= Math.min(maxPeriod, halfTau + 2); t++) {
        if (diff[t] < diff[halfTau]) halfTau = t;
      }
      if (diff[halfTau] < 0.38) bestTau = halfTau;
    }

    if (bestTau !== -1) {
      let refinedTau = bestTau;
      if (bestTau > minPeriod && bestTau < maxPeriod) {
        const s0 = diff[bestTau - 1], s1 = diff[bestTau], s2 = diff[bestTau + 1];
        const denom = 2 * (s0 - 2 * s1 + s2);
        if (Math.abs(denom) > 1e-6) refinedTau += (s0 - s2) / denom;
      }
      prevTau = refinedTau;
      const freq = sampleRate / refinedTau;
      if (freq >= minFreq && freq <= maxFreq) {
        rawPoints.push({ timeSec: Math.round(timeSec * 1000) / 1000, midiFloat: frequencyToMidiFloat(freq), aperiodicity: diff[bestTau], rms, zcr });
      }
    } else {
      prevTau = -1;
    }
  }

  return sanitizePitchCurve(rawPoints);
}
