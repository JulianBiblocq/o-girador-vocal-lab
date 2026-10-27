/**
 * wavEncoder.ts
 * Utilitaires purs de decoupe avec compensation de latence, filtre coupe-bas,
 * normalisation vocale intelligente -16 dBFS et encodage WAV 16-bit PCM mono.
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

  const offsetSec = latencyOffsetMs / 1000;
  const bufferStartSec = trimStartSec - offsetSec;
  const rawStartSample = Math.floor(bufferStartSec * sampleRate);

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
  for (let i = 0; i < fadeInSamples; i++) result[i] *= (i / fadeInSamples);

  const fadeOutSamples = Math.min(targetSamples, Math.floor(0.03 * sampleRate));
  for (let i = 0; i < fadeOutSamples; i++) {
    result[targetSamples - 1 - i] *= (i / fadeOutSamples);
  }

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
  const startSample = Math.max(0, Math.floor(destStartSec * sampleRate));
  const copyLen = Math.min(activeSlice.length, Math.max(0, totalSamples - startSample));
  if (copyLen > 0) fullBuffer.set(activeSlice.subarray(0, copyLen), startSample);
  return fullBuffer;
}

export function audioBufferToWavBase64(pcm: Float32Array, sampleRate: number): string {
  const numChannels = 1, bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.length * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192)));
  }
  return btoa(binary);
}
