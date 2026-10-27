/**
 * toadaPublishHelpers.ts
 * Extraction du buffer WAV découpé et assainissement strict (< 50 Ko)
 * du payload Firestore pour Sequenciador (< 120 lignes, Rule 6.A).
 */
import type { VocalPatternItem } from '../types/toadaProject.types';

export function pcmToWavBlob(pcm: Float32Array, sampleRate: number): Blob {
  const numChannels = 1, bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.length * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export interface SlicedPcmResult {
  slicedPcm: Float32Array;
  slicedDurationSec: number;
  exportedT1OffsetSec: number;
  startOffsetSec: number;
}

export function slicePatternPcm(
  fullPcm: Float32Array,
  sampleRate: number,
  rawT1OffsetSec: number,
  trimStartSec: number,
  trimEndSec: number
): SlicedPcmResult {
  const totalDuration = fullPcm.length / sampleRate;
  const safeStart = Math.max(0, Math.min(trimStartSec, totalDuration));
  const safeEnd = Math.max(safeStart + 0.05, Math.min(trimEndSec || totalDuration, totalDuration));

  const startSample = Math.floor(safeStart * sampleRate);
  const endSample = Math.min(fullPcm.length, Math.ceil(safeEnd * sampleRate));
  const slicedPcm = startSample < endSample ? fullPcm.slice(startSample, endSample) : fullPcm;
  const slicedDurationSec = slicedPcm.length / sampleRate;

  // L'ancre Temps 1 dans le buffer coupé qui démarre à 0s :
  const exportedT1OffsetSec = rawT1OffsetSec - safeStart;
  const startOffsetSec = safeStart - rawT1OffsetSec; // = -exportedT1OffsetSec

  return { slicedPcm, slicedDurationSec, exportedT1OffsetSec, startOffsetSec };
}

export function sanitizePatternForFirestore(
  p: VocalPatternItem,
  audioUrl?: string,
  slicedDurationSec?: number,
  exportedT1OffsetSec?: number,
  startOffsetSec?: number
): Record<string, any> {
  const sanitizedVariants: Record<string, any> = {};
  for (const [key, v] of Object.entries(p.variants || {})) {
    const { recordingResult, audioBuffer, ...vRest } = v as any;
    sanitizedVariants[key] = {
      ...vRest,
      audioUrl: audioUrl || (v as any).audioUrl,
      trimStartSec: 0,
      trimEndSec: slicedDurationSec ?? v.trimEndSec,
      t1OffsetSec: exportedT1OffsetSec ?? v.t1OffsetSec,
      startOffsetSec: startOffsetSec ?? (v as any).startOffsetSec,
      durationSec: slicedDurationSec ?? (v as any).durationSec,
    };
  }

  const {
    rawAudioSamples,
    correctedAudioSamples,
    recordingResult,
    rawPitchCurve,
    pitchCurve,
    ...patternRest
  } = p as any;

  return {
    ...patternRest,
    audioUrl,
    t1OffsetSec: exportedT1OffsetSec ?? p.t1OffsetSec,
    startOffsetSec: startOffsetSec ?? (p as any).startOffsetSec,
    trimStartSec: 0,
    trimEndSec: slicedDurationSec ?? p.trimEndSec,
    variants: sanitizedVariants,
  };
}
