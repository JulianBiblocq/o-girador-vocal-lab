/**
 * pitchExtractor.ts
 * Algorithme YIN avec interpolation parabolique sub-sample et lissage 2 passes
 * (filtre médian + moyenne glissante Gaussienne) pour un centre mélodique doux et stable.
 */
import type { PitchCurvePoint } from '../types/vocalPack.types';
import { frequencyToMidiFloat } from '../utils/noteUtils';

export interface PitchExtractorOptions {
  sampleRate: number;
  totalDurationSec: number;
  trimStartSec: number;
  trimEndSec: number;
  yinThreshold?: number;
  rmsGate?: number;
}

function smoothPitchCurve(raw: PitchCurvePoint[]): PitchCurvePoint[] {
  if (raw.length < 5) return raw;

  // Passe 1 : Filtre médian sur 3 points pour éliminer les sauts isolés
  const med = raw.map((pt, i, arr) => {
    if (i === 0 || i === arr.length - 1) return { ...pt };
    const pPrev = arr[i - 1], pNext = arr[i + 1];
    if (Math.abs(pt.timeSec - pPrev.timeSec) > 0.035 || Math.abs(pNext.timeSec - pt.timeSec) > 0.035) return { ...pt };
    const sorted = [pPrev.midiFloat, pt.midiFloat, pNext.midiFloat].sort((a, b) => a - b);
    return { timeSec: pt.timeSec, midiFloat: sorted[1] };
  });

  // Passe 2 : Moyenne Gaussienne sur 5 points ([0.06, 0.24, 0.40, 0.24, 0.06])
  const weights = [0.06, 0.24, 0.40, 0.24, 0.06];
  return med.map((pt, i, arr) => {
    if (i < 2 || i >= arr.length - 2) return pt;
    const isVoicedContour = Math.abs(arr[i + 2].timeSec - arr[i - 2].timeSec) <= 0.085;
    if (!isVoicedContour) return pt;

    let weightedMidi = 0;
    for (let k = -2; k <= 2; k++) weightedMidi += arr[i + k].midiFloat * weights[k + 2];
    return { timeSec: pt.timeSec, midiFloat: Math.round(weightedMidi * 100) / 100 };
  });
}

export function extractContinuousPitchCurve(pcm: Float32Array, options: PitchExtractorOptions): PitchCurvePoint[] {
  const { sampleRate, totalDurationSec, trimStartSec, trimEndSec, yinThreshold = 0.20, rmsGate = 0.012 } = options;
  if (!pcm || pcm.length === 0) return [];

  const windowSize = 1024;
  const hopSize = Math.max(128, Math.floor(sampleRate * 0.01)); // Tranches de 10 ms
  const minFreq = 65, maxFreq = 1050; // C2 à C6
  const minPeriod = Math.floor(sampleRate / maxFreq);
  const maxPeriod = Math.min(windowSize - 1, Math.floor(sampleRate / minFreq));

  const diff = new Float32Array(maxPeriod + 1);
  const rawPoints: PitchCurvePoint[] = [];
  const totalFrames = Math.floor((pcm.length - windowSize) / hopSize);

  for (let frame = 0; frame < totalFrames; frame++) {
    const startIdx = frame * hopSize;
    const timeSec = startIdx / sampleRate;
    if (timeSec < trimStartSec - 0.02 || timeSec > trimEndSec + 0.02) continue;
    if (timeSec > totalDurationSec) break;

    let sumSq = 0;
    for (let j = 0; j < windowSize; j++) sumSq += pcm[startIdx + j] * pcm[startIdx + j];
    if (Math.sqrt(sumSq / windowSize) < rmsGate) continue;

    diff[0] = 0;
    for (let tau = 1; tau <= maxPeriod; tau++) {
      let d = 0;
      for (let j = 0; j < windowSize; j++) {
        const delta = pcm[startIdx + j] - pcm[startIdx + j + tau];
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

    if (bestTau !== -1) {
      let refinedTau = bestTau;
      if (bestTau > minPeriod && bestTau < maxPeriod) {
        const s0 = diff[bestTau - 1], s1 = diff[bestTau], s2 = diff[bestTau + 1];
        const denom = 2 * (s0 - 2 * s1 + s2);
        if (Math.abs(denom) > 1e-6) refinedTau += (s0 - s2) / denom;
      }

      const freq = sampleRate / refinedTau;
      if (freq >= minFreq && freq <= maxFreq) {
        rawPoints.push({ timeSec: Math.round(timeSec * 1000) / 1000, midiFloat: frequencyToMidiFloat(freq) });
      }
    }
  }

  return smoothPitchCurve(rawPoints);
}
