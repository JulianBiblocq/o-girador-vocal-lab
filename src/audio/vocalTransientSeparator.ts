/**
 * vocalTransientSeparator.ts
 * Étage A du moteur de transposition vocale Studio : détection Voisé / Non-Voisé par trames de 10 ms
 * (HNR autocorrélation normalisée, ZCR, Onset Flux) et verrouillage 1:1 des consonnes percussives
 * avec fondu croisé cosinus de 4 ms aux jonctions (< 130 lignes).
 */

export interface VocalFrameClassification {
  frameIndex: number; startSample: number; endSample: number;
  rms: number; zcr: number; hnr: number; onsetFlux: number;
  isUnvoicedOrTransient: boolean; estimatedPeriodSamples: number;
}

export function analyzeVocalFrames(pcm: Float32Array, sampleRate: number, frameMs = 10): VocalFrameClassification[] {
  const n = pcm.length;
  if (n === 0 || sampleRate <= 0) return [];
  const frameLen = Math.max(64, Math.round((frameMs / 1000) * sampleRate));
  const minLag = Math.max(8, Math.floor(sampleRate / 650)), maxLag = Math.min(frameLen * 2, Math.ceil(sampleRate / 75));
  const frames: VocalFrameClassification[] = [];
  let prevRms = 0;

  for (let start = 0, idx = 0; start < n; start += frameLen, idx++) {
    const end = Math.min(n, start + frameLen), len = end - start;
    let sumSq = 0, diffSq = 0, zeroCrossings = 0;
    for (let i = start; i < end; i++) {
      const v = pcm[i];
      sumSq += v * v;
      if (i > start) {
        const prev = pcm[i - 1], d = v - prev;
        diffSq += d * d;
        if ((v >= 0 && prev < 0) || (v < 0 && prev >= 0)) zeroCrossings++;
      }
    }

    const rms = Math.sqrt(sumSq / Math.max(1, len)), zcr = zeroCrossings / Math.max(1, len - 1);
    const hfRatio = sumSq > 1e-9 ? diffSq / sumSq : 0;
    const rmsJump = prevRms > 1e-4 ? Math.max(0, (rms - prevRms) / prevRms) : (rms > 0.015 ? 2.5 : 0);
    const onsetFlux = rmsJump + hfRatio * 1.35;
    prevRms = rms * 0.7 + prevRms * 0.3;

    let bestCorr = 0, bestLag = Math.round(sampleRate / 180);
    const corrWin = Math.min(n - start, Math.max(len, maxLag + 32));
    if (rms >= 0.003 && corrWin > minLag + 8) {
      const step = sampleRate > 32000 ? 2 : 1;
      for (let lag = minLag; lag <= maxLag && lag + 16 < corrWin; lag += step) {
        let num = 0, e1 = 0, e2 = 0;
        const win = Math.min(len, corrWin - lag);
        for (let k = 0; k < win; k += step) {
          const a = pcm[start + k], b = pcm[start + k + lag];
          num += a * b; e1 += a * a; e2 += b * b;
        }
        const denom = Math.sqrt(e1 * e2), corr = denom > 1e-9 ? num / denom : 0;
        if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
      }
    }

    const hnr = Math.max(0, Math.min(1, bestCorr));
    const isUnvoicedOrTransient = rms < 0.003 || zcr > 0.22 || (hfRatio > 0.62 && hnr < 0.58) || (onsetFlux > 2.25 && hnr < 0.64) || hnr < 0.38;
    frames.push({
      frameIndex: idx, startSample: start, endSample: end, rms, zcr, hnr, onsetFlux,
      isUnvoicedOrTransient, estimatedPeriodSamples: bestLag,
    });
  }
  return frames;
}

export function blendUnvoicedTransientsAtUnityRatio(
  originalPcm: Float32Array,
  shiftedVoicedPcm: Float32Array,
  sampleRate: number,
  frames?: VocalFrameClassification[],
  crossfadeMs = 4
): Float32Array {
  const n = originalPcm.length;
  if (n === 0) return new Float32Array(0);
  const resolvedFrames = frames ?? analyzeVocalFrames(originalPcm, sampleRate, 10);
  const mask = new Float32Array(n);
  for (const f of resolvedFrames) {
    const val = f.isUnvoicedOrTransient ? 1 : 0;
    for (let i = f.startSample; i < f.endSample && i < n; i++) mask[i] = val;
  }

  const cfSamples = Math.max(8, Math.round((crossfadeMs / 1000) * sampleRate)), halfCf = Math.max(4, Math.floor(cfSamples / 2));
  const smoothMask = new Float32Array(mask);
  for (let fIdx = 1; fIdx < resolvedFrames.length; fIdx++) {
    const prev = resolvedFrames[fIdx - 1], curr = resolvedFrames[fIdx];
    if (prev.isUnvoicedOrTransient !== curr.isUnvoicedOrTransient) {
      const boundary = curr.startSample, s0 = Math.max(0, boundary - halfCf), s1 = Math.min(n, boundary + halfCf);
      const span = Math.max(1, s1 - s0), fromVal = prev.isUnvoicedOrTransient ? 1 : 0, toVal = curr.isUnvoicedOrTransient ? 1 : 0;
      for (let i = s0; i < s1; i++) {
        const cosW = 0.5 * (1 - Math.cos((Math.PI * (i - s0)) / span));
        smoothMask[i] = fromVal + (toVal - fromVal) * cosW;
      }
    }
  }

  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const wUnvoiced = smoothMask[i], orig = originalPcm[i], shifted = i < shiftedVoicedPcm.length ? shiftedVoicedPcm[i] : orig;
    out[i] = wUnvoiced * orig + (1 - wUnvoiced) * shifted;
  }
  return out;
}
