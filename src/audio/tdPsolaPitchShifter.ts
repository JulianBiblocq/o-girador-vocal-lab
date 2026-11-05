/**
 * tdPsolaPitchShifter.ts
 * Moteur continu Phase-Locked PSOLA avec Normalisation Exacte (acc[n] / weight[n]),
 * Interpolation Cubique Hermite 4-points et préservation des formants (< 135 lignes).
 */
import type { TdPsolaAnalysis } from './tdPsolaEpochDetector';

export interface TdPsolaRegionTarget {
  startSec: number; endSec: number; shiftSemitonesAt: (timeSec: number) => number;
}

export function sampleHermite4(buf: Float32Array, pos: number): number {
  const n = buf.length;
  if (pos <= 1) return buf[Math.max(0, Math.floor(pos))] || 0;
  if (pos >= n - 2) return buf[n - 1] || 0;
  const i = Math.floor(pos), t = pos - i;
  const y0 = buf[i - 1], y1 = buf[i], y2 = buf[i + 1], y3 = buf[i + 2];
  const c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
  return ((c3 * t + c2) * t + c1) * t + y1;
}

export function smoothShiftFramesZeroPhase(shifts: Float32Array, halfWinFrames: number): Float32Array {
  const len = shifts.length;
  if (len <= 2 || halfWinFrames < 1) return shifts;
  const runPass = (src: Float32Array) => {
    const dst = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      let sum = 0, cnt = 0;
      for (let k = Math.max(0, i - halfWinFrames); k <= Math.min(len - 1, i + halfWinFrames); k++) { sum += src[k]; cnt++; }
      dst[i] = sum / cnt;
    }
    return dst;
  };
  return runPass(runPass(shifts));
}

function findPhaseLockOffset(
  rawAudio: Float32Array, acc: Float32Array, weight: Float32Array,
  outStart: number, globalCenter: number, halfWin: number, hopSize: number,
  r: number, maxLock: number, expectedOffset: number, hasPrevVoiced: boolean
): number {
  const n = rawAudio.length, segLen = acc.length;
  const corrStart = Math.max(0, hopSize >> 2), corrEnd = Math.min(halfWin, segLen - outStart);
  if (corrEnd - corrStart < 16) return expectedOffset;
  let refEnergy = 0;
  for (let k = corrStart; k < corrEnd; k += 2) {
    const w = weight[outStart + k];
    if (w > 1e-3) { const v = acc[outStart + k] / w; refEnergy += v * v; }
  }
  if (refEnergy <= 1e-8) return 0;

  let bestOff = Math.round(Math.max(-maxLock, Math.min(maxLock, expectedOffset))), bestScore = -Infinity;
  const step = maxLock > 160 ? 2 : 1;
  for (let off = -maxLock; off <= maxLock; off += step) {
    let dot = 0, candEnergy = 0;
    const baseCenter = globalCenter + off;
    if (baseCenter - halfWin * r < 2 || baseCenter + halfWin * r >= n - 2) continue;
    for (let k = corrStart; k < corrEnd; k += 2) {
      const w = weight[outStart + k];
      if (w <= 1e-3) continue;
      const refVal = acc[outStart + k] / w, candVal = rawAudio[Math.round(baseCenter + (k - halfWin) * r)];
      dot += refVal * candVal; candEnergy += candVal * candVal;
    }
    const corr = candEnergy > 1e-8 ? dot / Math.sqrt(refEnergy * candEnergy) : 0;
    const centerPen = 0.15 * (Math.abs(off) / maxLock);
    const trackPen = hasPrevVoiced && Math.abs(expectedOffset) <= maxLock * 0.7 ? 0.12 * (Math.abs(off - expectedOffset) / maxLock) : 0;
    const score = corr - centerPen - trackPen;
    if (score > bestScore) { bestScore = score; bestOff = off; }
  }
  return hasPrevVoiced && Math.abs(bestOff - expectedOffset) <= step * 2 ? expectedOffset : bestOff;
}

