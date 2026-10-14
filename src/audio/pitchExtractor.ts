/**
 * pitchExtractor.ts
 * Algorithme YIN rapide hors-ligne par fenêtres glissantes de 20 ms.
 * Extrait la courbe de justesse vocale continue pitchCurve (timeSec, midiFloat).
 */
import type { PitchCurvePoint } from '../types/vocalPack.types';
import { frequencyToMidiFloat } from '../utils/noteUtils';

export interface PitchExtractorOptions {
  sampleRate: number;
  totalDurationSec: number;
  trimStartSec: number;
  trimEndSec: number;
  yinThreshold?: number; // Seuil YIN (défaut 0.20)
  rmsGate?: number; // Seuil RMS de silence (défaut 0.012)
}

export function extractContinuousPitchCurve(
  pcm: Float32Array,
  options: PitchExtractorOptions
): PitchCurvePoint[] {
  const { sampleRate, totalDurationSec, trimStartSec, trimEndSec, yinThreshold = 0.20, rmsGate = 0.012 } = options;
  if (!pcm || pcm.length === 0) return [];

  const windowSize = 1024; // ~23 ms à 44.1 kHz
  const hopSize = Math.max(128, Math.floor(sampleRate * 0.01)); // Tranche de 10 ms
  const minFreq = 65; // ~C2
  const maxFreq = 1050; // ~C6
  const minPeriod = Math.floor(sampleRate / maxFreq);
  const maxPeriod = Math.min(windowSize - 1, Math.floor(sampleRate / minFreq));

  const diff = new Float32Array(maxPeriod + 1);
  const points: PitchCurvePoint[] = [];

  const totalFrames = Math.floor((pcm.length - windowSize) / hopSize);

  for (let frame = 0; frame < totalFrames; frame++) {
    const startIdx = frame * hopSize;
    const timeSec = startIdx / sampleRate;

    if (timeSec < trimStartSec - 0.02 || timeSec > trimEndSec + 0.02) continue;
    if (timeSec > totalDurationSec) break;

    // Calcul RMS pour exclure le silence et les respirations faibles
    let sumSq = 0;
    for (let j = 0; j < windowSize; j++) {
      const v = pcm[startIdx + j];
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / windowSize);
    if (rms < rmsGate) continue;

    // 1. Fonction de différence YIN
    diff[0] = 0;
    for (let tau = 1; tau <= maxPeriod; tau++) {
      let d = 0;
      for (let j = 0; j < windowSize; j++) {
        const delta = pcm[startIdx + j] - pcm[startIdx + j + tau];
        d += delta * delta;
      }
      diff[tau] = d;
    }

    // 2. Différence normalisée cumulative
    diff[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau <= maxPeriod; tau++) {
      runningSum += diff[tau];
      diff[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
    }

    // 3. Recherche du premier creux sous le seuil
    let bestTau = -1;
    for (let tau = minPeriod; tau <= maxPeriod; tau++) {
      if (diff[tau] < yinThreshold) {
        while (tau + 1 <= maxPeriod && diff[tau + 1] < diff[tau]) {
          tau++;
        }
        bestTau = tau;
        break;
      }
    }

    if (bestTau !== -1) {
      // Interpolation parabolique pour une précision sub-sample
      let refinedTau = bestTau;
      if (bestTau > minPeriod && bestTau < maxPeriod) {
        const s0 = diff[bestTau - 1];
        const s1 = diff[bestTau];
        const s2 = diff[bestTau + 1];
        const denom = 2 * (2 * s1 - s0 - s2);
        if (Math.abs(denom) > 1e-6) {
          refinedTau += (s2 - s0) / denom;
        }
      }

      const freq = sampleRate / refinedTau;
      if (freq >= minFreq && freq <= maxFreq) {
        const midiFloat = frequencyToMidiFloat(freq);
        points.push({ timeSec: Math.round(timeSec * 1000) / 1000, midiFloat });
      }
    }
  }

  return points;
}
