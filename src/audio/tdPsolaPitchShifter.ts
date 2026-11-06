/**
 * tdPsolaPitchShifter.ts
 * Moteur Vocal Melodyne TD-PSOLA 3.0 à Phase Glottique Pure :
 * Interpolation linéaire temporelle de grains glottiques 1:1 (formants intacts),
 * fenêtre de Hann asymétrique et normalisation douce pour r > 1.15 (< 130 lignes).
 */
import type { TdPsolaAnalysis } from './tdPsolaEpochDetector';

export interface TdPsolaRegionTarget {
  startSec: number; endSec: number; shiftSemitonesAt: (timeSec: number) => number;
}

export function sampleHermite4(buf: Float32Array, pos: number): number {
  const n = buf.length;
  if (pos <= 1) return buf[Math.max(0, Math.floor(pos))] || 0;
  if (pos >= n - 2) return buf[n - 1] || 0;
  const i = Math.floor(pos), t = pos - i, y0 = buf[i - 1], y1 = buf[i], y2 = buf[i + 1], y3 = buf[i + 2];
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

function buildContinuousEpochGrid(analysis: TdPsolaAnalysis, startIdx: number, endIdx: number, sampleRate: number): Int32Array {
  const defaultT0 = Math.max(24, Math.round(sampleRate / 200)), rawEpochs = analysis.epochs || new Int32Array(0);
  const hop = Math.max(1, analysis.hopSamples || Math.round(sampleRate * 0.005)), periods = analysis.framePeriods;
  const getT0 = (pos: number) => (periods && periods.length > 0 ? Math.max(16, Math.round(periods[Math.min(periods.length - 1, Math.max(0, Math.floor(pos / hop)))] || defaultT0)) : defaultT0);
  const list: number[] = [];
  let cur = Math.max(0, startIdx - defaultT0 * 2), eIdx = 0;
  while (eIdx < rawEpochs.length && rawEpochs[eIdx] < cur) eIdx++;

  while (cur <= endIdx + defaultT0 * 2) {
    const t0 = getT0(cur);
    if (eIdx < rawEpochs.length && rawEpochs[eIdx] <= cur + t0 * 1.65) {
      const ep = rawEpochs[eIdx++];
      if (list.length === 0 || ep - list[list.length - 1] >= Math.max(12, t0 * 0.45)) list.push(ep);
      cur = ep;
      while (eIdx < rawEpochs.length && rawEpochs[eIdx] <= cur) eIdx++;
      if (eIdx < rawEpochs.length && rawEpochs[eIdx] - cur <= getT0(cur) * 1.75) { cur = rawEpochs[eIdx++]; list.push(cur); continue; }
    }
    cur += getT0(cur); list.push(cur);
  }
  return Int32Array.from(list);
}

export function applyTdPsolaPitchCorrection(
  rawAudio: Float32Array, sampleRate: number, analysis: TdPsolaAnalysis, targets: TdPsolaRegionTarget[]
): Float32Array {
  if (!rawAudio || rawAudio.length === 0 || !targets || targets.length === 0) return new Float32Array(rawAudio);
  const n = rawAudio.length, out = new Float32Array(rawAudio), fadeSec = 0.025, hopSize = Math.max(32, Math.round(0.005 * sampleRate));

  let minStartSec = Infinity, maxEndSec = -Infinity;
  for (const t of targets) { if (t.startSec < minStartSec) minStartSec = t.startSec; if (t.endSec > maxEndSec) maxEndSec = t.endSec; }
  const margin = Math.max(128, Math.round(0.03 * sampleRate));
  const startIdx = Math.max(0, Math.floor(minStartSec * sampleRate) - margin), endIdx = Math.min(n, Math.ceil(maxEndSec * sampleRate) + margin);
  const segLen = endIdx - startIdx;
  if (segLen <= 64) return out;

  const numFrames = Math.ceil(segLen / hopSize) + 1, rawShifts = new Float32Array(numFrames);
  for (let m = 0; m < numFrames; m++) {
    const gCenter = Math.min(n - 1, startIdx + m * hopSize), tSec = gCenter / sampleRate;
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
    const s = activeTarget && vWeight > 0 ? activeTarget.shiftSemitonesAt(tSec) * env : 0;
    rawShifts[m] = Number.isFinite(s) ? Math.max(-12, Math.min(12, s)) : 0;
  }
  const shifts = smoothShiftFramesZeroPhase(rawShifts, Math.max(1, Math.round(0.018 / (hopSize / sampleRate))));
  const epochs = buildContinuousEpochGrid(analysis, startIdx, endIdx, sampleRate);
  if (epochs.length < 2) return out;
  const synthAcc = new Float32Array(segLen), winDensity = new Float32Array(segLen);
  let tauS = epochs[0], k = 0;

  while (tauS < epochs[epochs.length - 1]) {
    while (k + 1 < epochs.length - 1 && epochs[k + 1] <= tauS) k++;
    const m0 = epochs[k], m1 = epochs[k + 1], T0 = Math.max(16, m1 - m0), alpha = Math.max(0, Math.min(1, (tauS - m0) / T0));
    const cS = Math.round(tauS), fIdx = Math.max(0, Math.min(numFrames - 1, Math.round((cS - startIdx) / hopSize))), shiftSt = shifts[fIdx];
    const vw = analysis.voicedWeight ? analysis.voicedWeight[Math.max(0, Math.min(n - 1, cS))] : 1;
    const r = vw > 0 && Math.abs(shiftSt) >= 0.008 ? Math.pow(2, shiftSt / 12) : 1.0, synthStep = T0 / r;
    const L = Math.max(16, Math.round(r < 1 ? synthStep : (k > 0 ? (1 - alpha) * (m0 - epochs[k - 1]) + alpha * T0 : T0)));
    const R = Math.max(16, Math.round(r < 1 ? synthStep : T0));

    for (let d = -L; d <= R; d++) {
      const localOut = cS + d - startIdx, p0 = m0 + d, p1 = m1 + d;
      if (localOut < 0 || localOut >= segLen || p0 < 0 || p1 >= n) continue;
      const w = d < 0 ? 0.5 * (1 + Math.cos((Math.PI * d) / L)) : 0.5 * (1 + Math.cos((Math.PI * d) / R));
      synthAcc[localOut] += ((1 - alpha) * rawAudio[p0] + alpha * rawAudio[p1]) * w;
      winDensity[localOut] += w;
    }
    tauS += Math.max(8, synthStep);
  }

  for (let i = 0; i < segLen; i++) {
    const globalIdx = startIdx + i, vw = analysis.voicedWeight ? analysis.voicedWeight[globalIdx] : 1;
    if (vw <= 0 || winDensity[i] <= 1e-4) { out[globalIdx] = rawAudio[globalIdx]; continue; }
    const norm = winDensity[i] > 1.15 ? 1 + 0.85 * (winDensity[i] - 1.15) : Math.max(0.85, winDensity[i]);
    const mixed = (1 - vw) * rawAudio[globalIdx] + vw * (synthAcc[i] / norm);
    out[globalIdx] = Number.isFinite(mixed) ? Math.max(-1, Math.min(1, mixed)) : rawAudio[globalIdx];
  }
  return out;
}
