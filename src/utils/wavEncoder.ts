/**
 * wavEncoder.ts
 * Utilitaires purs de découpe avec compensation de latence, micro-fondus et encodage WAV 16-bit.
 */

/**
 * Extrait la portion utile entre trimStartSec et trimEndSec en appliquant la compensation
 * de latence matérielle et les micro-fondus anti-clic (10ms in / 30ms out).
 */
export function extractCompensatedSlice(
  rawPCM: Float32Array,
  sampleRate: number,
  trimStartSec: number,
  trimEndSec: number,
  latencyOffsetMs: number
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

  // Micro-fondu d'entrée de 10 ms
  const fadeInSamples = Math.min(targetSamples, Math.floor(0.01 * sampleRate));
  for (let i = 0; i < fadeInSamples; i++) {
    result[i] *= (i / fadeInSamples);
  }

  // Micro-fondu de sortie de 30 ms
  const fadeOutSamples = Math.min(targetSamples, Math.floor(0.03 * sampleRate));
  for (let i = 0; i < fadeOutSamples; i++) {
    const idx = targetSamples - 1 - i;
    result[idx] *= (i / fadeOutSamples);
  }

  return result;
}

/**
 * Encode un buffer PCM mono en Data URL base64 WAV 16-bit.
 */
export function audioBufferToWavBase64(channelData: Float32Array, sampleRate: number): string {
  const numSamples = channelData.length;
  const blockAlign = 2; // 16-bit mono
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // 1 canal
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);

  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 0x8000;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, Math.min(i + chunkSize, len))));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
