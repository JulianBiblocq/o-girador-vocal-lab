/**
 * onsetDetector.ts
 * Détection acoustique des attaques consonantiques (plosives P, T, K, B, D, V, etc.)
 * par creux d'occlusion (Plosive Dip), pic ZCR et rebond d'énergie RMS.
 */

function calculateRMS(pcm: Float32Array, startIdx: number, endIdx: number): number {
  const start = Math.max(0, startIdx);
  const end = Math.min(pcm.length, endIdx);
  if (end <= start) return 0;
  let sumSq = 0;
  for (let i = start; i < end; i++) sumSq += pcm[i] * pcm[i];
  return Math.sqrt(sumSq / (end - start));
}

function calculateZCR(pcm: Float32Array, startIdx: number, endIdx: number): number {
  const start = Math.max(0, startIdx);
  const end = Math.min(pcm.length, endIdx);
  if (end <= start + 1) return 0;
  let crossings = 0;
  for (let i = start + 1; i < end; i++) {
    if ((pcm[i] >= 0 && pcm[i - 1] < 0) || (pcm[i] < 0 && pcm[i - 1] >= 0)) {
      crossings++;
    }
  }
  return crossings / (end - start);
}

export function hasSyllableAttack(
  pcm: Float32Array,
  sampleRate: number,
  stepStartSec: number,
  stepEndSec: number
): boolean {
  if (!pcm || pcm.length === 0 || stepStartSec <= 0.03) return false;

  const stepStartIdx = Math.floor(stepStartSec * sampleRate);
  const stepEndIdx = Math.floor(stepEndSec * sampleRate);

  // 1. Creux d'occlusion (Plosive Dip) : Chute RMS > 35% à la frontière
  const prevCoreStart = Math.floor((stepStartSec - 0.080) * sampleRate);
  const prevCoreEnd = Math.floor((stepStartSec - 0.030) * sampleRate);
  const boundaryStart = Math.floor((stepStartSec - 0.025) * sampleRate);
  const boundaryEnd = Math.floor((stepStartSec + 0.020) * sampleRate);

  const prevCoreRMS = calculateRMS(pcm, prevCoreStart, prevCoreEnd);
  const boundaryRMS = calculateRMS(pcm, boundaryStart, boundaryEnd);

  if (prevCoreRMS > 0.015 && boundaryRMS < prevCoreRMS * 0.65) {
    return true;
  }

  // 2. Explosion consonantique (ZCR Burst) : Pic ZCR > 0.16 sur les 35 premières ms
  const burstEndIdx = Math.min(stepEndIdx, Math.floor((stepStartSec + 0.035) * sampleRate));
  const burstZCR = calculateZCR(pcm, stepStartIdx, burstEndIdx);
  const burstRMS = calculateRMS(pcm, stepStartIdx, burstEndIdx);

  if (burstZCR > 0.16 && burstRMS > 0.008) {
    return true;
  }

  // 3. Rebond d'enveloppe : Hausse RMS > +2.5 dB (x1.33) vers le cœur de voyelle
  const attackEndIdx = Math.floor((stepStartSec + 0.020) * sampleRate);
  const coreStartIdx = Math.floor((stepStartSec + 0.030) * sampleRate);
  const coreEndIdx = Math.min(stepEndIdx, Math.floor((stepStartSec + 0.080) * sampleRate));

  const attackRMS = calculateRMS(pcm, stepStartIdx, attackEndIdx);
  const coreRMS = calculateRMS(pcm, coreStartIdx, coreEndIdx);

  if (coreRMS > 0.015 && coreRMS > attackRMS * 1.33) {
    return true;
  }

  return false;
}