export function applyTdPsolaPitchCorrection(
  rawAudio: Float32Array, sampleRate: number, analysis: TdPsolaAnalysis, targets: TdPsolaRegionTarget[]
): Float32Array {
  if (!rawAudio || rawAudio.length === 0 || !targets || targets.length === 0) return new Float32Array(rawAudio);
  const n = rawAudio.length, out = new Float32Array(rawAudio), fadeSec = 0.025;
  const winSize = Math.max(64, (Math.round(0.024 * sampleRate) >> 2) << 2), hopSize = winSize >> 2, halfWin = winSize >> 1;

  let minStartSec = Infinity, maxEndSec = -Infinity;
  for (const t of targets) { if (t.startSec < minStartSec) minStartSec = t.startSec; if (t.endSec > maxEndSec) maxEndSec = t.endSec; }
  const startIdx = Math.max(0, Math.floor(minStartSec * sampleRate) - winSize), endIdx = Math.min(n, Math.ceil(maxEndSec * sampleRate) + winSize);
  const segLen = endIdx - startIdx;
  if (segLen <= winSize) return out;

  const hann = new Float32Array(winSize);
  for (let k = 0; k < winSize; k++) hann[k] = 0.5 * (1 - Math.cos((2 * Math.PI * k) / winSize));

  const numFrames = Math.floor((segLen - winSize) / hopSize) + 1, rawShifts = new Float32Array(numFrames);
  for (let m = 0; m < numFrames; m++) {
    const gCenter = Math.min(n - 1, startIdx + m * hopSize + halfWin), tSec = gCenter / sampleRate;
    let activeTarget: TdPsolaRegionTarget | null = null, env = 0;
    for (let k = targets.length - 1; k >= 0; k--) {
      const tg = targets[k];
      if (tSec < tg.startSec || tSec > tg.endSec) continue;
      let e = 1;
      if (tSec - tg.startSec < fadeSec && !targets.some((o) => o !== tg && Math.abs(o.endSec - tg.startSec) <= 0.03)) e = Math.min(e, 0.5 * (1 - Math.cos(Math.PI * ((tSec - tg.startSec) / fadeSec))));
      if (tg.endSec - tSec < fadeSec && !targets.some((o) => o !== tg && Math.abs(o.startSec - tg.endSec) <= 0.03)) e = Math.min(e, 0.5 * (1 - Math.cos(Math.PI * ((tg.endSec - tSec) / fadeSec))));
      activeTarget = tg; env = e; break;
    }
    const vWeight = analysis.voicedWeight ? analysis.voicedWeight[gCenter] : 1;
    const s = activeTarget && vWeight > 0 ? activeTarget.shiftSemitonesAt(tSec) * env * vWeight : 0;
    rawShifts[m] = Number.isFinite(s) ? Math.max(-12, Math.min(12, s)) : 0;
  }
  const shifts = smoothShiftFramesZeroPhase(rawShifts, Math.max(1, Math.round(0.0225 / (hopSize / sampleRate))));
  const acc = new Float32Array(segLen), weight = new Float32Array(segLen), maxLock = Math.round(sampleRate / 110);
  let prevOffset = 0, prevR = 1.0, hasPrevVoiced = false;

  for (let m = 0; m < numFrames; m++) {
    const outStart = m * hopSize, gCenter = startIdx + outStart + halfWin, shiftSt = shifts[m];
    const isVoiced = (analysis.voicedWeight ? analysis.voicedWeight[Math.min(n - 1, gCenter)] : 1) > 0.01;
    const r = isVoiced && Math.abs(shiftSt) >= 0.015 ? Math.pow(2, shiftSt / 12) : 1.0;
    if (Math.abs(r - 1.0) < 0.001) {
      prevOffset = 0; prevR = 1.0; hasPrevVoiced = false;
      for (let k = 0; k < winSize; k++) {
        const localOut = outStart + k, gIn = startIdx + localOut;
        if (localOut < segLen && gIn < n) { const w = hann[k]; acc[localOut] += rawAudio[gIn] * w; weight[localOut] += w; }
      }
      continue;
    }
    const expectedOffset = hasPrevVoiced ? prevOffset + (0.5 * (prevR + r) - 1) * hopSize : 0;
    const phaseLockOffset = findPhaseLockOffset(rawAudio, acc, weight, outStart, gCenter, halfWin, hopSize, r, maxLock, expectedOffset, hasPrevVoiced);
    prevOffset = phaseLockOffset; prevR = r; hasPrevVoiced = true;
    const emphAlpha = Math.abs(shiftSt) > 1.5 ? Math.min(0.42, (Math.abs(shiftSt) - 1.5) * 0.08) : 0;
    let deEmphState = 0;
    const inCenter = gCenter + phaseLockOffset;
    for (let k = 0; k < winSize; k++) {
      const localOut = outStart + k; if (localOut >= segLen) break;
      const pos = inCenter + (k - halfWin) * r;
      let val = sampleHermite4(rawAudio, pos);
      if (emphAlpha > 0) { deEmphState = (val - emphAlpha * sampleHermite4(rawAudio, pos - 1)) + emphAlpha * deEmphState; val = deEmphState; }
      const w = hann[k]; acc[localOut] += val * w; weight[localOut] += w;
    }
  }
  for (let i = 0; i < segLen; i++) {
    const globalIdx = startIdx + i, v = weight[i] > 1e-4 ? acc[i] / weight[i] : rawAudio[globalIdx];
    out[globalIdx] = Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : rawAudio[globalIdx];
  }
  return out;
}