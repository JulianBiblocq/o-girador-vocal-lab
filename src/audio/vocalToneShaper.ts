/**
 * vocalToneShaper.ts
 * Module DSP pur d'Egalisation et De-Esser (< 120 lignes).
 * Etage A : Biquad Peaking serie (Anti-Boite 320 Hz -3.0 dB + Presence 3 200 Hz +2.5 dB).
 * Etage B : De-Esser dynamique soustractif en phase (6 500 Hz jusqu'a -4.5 dB max).
 */

interface PeakingCoeffs {
  b0: number; b1: number; b2: number; a1: number; a2: number;
}

function computePeakingCoeffs(f0: number, q: number, gainDb: number, sr: number): PeakingCoeffs {
  const w0 = (2 * Math.PI * f0) / sr;
  const alpha = Math.sin(w0) / (2 * q);
  const A = Math.pow(10, gainDb / 40);
  const cosw0 = Math.cos(w0);
  const a0 = 1 + alpha / A;
  return {
    b0: (1 + alpha * A) / a0,
    b1: (-2 * cosw0) / a0,
    b2: (1 - alpha * A) / a0,
    a1: (-2 * cosw0) / a0,
    a2: (1 - alpha / A) / a0,
  };
}

function applyBiquadInPlace(pcm: Float32Array, c: PeakingCoeffs): void {
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
  for (let i = 0; i < pcm.length; i++) {
    const x0 = pcm[i];
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = y0;
    pcm[i] = y0;
  }
}

function applyDynamicDeEsser(pcm: Float32Array, sr: number): void {
  const f0 = Math.min(6500, sr * 0.45);
  const q = 1.8;
  const w0 = (2 * Math.PI * f0) / sr;
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  const nb0 = alpha / a0;
  const na1 = (-2 * Math.cos(w0)) / a0;
  const na2 = (1 - alpha) / a0;

  const att = Math.exp(-1 / (0.002 * sr)); // 2 ms attaque
  const rel = Math.exp(-1 / (0.040 * sr)); // 40 ms relachement
  const maxReduction = 0.4043; // 1 - 10^(-4.5 / 20)

  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
  let envHf = 0; let envWide = 0; let currentK = 0;

  for (let i = 0; i < pcm.length; i++) {
    const x0 = pcm[i];
    const sbp = nb0 * (x0 - x2) - na1 * y1 - na2 * y2;
    x2 = x1; x1 = x0; y2 = y1; y1 = sbp;

    const absHf = Math.abs(sbp);
    const absWide = Math.abs(x0);
    envHf = absHf > envHf ? att * envHf + (1 - att) * absHf : rel * envHf + (1 - rel) * absHf;
    envWide = absWide > envWide ? att * envWide + (1 - att) * absWide : rel * envWide + (1 - rel) * absWide;

    const ratio = envHf / (envWide + 0.005);
    let targetK = 0;
    if (ratio > 0.32 && envHf > 0.010) {
      const excess = Math.min(1.0, (ratio - 0.32) / 0.25);
      const levelScale = Math.min(1.0, (envHf - 0.010) / 0.020);
      targetK = excess * levelScale * maxReduction;
    }

    currentK = targetK > currentK ? att * currentK + (1 - att) * targetK : rel * currentK + (1 - rel) * targetK;
    pcm[i] = x0 - currentK * sbp;
  }
}

export function applyVocalToneShaping(pcm: Float32Array, sampleRate: number): Float32Array {
  if (pcm.length === 0 || sampleRate < 14000) return pcm;
  // Etage A : Anti-Boite (320 Hz) et Presence (3 200 Hz)
  const antiBox = computePeakingCoeffs(320, 1.2, -3.0, sampleRate);
  applyBiquadInPlace(pcm, antiBox);

  const presence = computePeakingCoeffs(3200, 1.0, 2.5, sampleRate);
  applyBiquadInPlace(pcm, presence);

  // Etage B : De-Esser dynamique a 6 500 Hz
  applyDynamicDeEsser(pcm, sampleRate);

  return pcm;
}
