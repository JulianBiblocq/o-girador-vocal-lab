/**
 * realtimePitchDetector.ts
 * Détection de hauteur et puissance RMS en temps réel par autocorrélation normalisée.
 * Strictement < 150 lignes.
 */

import { frequencyToMidiFloat } from '../utils/noteUtils';

export interface PitchDetectionResult {
  pitchMidi: number;
  freq: number;
  rms: number;
}

export function detectRealtimePitch(
  buffer: Float32Array,
  sampleRate: number,
  minRms = 0.015
): PitchDetectionResult {
  const size = buffer.length;
  let sumSq = 0;
  for (let i = 0; i < size; i++) {
    sumSq += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sumSq / size);
  if (rms < minRms) {
    return { pitchMidi: 0, freq: 0, rms };
  }

  // Bornes de fréquence vocale : 65 Hz (C2) à 1050 Hz (C6)
  const minPeriod = Math.floor(sampleRate / 1050);
  const maxPeriod = Math.floor(sampleRate / 65);

  let bestPeriod = -1;
  let maxCorrelation = 0;

  // Calcul d'autocorrélation normalisée
  for (let lag = minPeriod; lag <= maxPeriod && lag < size / 2; lag++) {
    let corr = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let i = 0; i < size - lag; i++) {
      corr += buffer[i] * buffer[i + lag];
      norm1 += buffer[i] * buffer[i];
      norm2 += buffer[i + lag] * buffer[i + lag];
    }
    const norm = Math.sqrt(norm1 * norm2);
    if (norm > 0) {
      corr /= norm;
    }
    if (corr > maxCorrelation) {
      maxCorrelation = corr;
      bestPeriod = lag;
    }
  }

  if (maxCorrelation < 0.65 || bestPeriod <= 0) {
    return { pitchMidi: 0, freq: 0, rms };
  }

  const freq = sampleRate / bestPeriod;
  const pitchMidi = frequencyToMidiFloat(freq);
  return { pitchMidi, freq, rms };
}
