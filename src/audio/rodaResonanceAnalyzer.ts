/**
 * rodaResonanceAnalyzer.ts
 * Analyseur spectral temps réel « Voix de Roda » (Formant du chanteur / Résonance du Masque 2.4–3.6 kHz sans forçage) (< 120 lignes).
 * - Bande Corps / Fondamentale (E_body) : 150 Hz – 900 Hz
 * - Bande Résonance / Masque (E_ring) : 2400 Hz – 3600 Hz
 * - Bande Souffle / Sibilance (E_air) : 5500 Hz – 8500 Hz (exclusion des consonnes fricatives s, ch)
 */

export type RodaProjectionStatus = 'timide' | 'roda_optimal' | 'forcage';

export interface RodaProjectionFrameResult {
  isVoiced: boolean;
  bodyEnergyDb: number;
  ringEnergyDb: number;
  airEnergyDb: number;
  isFricativeNoise: boolean;
  projectionScorePct: number;
  status: RodaProjectionStatus;
  rms: number;
  jitterCents: number;
}

export interface SessionProjectionSummary {
  avgProjectionScorePct: number;
  dominantStatus: RodaProjectionStatus;
  voicedFramesCount: number;
}

function computeBandMeanDb(
  freqBinsDb: Float32Array | number[],
  sampleRate: number,
  fftSize: number,
  minHz: number,
  maxHz: number
): number {
  const binCount = freqBinsDb.length;
  if (binCount === 0 || sampleRate <= 0 || fftSize <= 0) return -96;
  const binHz = sampleRate / fftSize;
  const startBin = Math.max(1, Math.floor(minHz / binHz));
  const endBin = Math.min(binCount - 1, Math.ceil(maxHz / binHz));
  if (endBin < startBin) return -96;

  let linearPowerSum = 0;
  let count = 0;
  for (let i = startBin; i <= endBin; i++) {
    const dbVal = Number.isFinite(freqBinsDb[i]) ? freqBinsDb[i] : -100;
    linearPowerSum += Math.pow(10, Math.max(-100, dbVal) / 10);
    count++;
  }
  if (count === 0 || linearPowerSum <= 1e-12) return -96;
  return Math.round(10 * Math.log10(linearPowerSum / count) * 10) / 10;
}

/**
 * Analyse une trame FFT (issue de AnalyserNode.getFloatFrequencyData) uniquement sur les trames voisées actives (rms >= 0.015).
 */
export function analyzeVocalProjectionFrame(
  freqBinsDb: Float32Array | number[],
  sampleRate: number,
  fftSize: number,
  rms: number,
  jitterCents = 12
): RodaProjectionFrameResult {
  if (rms < 0.015 || !freqBinsDb || freqBinsDb.length === 0) {
    return {
      isVoiced: false,
      bodyEnergyDb: -96,
      ringEnergyDb: -96,
      airEnergyDb: -96,
      isFricativeNoise: false,
      projectionScorePct: 0,
      status: 'timide',
      rms,
      jitterCents,
    };
  }

  const bodyEnergyDb = computeBandMeanDb(freqBinsDb, sampleRate, fftSize, 150, 900);
  const ringEnergyDb = computeBandMeanDb(freqBinsDb, sampleRate, fftSize, 2400, 3600);
  const airEnergyDb = computeBandMeanDb(freqBinsDb, sampleRate, fftSize, 5500, 8500);

  // Exclusion des consonnes fricatives (s, ch) : le formant vocal doit dominer la bande d'air d'au moins 6 dB
  const isFricativeNoise = ringEnergyDb <= airEnergyDb + 6;

  let projectionScorePct = 0;
  if (!isFricativeNoise) {
    // Ratio spectral (E_ring - E_body) en dB : [-22 dB .. +2 dB] -> [0 % .. 100 %]
    const ratioDb = ringEnergyDb - bodyEnergyDb;
    const rawPct = Math.round(((ratioDb + 22) / 24) * 100);
    projectionScorePct = Math.max(0, Math.min(100, rawPct));
  }

  let status: RodaProjectionStatus = 'timide';
  if (rms > 0.22 && (projectionScorePct < 35 || jitterCents >= 50)) {
    status = 'forcage';
  } else if (!isFricativeNoise && rms >= 0.03 && projectionScorePct >= 40 && jitterCents < 45) {
    status = 'roda_optimal';
  } else {
    status = 'timide';
  }

  return {
    isVoiced: true,
    bodyEnergyDb,
    ringEnergyDb,
    airEnergyDb,
    isFricativeNoise,
    projectionScorePct,
    status,
    rms,
    jitterCents,
  };
}

/**
 * Agrège les trames voisées d'une prise complète pour le 4e pilier du diagnostic élève.
 */
export function computeSessionProjectionSummary(
  frames: RodaProjectionFrameResult[]
): SessionProjectionSummary {
  const voiced = (frames || []).filter((f) => f.isVoiced && !f.isFricativeNoise);
  if (voiced.length === 0) {
    return { avgProjectionScorePct: 0, dominantStatus: 'timide', voicedFramesCount: 0 };
  }
  const avgProjectionScorePct = Math.round(
    voiced.reduce((acc, f) => acc + f.projectionScorePct, 0) / voiced.length
  );
  const avgRms = voiced.reduce((acc, f) => acc + f.rms, 0) / voiced.length;
  const avgJitter = voiced.reduce((acc, f) => acc + f.jitterCents, 0) / voiced.length;

  let dominantStatus: RodaProjectionStatus = 'timide';
  if (avgRms > 0.22 && (avgProjectionScorePct < 35 || avgJitter >= 50)) {
    dominantStatus = 'forcage';
  } else if (avgRms >= 0.03 && avgProjectionScorePct >= 40 && avgJitter < 45) {
    dominantStatus = 'roda_optimal';
  }

  return { avgProjectionScorePct, dominantStatus, voicedFramesCount: voiced.length };
}
