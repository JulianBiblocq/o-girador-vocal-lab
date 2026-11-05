/**
 * toadaPublishHelpers.ts
 * Extraction du buffer WAV découpé et assainissement strict (< 50 Ko, zéro Base64)
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
  const exportedT1OffsetSec = Math.max(0, rawT1OffsetSec - safeStart);
  const startOffsetSec = -exportedT1OffsetSec;

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
  const activeKey = p.activeVariantKey || 'spd100_pit+0';

  for (const [key, v] of Object.entries(p.variants || {})) {
    const isActive = key === activeKey;
    const hasOwnRecording = Boolean(v.recordingResult?.pcm?.length || (v as any).audioUrl);
    if (!isActive && !hasOwnRecording) continue;

    const { recordingResult: _rec, audioBuffer: _buf, audioBase64: _b64, ...vRest } = v as any;
    const varAudioUrl = isActive ? (audioUrl || (v as any).audioUrl) : (v as any).audioUrl;
    if (!varAudioUrl) continue;

    sanitizedVariants[key] = {
      ...vRest,
      audioUrl: varAudioUrl,
      trimStartSec: 0,
      trimEndSec: isActive ? (slicedDurationSec ?? v.trimEndSec) : v.trimEndSec,
      t1OffsetSec: isActive ? (exportedT1OffsetSec ?? v.t1OffsetSec) : v.t1OffsetSec,
      startOffsetSec: isActive ? (startOffsetSec ?? (v as any).startOffsetSec) : (v as any).startOffsetSec,
      durationSec: isActive ? (slicedDurationSec ?? (v as any).durationSec) : (v as any).durationSec,
    };
  }

  const {
    pack: _pack,
    rawAudioSamples: _raw,
    correctedAudioSamples: _corr,
    recordingResult: _recRes,
    rawPitchCurve: _rawCurve,
    pitchCurve: _curve,
    ...patternRest
  } = p as any;

  const patBpm = p.bpm ?? p.baseBpm ?? 88;
  return {
    ...patternRest,
    bpm: patBpm,
    baseBpm: patBpm,
    audioUrl,
    t1OffsetSec: exportedT1OffsetSec ?? p.t1OffsetSec,
    startOffsetSec: startOffsetSec ?? (p as any).startOffsetSec,
    trimStartSec: 0,
    trimEndSec: slicedDurationSec ?? p.trimEndSec,
    variants: sanitizedVariants,
  };
}
