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
  if (!rawAudio || rawAudio.length === 0 || !targets || targets.length === 0 || analysis.epochs.length === 0) {
    return new Float32Array(rawAudio);
  }
  const n = rawAudio.length, out = new Float32Array(rawAudio), fadeSec = 0.020;
  let minStartSec = Infinity, maxEndSec = -Infinity;
  for (const t of targets) {
    if (t.startSec < minStartSec) minStartSec = t.startSec;
    if (t.endSec > maxEndSec) maxEndSec = t.endSec;
  }
  const startIdx = Math.max(0, Math.floor(minStartSec * sampleRate)), endIdx = Math.min(n, Math.ceil(maxEndSec * sampleRate));
  const segLen = endIdx - startIdx;
  if (segLen <= 32) return out;

  const synth = new Float32Array(segLen), weightSum = new Float32Array(segLen), envMask = new Float32Array(segLen);
  for (let i = 0; i < segLen; i++) {
    const tSec = (startIdx + i) / sampleRate;
    let maxEnv = 0;
    for (const target of targets) {
      if (tSec < target.startSec || tSec > target.endSec) continue;
      let env = 1;
      if (tSec - target.startSec < fadeSec && !targets.some((o) => o !== target && Math.abs(o.endSec - target.startSec) <= 0.03)) {
        env = Math.min(env, 0.5 * (1 - Math.cos(Math.PI * ((tSec - target.startSec) / fadeSec))));
      }
      if (target.endSec - tSec < fadeSec && !targets.some((o) => o !== target && Math.abs(o.startSec - target.endSec) <= 0.03)) {
        env = Math.min(env, 0.5 * (1 - Math.cos(Math.PI * ((target.endSec - tSec) / fadeSec))));
      }
      if (env > maxEnv) maxEnv = env;
    }
    envMask[i] = maxEnv;
  }

  let mSynth = startIdx;
  while (mSynth < endIdx) {
    const frameIdx = Math.min(analysis.framePeriods.length - 1, Math.floor(mSynth / analysis.hopSamples));
    const T0 = Math.max(12, analysis.framePeriods[frameIdx] || (sampleRate / 220)), timeSec = mSynth / sampleRate;
    let activeTarget: TdPsolaRegionTarget | null = null;
    for (let k = targets.length - 1; k >= 0; k--) {
      if (timeSec >= targets[k].startSec && timeSec <= targets[k].endSec) { activeTarget = targets[k]; break; }
    }
    const rawShift = activeTarget ? activeTarget.shiftSemitonesAt(timeSec) : 0;
    const clampedShift = Math.max(-12, Math.min(12, Number.isFinite(rawShift) ? rawShift : 0));
    const targetPeriod = Math.max(12, Math.min(sampleRate / 55, T0 / Math.pow(2, clampedShift / 12)));
    const mk = findNearestEpoch(analysis.epochs, mSynth);
    if (activeTarget && Math.abs(mk - mSynth) <= T0 * 1.75) {
      const { a1, b1 } = extractFundamentalCoeffs(rawAudio, mk, T0);
      const halfGrain = Math.ceil(targetPeriod), omegaOrig = (2 * Math.PI) / T0, omegaTarget = (2 * Math.PI) / targetPeriod;
      for (let tau = -halfGrain; tau <= halfGrain; tau++) {
        const outIdx = Math.round(mSynth) + tau;
        if (outIdx < startIdx || outIdx >= endIdx || Math.abs(tau / targetPeriod) >= 1) continue;
        const w = 0.5 * (1 + Math.cos(Math.PI * (tau / targetPeriod)));
        const f1New = a1 * Math.cos(omegaTarget * tau) + b1 * Math.sin(omegaTarget * tau);
        let formantResidual = 0;
        if (Math.abs(tau) < T0) {
          const rawVal = sampleLinear(rawAudio, mk + tau);
          const f1Orig = a1 * Math.cos(omegaOrig * tau) + b1 * Math.sin(omegaOrig * tau);
          formantResidual = (rawVal - f1Orig) * 0.5 * (1 + Math.cos(Math.PI * (tau / T0)));
        }
        const localIdx = outIdx - startIdx;
        synth[localIdx] += (f1New + formantResidual) * w;
        weightSum[localIdx] += w;
      }
    }
    mSynth += targetPeriod;
  }

  for (let i = 0; i < segLen; i++) {
    const globalIdx = startIdx + i, vWeight = analysis.voicedWeight[globalIdx], rFade = envMask[i];
    if (vWeight <= 0 || rFade <= 0 || weightSum[i] <= 1e-4) { out[globalIdx] = rawAudio[globalIdx]; continue; }
    const alpha = vWeight * rFade;
    const blended = (1 - alpha) * rawAudio[globalIdx] + alpha * (synth[i] / weightSum[i]);
    out[globalIdx] = Number.isFinite(blended) ? Math.max(-1, Math.min(1, blended)) : rawAudio[globalIdx];
  }
  return out;
}

