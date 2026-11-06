/**
 * formantPreservingPitchShifter.ts
 * Étage B & C : Transposition vocale Studio à préservation des formants (déconvolution LPC
 * d'ordre court + verrouillage de phase glottique WSOLA/PSOLA + consonnes 1:1) et cache HD (< 130 lignes).
 */
import { analyzeVocalFrames, blendUnvoicedTransientsAtUnityRatio } from './vocalTransientSeparator';

const LPC_ORDER = 10;
const troupePcmCache = new WeakMap<Float32Array, Map<string, Float32Array>>();

function computeLpcCoeffs(frame: Float32Array, order = LPC_ORDER): Float32Array {
  const n = frame.length, r = new Float32Array(order + 1), a = new Float32Array(order + 1), prev = new Float32Array(order + 1);
  for (let k = 0; k <= order; k++) {
    let sum = 0;
    for (let i = 0; i < n - k; i++) sum += frame[i] * frame[i + k];
    r[k] = sum;
  }
  a[0] = 1;
  if (r[0] < 1e-9) return a;
  let err = r[0];
  for (let i = 1; i <= order; i++) {
    let acc = r[i];
    for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
    const kRefl = Math.max(-0.95, Math.min(0.95, -acc / Math.max(1e-9, err)));
    prev.set(a); a[i] = kRefl;
    for (let j = 1; j < i; j++) a[j] = prev[j] + kRefl * prev[i - j];
    err *= 1 - kRefl * kRefl;
    if (err <= 1e-9) break;
  }
  return a;
}

function phaseLockedPitchShiftRaw(pcm: Float32Array, sampleRate: number, pitchRatio: number): Float32Array {
  const n = pcm.length, winLen = Math.max(256, Math.round(0.028 * sampleRate)), ha = Math.max(64, Math.floor(winLen / 4));
  const searchTol = Math.max(32, Math.floor(ha * 0.65)), stretchedLen = Math.max(winLen + 8, Math.round(n * pitchRatio));
  const stretched = new Float32Array(stretchedLen), norm = new Float32Array(stretchedLen), hann = new Float32Array(winLen);
  for (let i = 0; i < winLen; i++) hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (winLen - 1)));

  let synPos = 0, prevBestIn = 0;
  const step = sampleRate > 32000 ? 2 : 1;
  while (synPos + winLen < stretchedLen) {
    const targetIn = Math.min(n - winLen - 1, Math.max(0, Math.round(synPos / pitchRatio)));
    let bestIn = targetIn;
    if (synPos > 0) {
      const expectedIn = prevBestIn + ha, minIn = Math.max(0, targetIn - searchTol), maxIn = Math.min(n - winLen - 1, targetIn + searchTol);
      let bestCorr = -Infinity;
      for (let cand = minIn; cand <= maxIn; cand += step) {
        let dot = 0;
        for (let k = 0; k < ha; k += step) dot += pcm[Math.min(n - 1, Math.max(0, expectedIn + k))] * pcm[cand + k];
        if (dot > bestCorr) { bestCorr = dot; bestIn = cand; }
      }
    }
    for (let i = 0; i < winLen; i++) {
      const w = hann[i];
      stretched[synPos + i] += pcm[bestIn + i] * w;
      norm[synPos + i] += w * w;
    }
    prevBestIn = bestIn; synPos += ha;
  }
  for (let i = 0; i < stretchedLen; i++) if (norm[i] > 1e-5) stretched[i] /= norm[i];

  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const pos = i * pitchRatio, i0 = Math.floor(pos), frac = pos - i0;
    const xm1 = stretched[Math.max(0, i0 - 1)], x0 = stretched[Math.min(stretchedLen - 1, i0)];
    const x1 = stretched[Math.min(stretchedLen - 1, i0 + 1)], x2 = stretched[Math.min(stretchedLen - 1, i0 + 2)];
    const c1 = 0.5 * (x1 - xm1), c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2, c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
    out[i] = ((c3 * frac + c2) * frac + c1) * frac + x0;
  }
  return out;
}

export function shiftVocalPitchFormantPreserved(pcm: Float32Array, sampleRate: number, semitones: number): Float32Array {
  const n = pcm.length;
  if (n === 0 || Math.abs(semitones) < 0.01) return new Float32Array(pcm);
  const pitchRatio = Math.pow(2, Math.max(-12, Math.min(12, semitones)) / 12);
  const frames = analyzeVocalFrames(pcm, sampleRate, 10);
  const rawShifted = phaseLockedPitchShiftRaw(pcm, sampleRate, pitchRatio);

  const lpcWin = Math.max(128, Math.round(0.02 * sampleRate)), lpcHop = Math.floor(lpcWin / 2);
  const formantOut = new Float32Array(n), winSum = new Float32Array(n), win = new Float32Array(lpcWin);
  for (let i = 0; i < lpcWin; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (lpcWin - 1)));
  const origBuf = new Float32Array(lpcWin), shiftBuf = new Float32Array(lpcWin), exc = new Float32Array(lpcWin), restored = new Float32Array(lpcWin);

  for (let start = 0; start < n; start += lpcHop) {
    const end = Math.min(n, start + lpcWin), len = end - start;
    if (len < LPC_ORDER * 2) break;
    origBuf.fill(0); shiftBuf.fill(0);
    let origSq = 0, shiftSq = 0;
    for (let i = 0; i < len; i++) {
      origBuf[i] = pcm[start + i] * win[i]; shiftBuf[i] = rawShifted[start + i] * win[i];
      origSq += origBuf[i] * origBuf[i]; shiftSq += shiftBuf[i] * shiftBuf[i];
    }
    if (origSq < 1e-8 || shiftSq < 1e-8) continue;
    const aOrig = computeLpcCoeffs(origBuf, LPC_ORDER), aShift = computeLpcCoeffs(shiftBuf, LPC_ORDER);
    for (let i = 0; i < len; i++) {
      let s = shiftBuf[i];
      for (let k = 1; k <= LPC_ORDER && i - k >= 0; k++) s += aShift[k] * shiftBuf[i - k];
      exc[i] = s;
    }
    let restSq = 0;
    for (let i = 0; i < len; i++) {
      let y = exc[i];
      for (let k = 1; k <= LPC_ORDER && i - k >= 0; k++) y -= aOrig[k] * restored[i - k];
      restored[i] = Math.max(-1.5, Math.min(1.5, y)); restSq += restored[i] * restored[i];
    }
    const gain = restSq > 1e-8 ? Math.sqrt(origSq / restSq) : 1;
    for (let i = 0; i < len; i++) {
      formantOut[start + i] += restored[i] * gain * win[i];
      winSum[start + i] += win[i] * win[i];
    }
  }
  for (let i = 0; i < n; i++) formantOut[i] = winSum[i] > 1e-4 ? formantOut[i] / winSum[i] : rawShifted[i];

  return blendUnvoicedTransientsAtUnityRatio(pcm, formantOut, sampleRate, frames, 4);
}

export function getOrComputeTroupeTransposedPCM(pcm: Float32Array, sampleRate: number, transpositionSemitones: number): Float32Array {
  if (!pcm || pcm.length === 0 || !transpositionSemitones) return pcm;
  const key = `${sampleRate}_${transpositionSemitones.toFixed(2)}`;
  let map = troupePcmCache.get(pcm);
  if (!map) { map = new Map(); troupePcmCache.set(pcm, map); }
  const cached = map.get(key);
  if (cached && cached.length === pcm.length) return cached;
  const computed = shiftVocalPitchFormantPreserved(pcm, sampleRate, transpositionSemitones);
  map.set(key, computed);
  return computed;
}
