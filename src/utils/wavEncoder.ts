/**
 * wavEncoder.ts
 * Utilitaires purs de découpe avec micro-fondus anti-clic et encodage WAV 16-bit PCM base64.
 */

/**
 * Applique la découpe Trim avec un fondu d'attaque (10ms) et d'extinction (30ms).
 */
export function applyTrimWithFades(
  rawPCM: Float32Array,
  sampleRate: number,
  trimStartSec: number,
  trimEndSec: number
): Float32Array {
  const startSample = Math.max(0, Math.floor(trimStartSec * sampleRate));
  const endSample = Math.min(rawPCM.length, Math.ceil(trimEndSec * sampleRate));
  const cleanLength = Math.max(0, endSample - startSample);

  const cleanPCM = new Float32Array(cleanLength);
  cleanPCM.set(rawPCM.subarray(startSample, endSample));

  // Micro-fondu d'entrée de 10 ms (fade-in)
  const fadeInSamples = Math.min(cleanLength, Math.floor(0.01 * sampleRate));
  for (let i = 0; i < fadeInSamples; i++) {
    const gain = i / fadeInSamples;
    cleanPCM[i] *= gain;
  }

  // Micro-fondu de sortie de 30 ms (fade-out)
  const fadeOutSamples = Math.min(cleanLength, Math.floor(0.03 * sampleRate));
  for (let i = 0; i < fadeOutSamples; i++) {
    const gain = i / fadeOutSamples;
    const idx = cleanLength - 1 - i;
    cleanPCM[idx] *= gain;
  }

  return cleanPCM;
}

/**
 * Encode un buffer PCM mono en Data URL base64 WAV 16-bit ('data:audio/wav;base64,...').
 */
export function audioBufferToWavBase64(channelData: Float32Array, sampleRate: number): string {
  const numSamples = channelData.length;
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Écriture du header RIFF
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // Sous-chunk "fmt "
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Taille du sous-chunk fmt (16 pour PCM)
  view.setUint16(20, 1, true); // Format PCM linéaire
  view.setUint16(22, numChannels, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16-bit

  // Sous-chunk "data"
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Écriture des échantillons en entiers 16-bit signés
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  // Conversion ArrayBuffer en base64
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 0x8000;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, Math.min(i + chunkSize, len)))
    );
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
