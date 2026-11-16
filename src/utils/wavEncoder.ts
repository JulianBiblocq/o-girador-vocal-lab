/**
 * wavEncoder.ts
 * Utilitaires purs de découpe avec compensation de latence, filtre coupe-bas,
 * normalisation vocale intelligente -16 dBFS, rééchantillonnage Hermite et encodage WAV 16-bit PCM mono (< 125 lignes).
 */
import { applyHighPass90Hz } from '../audio/vocalFilterHelper';
import { applyVocalToneShaping } from '../audio/vocalToneShaper';
import { normalizeActiveRMS } from '../audio/vocalNormalizer';

export function extractCompensatedSlice(
  rawPCM: Float32Array,
  sampleRate: number,
  trimStartSec: number,
  trimEndSec: number,
  latencyOffsetMs: number,
  highPassFilterEnabled = true,
  normalizeRMS = true,
  enableTonePolish = true
): Float32Array {
  const durationSec = Math.max(0.01, trimEndSec - trimStartSec);
  const targetSamples = Math.floor(durationSec * sampleRate);
  const result = new Float32Array(targetSamples);

  const rawStartSample = Math.floor((trimStartSec - latencyOffsetMs / 1000) * sampleRate);
  const sourceStart = Math.max(0, rawStartSample);
  const sourceEnd = Math.min(rawPCM.length, rawStartSample + targetSamples);
  const destStart = rawStartSample < 0 ? -rawStartSample : 0;
  const copyLength = Math.max(0, Math.min(sourceEnd - sourceStart, targetSamples - destStart));

  if (copyLength > 0 && sourceStart < rawPCM.length && destStart < targetSamples) {
    result.set(rawPCM.subarray(sourceStart, sourceStart + copyLength), destStart);
  }

  if (highPassFilterEnabled) applyHighPass90Hz(result, sampleRate);
  if (enableTonePolish) applyVocalToneShaping(result, sampleRate);
  if (normalizeRMS) normalizeActiveRMS(result, sampleRate);

  const fadeInSamples = Math.min(targetSamples, Math.floor(0.01 * sampleRate));
  for (let i = 0; i < fadeInSamples; i++) result[i] *= i / fadeInSamples;
  const fadeOutSamples = Math.min(targetSamples, Math.floor(0.03 * sampleRate));
  for (let i = 0; i < fadeOutSamples; i++) result[targetSamples - 1 - i] *= i / fadeOutSamples;
  return result;
}

export function createPaddedPreviewBuffer(
  rawPCM: Float32Array,
  sampleRate: number,
  totalDurationSec: number,
  trimStartSec: number,
  trimEndSec: number,
  latencyOffsetMs: number,
  highPassFilterEnabled = true,
  normalizeRMS = true,
  enableTonePolish = true,
  rawT1OffsetSec?: number,
  cleanT1OffsetSec?: number
): Float32Array {
  const totalSamples = Math.floor(totalDurationSec * sampleRate);
  const fullBuffer = new Float32Array(totalSamples);
  const activeSlice = extractCompensatedSlice(
    rawPCM, sampleRate, trimStartSec, trimEndSec,
    latencyOffsetMs, highPassFilterEnabled, normalizeRMS, enableTonePolish
  );
  let destStartSec = trimStartSec;
  if (rawT1OffsetSec !== undefined && cleanT1OffsetSec !== undefined) {
    destStartSec = cleanT1OffsetSec + (trimStartSec - rawT1OffsetSec);
  }
  const srcSkipSamples = destStartSec < 0 ? Math.min(activeSlice.length, Math.round(-destStartSec * sampleRate)) : 0;
  const startSample = destStartSec < 0 ? 0 : Math.round(destStartSec * sampleRate);
  const copyLen = Math.min(activeSlice.length - srcSkipSamples, Math.max(0, totalSamples - startSample));
  if (copyLen > 0) fullBuffer.set(activeSlice.subarray(srcSkipSamples, srcSkipSamples + copyLen), startSample);
  return fullBuffer;
}

function resampleHermiteIfNeeded(pcm: Float32Array, srcRate: number, dstRate?: number): { samples: Float32Array; rate: number } {
  const outRate = dstRate && dstRate > 0 ? dstRate : srcRate;
  if (!pcm || pcm.length === 0 || srcRate <= 0 || outRate === srcRate) return { samples: pcm, rate: srcRate };
  const nIn = pcm.length, ratio = srcRate / outRate, nOut = Math.max(1, Math.round(nIn / ratio));
  const out = new Float32Array(nOut);
  for (let i = 0; i < nOut; i++) {
    const pos = i * ratio, idx = Math.floor(pos), t = pos - idx;
    const y0 = pcm[Math.max(0, idx - 1)], y1 = pcm[Math.min(nIn - 1, idx)];
    const y2 = pcm[Math.min(nIn - 1, idx + 1)], y3 = pcm[Math.min(nIn - 1, idx + 2)];
    const c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
    out[i] = Math.max(-1, Math.min(1, ((c3 * t + c2) * t + c1) * t + y1));
  }
  return { samples: out, rate: outRate };
}

export function encodePcmToWavArrayBuffer(pcm: Float32Array, sampleRate: number, targetSampleRate?: number): ArrayBuffer {
  const { samples, rate } = resampleHermiteIfNeeded(pcm, sampleRate, targetSampleRate);
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };

  writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); writeStr(8, 'WAVE');
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); writeStr(36, 'data'); view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

export function audioBufferToWavBase64(pcm: Float32Array, sampleRate: number): string {
  const bytes = new Uint8Array(encodePcmToWavArrayBuffer(pcm, sampleRate));
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)));
  }
  return btoa(binary);
}
