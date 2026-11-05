/**
 * tdPsolaPitchShifter.ts
 * Moteur de synthèse vocale synchrone à la période (TD-PSOLA) à préservation de formants,
 * normalisation OLA stricte (weightSum) et préservation bit-perfect 1:1 des consonnes (< 135 lignes).
 */
import type { TdPsolaAnalysis } from './tdPsolaEpochDetector';

export interface TdPsolaRegionTarget {
  startSec: number;
  endSec: number;
  shiftSemitonesAt: (timeSec: number) => number;
}

function findNearestEpoch(epochs: Int32Array, samplePos: number): number {
  let left = 0, right = epochs.length - 1;
  while (left <= right) {
    const mid = (left + right) >> 1;
    if (epochs[mid] < samplePos) left = mid + 1;
    else right = mid - 1;
  }
  const idx0 = Math.max(0, Math.min(epochs.length - 1, left - 1));
  const idx1 = Math.max(0, Math.min(epochs.length - 1, left));
  return Math.abs(epochs[idx0] - samplePos) <= Math.abs(epochs[idx1] - samplePos) ? epochs[idx0] : epochs[idx1];
}

function sampleLinear(buf: Float32Array, pos: number): number {
  const n = buf.length;
  if (pos <= 0) return buf[0] || 0;
  if (pos >= n - 1) return buf[n - 1] || 0;
  const i0 = Math.floor(pos), frac = pos - i0;
  return buf[i0] * (1 - frac) + buf[i0 + 1] * frac;
}

function extractFundamentalCoeffs(rawAudio: Float32Array, mk: number, T0: number): { a1: number; b1: number } {
  const halfT = Math.max(4, Math.floor(T0 * 0.5));
  const n = rawAudio.length, omega = (2 * Math.PI) / T0;
  let sumC = 0, sumS = 0, count = 0;
  for (let s = -halfT; s <= halfT; s++) {
    const idx = mk + s;
    if (idx < 0 || idx >= n) continue;
    const val = rawAudio[idx], angle = omega * s;
    sumC += val * Math.cos(angle);
    sumS += val * Math.sin(angle);
    count++;
  }
  if (count === 0) return { a1: 0, b1: 0 };
  return { a1: (2 * sumC) / count, b1: (2 * sumS) / count };
}

export function applyTdPsolaPitchCorrection(
  rawAudio: Float32Array,
  sampleRate: number,
  analysis: TdPsolaAnalysis,
  targets: TdPsolaRegionTarget[]
): Float32Array {
  if (!rawAudio || rawAudio.length === 0 || !targets || targets.length === 0) {
    return new Float32Array(rawAudio);
  }
  const n = rawAudio.length;
  const out = new Float32Array(rawAudio);
  const regionFadeSamples = Math.max(8, Math.round(sampleRate * 0.015));

  for (const target of targets) {
    const startIdx = Math.max(0, Math.floor(target.startSec * sampleRate));
    const endIdx = Math.min(n, Math.ceil(target.endSec * sampleRate));
    const segLen = endIdx - startIdx;
    if (segLen <= 32 || analysis.epochs.length === 0) continue;

    const synth = new Float32Array(segLen);
    const weightSum = new Float32Array(segLen);

    let mSynth = startIdx;
    while (mSynth < endIdx) {
      const frameIdx = Math.min(analysis.framePeriods.length - 1, Math.floor(mSynth / analysis.hopSamples));
      const T0 = Math.max(12, analysis.framePeriods[frameIdx] || (sampleRate / 220));
      const timeSec = mSynth / sampleRate;
      const rawShift = target.shiftSemitonesAt(timeSec);
      const clampedShift = Math.max(-12, Math.min(12, Number.isFinite(rawShift) ? rawShift : 0));
      const ratio = Math.pow(2, clampedShift / 12);
      const targetPeriod = Math.max(12, Math.min(sampleRate / 55, T0 / ratio));

      const mk = findNearestEpoch(analysis.epochs, mSynth);
      if (Math.abs(mk - mSynth) <= T0 * 1.75) {
        const { a1, b1 } = extractFundamentalCoeffs(rawAudio, mk, T0);
        const halfGrain = Math.ceil(targetPeriod);
        const omegaOrig = (2 * Math.PI) / T0;
        const omegaTarget = (2 * Math.PI) / targetPeriod;

        for (let tau = -halfGrain; tau <= halfGrain; tau++) {
          const outIdx = Math.round(mSynth) + tau;
          if (outIdx < startIdx || outIdx >= endIdx) continue;
          const u = tau / targetPeriod;
          if (Math.abs(u) >= 1) continue;
          const w = 0.5 * (1 + Math.cos(Math.PI * u));

          // 1. Fondamentale f0 synthétisée à la nouvelle période targetPeriod (phase 100% cohérente)
          const f1New = a1 * Math.cos(omegaTarget * tau) + b1 * Math.sin(omegaTarget * tau);

          // 2. Résidu formantique lu à l'échelle acoustique naturelle 1:1 (préservation des formants)
          let formantResidual = 0;
          if (Math.abs(tau) < T0) {
            const rawVal = sampleLinear(rawAudio, mk + tau);
            const f1Orig = a1 * Math.cos(omegaOrig * tau) + b1 * Math.sin(omegaOrig * tau);
            const wFormant = 0.5 * (1 + Math.cos(Math.PI * (tau / T0)));
            formantResidual = (rawVal - f1Orig) * wFormant;
          }

          const localIdx = outIdx - startIdx;
          synth[localIdx] += (f1New + formantResidual) * w;
          weightSum[localIdx] += w;
        }
      }
      mSynth += targetPeriod;
    }

    for (let i = 0; i < segLen; i++) {
      const globalIdx = startIdx + i;
      const vWeight = analysis.voicedWeight[globalIdx];
      if (vWeight <= 0 || weightSum[i] <= 1e-4) {
        out[globalIdx] = rawAudio[globalIdx];
        continue;
      }
      let rFade = 1;
      if (i < regionFadeSamples) rFade = 0.5 * (1 - Math.cos(Math.PI * (i / regionFadeSamples)));
      else if (segLen - 1 - i < regionFadeSamples) rFade = 0.5 * (1 - Math.cos(Math.PI * ((segLen - 1 - i) / regionFadeSamples)));
      const alpha = vWeight * rFade;
      const voicedSample = synth[i] / weightSum[i];
      const blended = (1 - alpha) * rawAudio[globalIdx] + alpha * voicedSample;
      out[globalIdx] = Number.isFinite(blended) ? Math.max(-1, Math.min(1, blended)) : rawAudio[globalIdx];
    }
  }
  return out;
}

