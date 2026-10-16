/**
 * pitchPreFilter.ts
 * Pré-filtrage acoustique dédié à la détection de pitch YIN (< 65 lignes) :
 * Coupe-bas Butterworth 2nd ordre à 95 Hz (chocs de pas) + Coupe-haut 2nd ordre à 1200 Hz.
 */

function applyBiquad(input: Float32Array, b0: number, b1: number, b2: number, a1: number, a2: number): Float32Array {
  const out = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x0 = input[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y0;
    x2 = x1; x1 = x0;
    y2 = y1; y1 = y0;
  }
  return out;
}

export function preFilterAudioForPitchDetection(
  rawPCM: Float32Array,
  sampleRate: number,
  hpFreq = 95,
  lpFreq = 1200
): Float32Array {
  if (!rawPCM || rawPCM.length === 0 || sampleRate <= 0) return rawPCM;

  const q = 0.7071; // Réponse Butterworth maximale plate

  // 1. Passe-Haut 2nd ordre (élimine les chocs de pas et grondements 15-80 Hz)
  const wHp = (2 * Math.PI * Math.min(hpFreq, sampleRate * 0.45)) / sampleRate;
  const alphaHp = Math.sin(wHp) / (2 * q);
  const cosHp = Math.cos(wHp);
  const a0Hp = 1 + alphaHp;
  const hpB0 = (1 + cosHp) / (2 * a0Hp), hpB1 = -(1 + cosHp) / a0Hp, hpB2 = hpB0;
  const hpA1 = (-2 * cosHp) / a0Hp, hpA2 = (1 - alphaHp) / a0Hp;

  const hpFiltered = applyBiquad(rawPCM, hpB0, hpB1, hpB2, hpA1, hpA2);

  // 2. Passe-Bas 2nd ordre (élimine les harmoniques extrêmes et bruits de bouche > 1200 Hz)
  const wLp = (2 * Math.PI * Math.min(lpFreq, sampleRate * 0.45)) / sampleRate;
  const alphaLp = Math.sin(wLp) / (2 * q);
  const cosLp = Math.cos(wLp);
  const a0Lp = 1 + alphaLp;
  const lpB0 = (1 - cosLp) / (2 * a0Lp), lpB1 = (1 - cosLp) / a0Lp, lpB2 = lpB0;
  const lpA1 = (-2 * cosLp) / a0Lp, lpA2 = (1 - alphaLp) / a0Lp;

  return applyBiquad(hpFiltered, lpB0, lpB1, lpB2, lpA1, lpA2);
}
