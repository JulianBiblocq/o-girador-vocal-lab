/**
 * wsolaPitchShifter.ts
 * Moteur de correction vocale Phase-Locked WSOLA (Waveform Similarity Overlap-Add)
 * Traitement continu par région Melodyne, fenêtres Hann 40ms, phase-locking et crossfade (< 120 lignes).
 */

export interface WsolaRegionTarget {
  startSec: number;
  endSec: number;
  shiftSemitonesAt: (timeSec: number) => number;
}

export function applyWsolaPitchCorrection(
  rawAudio: Float32Array,
  sampleRate: number,
  regions: WsolaRegionTarget[]
): Float32Array {
  if (!regions || regions.length === 0 || !rawAudio || rawAudio.length === 0) {
    return new Float32Array(rawAudio);
  }

  const out = new Float32Array(rawAudio);
  const winSize = Math.max(64, 2 * Math.round((0.040 * sampleRate) / 2)); // ~40ms pair
  const hop = Math.max(16, Math.round(0.010 * sampleRate)); // 10ms (75% overlap)
  const maxDelta = Math.max(8, Math.round(0.006 * sampleRate)); // ±6ms alignement phase
  const rampLen = Math.max(16, Math.round(0.020 * sampleRate)); // 20ms crossfade
  const halfWin = winSize / 2;

  const hann = new Float32Array(winSize);
  for (let i = 0; i < winSize; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (winSize - 1)));
  }

  for (const reg of regions) {
    const sStart = Math.max(0, Math.floor(reg.startSec * sampleRate));
    const sEnd = Math.min(rawAudio.length, Math.ceil(reg.endSec * sampleRate));
    const holdLen = sEnd - sStart;
    if (holdLen < winSize + maxDelta) continue;

    const synth = new Float32Array(holdLen);
    const weight = new Float32Array(holdLen);

    for (let outPos = 0; outPos + winSize <= holdLen; outPos += hop) {
      const curTimeSec = reg.startSec + (outPos + halfWin) / sampleRate;
      const shift = Math.max(-3.0, Math.min(3.0, reg.shiftSemitonesAt(curTimeSec)));
      if (Math.abs(shift) < 0.02) {
        // Décalage négligeable : passage direct du signal avec pondération Hann
        for (let j = 0; j < winSize; j++) {
          const idx = sStart + outPos + j;
          if (idx < rawAudio.length) {
            synth[outPos + j] += rawAudio[idx] * hann[j];
            weight[outPos + j] += hann[j];
          }
        }
        continue;
      }

      const r = Math.pow(2, shift / 12);
      const idealInCenter = sStart + outPos + halfWin;

      // Recherche de phase par corrélation croisée (Phase-Locked)
      let bestTau = 0;
      if (outPos > 0) {
        let maxCorr = -Infinity;
        const corrLen = Math.min(hop, 128);
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
        if (k < rampLen) {
          crossfade = 0.5 * (1 - Math.cos((Math.PI * k) / rampLen));
        } else if (k > holdLen - rampLen) {
          crossfade = 0.5 * (1 - Math.cos((Math.PI * (holdLen - k)) / rampLen));
        }
        out[sStart + k] = rawAudio[sStart + k] * (1 - crossfade) + grainVal * crossfade;
      }
    }
  }

  return out;
}
