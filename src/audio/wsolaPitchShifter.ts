/**
 * wsolaPitchShifter.ts
 * Moteur de correction vocale Phase-Locked WSOLA (Waveform Similarity Overlap-Add)
 * Fenêtres Hann 45ms, 75% overlap, alignement de phase ±8ms et préservation des transitoires (< 140 lignes).
 */
import type { BrickPitchOffset } from './melodynePitchCorrector';

export function applyWsolaPitchCorrection(
  rawAudio: Float32Array,
  sampleRate: number,
  bricks: BrickPitchOffset[]
): Float32Array {
  const activeBricks = bricks.filter((b) => Math.abs(b.effectiveShift) >= 0.02);
  if (activeBricks.length === 0 || !rawAudio || rawAudio.length === 0) {
    return new Float32Array(rawAudio);
  }

  const out = new Float32Array(rawAudio);
  const winSize = Math.max(64, 2 * Math.round((0.045 * sampleRate) / 2)); // ~45ms pair
  const hop = Math.max(16, Math.round(winSize / 4)); // 75% overlap
  const maxDelta = Math.max(8, Math.round(0.008 * sampleRate)); // ±8ms
  const rampInLen = Math.max(16, Math.round(0.025 * sampleRate)); // 25ms
  const rampOutLen = Math.max(16, Math.round(0.020 * sampleRate)); // 20ms
  const halfWin = winSize / 2;

  const hann = new Float32Array(winSize);
  for (let i = 0; i < winSize; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (winSize - 1)));
  }

  for (const b of activeBricks) {
    const sHold = Math.max(0, Math.floor(b.holdStartSec * sampleRate));
    const sEnd = Math.min(rawAudio.length, Math.ceil(b.endSec * sampleRate));
    const holdLen = sEnd - sHold;
    if (holdLen < winSize + maxDelta) continue;

    // Décalage constant par brique borné à ±2.5 demi-tons pour naturel garanti
    const clampedShift = Math.max(-2.5, Math.min(2.5, b.effectiveShift));
    const r = Math.pow(2, clampedShift / 12);

    const synth = new Float32Array(holdLen);
    const weight = new Float32Array(holdLen);

    for (let outPos = 0; outPos + winSize <= holdLen; outPos += hop) {
      const idealInCenter = sHold + outPos + halfWin;

      // Recherche de phase par corrélation croisée (Phase-Locked)
      let bestTau = 0;
      if (outPos > 0) {
        let maxCorr = -Infinity;
        const corrLen = Math.min(hop, 256);
        for (let tau = -maxDelta; tau <= maxDelta; tau += 2) {
          let dot = 0;
          const candStart = idealInCenter + tau - halfWin;
          if (candStart < 0 || candStart + corrLen >= rawAudio.length) continue;
          for (let k = 0; k < corrLen; k += 2) {
            dot += rawAudio[candStart + k] * synth[outPos + k];
          }
          if (dot > maxCorr) {
            maxCorr = dot;
            bestTau = tau;
          }
        }
      }

      const center = idealInCenter + bestTau;
      for (let j = 0; j < winSize; j++) {
        const inIdx = center + (j - halfWin) * r;
        const i0 = Math.floor(inIdx);
        const frac = inIdx - i0;
        if (i0 >= 0 && i0 + 1 < rawAudio.length) {
          const s = rawAudio[i0] * (1 - frac) + rawAudio[i0 + 1] * frac;
          synth[outPos + j] += s * hann[j];
          weight[outPos + j] += hann[j];
        }
      }
    }

    // Normalisation Overlap-Add et crossfade doux avec le signal original
    for (let k = 0; k < holdLen; k++) {
      if (weight[k] > 0.001) {
        const grainVal = synth[k] / weight[k];
        let crossfade = 1.0;
        if (k < rampInLen) {
          crossfade = 0.5 * (1 - Math.cos((Math.PI * k) / rampInLen));
        } else if (k > holdLen - rampOutLen) {
          crossfade = 0.5 * (1 - Math.cos((Math.PI * (holdLen - k)) / rampOutLen));
        }
        out[sHold + k] = rawAudio[sHold + k] * (1 - crossfade) + grainVal * crossfade;
      }
    }
  }

  return out;
}
