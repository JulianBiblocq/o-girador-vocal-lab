/**
 * pitchAnalysisPreFilter.ts
 * « Filtre Fantôme Inaudible » de pré-conditionnement pour l'analyseur de fondamentale f0 (< 120 lignes).
 * Passe-bande Biquad aller-retour à phase nulle (filtfilt, 0.0 ms de déphasage) + renfort demi-onde 15 %.
 * Strictement réservé au détecteur de pitch : jamais envoyé au lecteur audio.
 */

export interface AnalysisFilterBounds {
  minHz: number;
  maxHz: number;
  minMidi?: number;
  maxMidi?: number;
  comfortMidi?: number;
}

interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function makeHighPassCoeffs(sampleRate: number, cutoffHz: number, q = 0.7071): BiquadCoeffs {
  const fc = Math.max(20, Math.min(cutoffHz, sampleRate * 0.45));
  const w0 = (2 * Math.PI * fc) / sampleRate;
  const cosW = Math.cos(w0), alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: (1 + cosW) / (2 * a0),
    b1: -(1 + cosW) / a0,
    b2: (1 + cosW) / (2 * a0),
    a1: (-2 * cosW) / a0,
    a2: (1 - alpha) / a0,
  };
}

function makeLowPassCoeffs(sampleRate: number, cutoffHz: number, q = 0.7071): BiquadCoeffs {
  const fc = Math.max(40, Math.min(cutoffHz, sampleRate * 0.45));
  const w0 = (2 * Math.PI * fc) / sampleRate;
  const cosW = Math.cos(w0), alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: (1 - cosW) / (2 * a0),
    b1: (1 - cosW) / a0,
    b2: (1 - cosW) / (2 * a0),
    a1: (-2 * cosW) / a0,
    a2: (1 - alpha) / a0,
  };
}

function runBiquadForward(input: Float32Array, c: BiquadCoeffs): Float32Array {
  const n = input.length, out = new Float32Array(n);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < n; i++) {
    const x0 = input[i];
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    out[i] = y0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
  }
  return out;
}

function runBiquadZeroPhase(input: Float32Array, c: BiquadCoeffs): Float32Array {
  const fwd = runBiquadForward(input, c);
  const n = fwd.length, out = new Float32Array(n);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = n - 1; i >= 0; i--) {
    const x0 = fwd[i];
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    out[i] = y0;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
  }
  return out;
}

export function createPreConditionedAnalysisPcm(
  rawPcm: Float32Array,
  sampleRate: number,
  bounds: { minHz: number; maxHz: number }
): Float32Array {
  if (!rawPcm || rawPcm.length === 0 || sampleRate <= 0) return new Float32Array(0);

  const hpCutoff = Math.max(75, bounds.minHz * 0.85);
  const softLpCutoff = Math.min(360, Math.max(hpCutoff + 60, bounds.maxHz * 0.92));
  const mainLpCutoff = Math.min(680, Math.max(softLpCutoff + 40, bounds.maxHz * 1.25));

  const hpCoeffs = makeHighPassCoeffs(sampleRate, hpCutoff, 0.85);
  const softLpCoeffs = makeLowPassCoeffs(sampleRate, softLpCutoff, 0.7071);
  const mainLpCoeffs = makeLowPassCoeffs(sampleRate, mainLpCutoff, 0.7071);

  // 1. Passe-haut raide aller-retour (filtfilt) : élimine pops bilabiaux/dentaux (60 Hz)
  let bandPassed = runBiquadZeroPhase(rawPcm, hpCoeffs);
  bandPassed = runBiquadZeroPhase(bandPassed, hpCoeffs);

  // 2. Passe-bas progressif aller-retour dès 360 Hz puis mainLpCutoff : écrase F1/F2/F3
  bandPassed = runBiquadZeroPhase(bandPassed, softLpCoeffs);
  bandPassed = runBiquadZeroPhase(bandPassed, mainLpCoeffs);

  // 3. Enveloppe redressée demi-onde (15 %) filtrée dans [minHz, maxHz] pour renforcer f0
  const n = rawPcm.length;
  const halfWave = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = rawPcm[i];
    halfWave[i] = v > 0 ? v : 0;
  }
  let rectFiltered = runBiquadZeroPhase(halfWave, hpCoeffs);
  rectFiltered = runBiquadZeroPhase(rectFiltered, softLpCoeffs);

  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = bandPassed[i] + 0.15 * rectFiltered[i];
  }
  return out;
}

