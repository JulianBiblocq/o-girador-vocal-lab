/**
 * toadaPublishHelpers.ts
 * Extraction du buffer WAV maître unique 48 kHz PCM 16-bit Mono par motif vocal (avec transposition
 * dans la Tonalité Troupe, zéro speedVariants 75%/88%, zéro double-trim) et assainissement Firestore `/toada_packs` (< 140 lignes).
 */
import type { VocalPatternItem } from '../types/toadaProject.types';
import { transposeVocalSteps } from '../utils/scaleTranspositionHelper';
import { transposePitchNote } from '../utils/musicalMath';
import { isPatternReadyForSequenciador } from '../utils/toadaPackExporter';

export const EXPORT_WAV_SAMPLE_RATE = 48000;

export interface SanitizePatternMeta {
  sungKey?: string;
  troupeKey?: string;
  ignoreMelodyPitch?: boolean;
  recordedBpm?: number;
}

export function resamplePcmHermite(pcm: Float32Array, srcRate: number, dstRate = EXPORT_WAV_SAMPLE_RATE): Float32Array {
  if (!pcm || pcm.length === 0 || srcRate <= 0 || srcRate === dstRate) return pcm;
  const nIn = pcm.length, ratio = srcRate / dstRate, nOut = Math.max(1, Math.round(nIn / ratio));
  const out = new Float32Array(nOut);
  for (let i = 0; i < nOut; i++) {
    const pos = i * ratio, idx = Math.floor(pos), t = pos - idx;
    const y0 = pcm[Math.max(0, idx - 1)], y1 = pcm[Math.min(nIn - 1, idx)];
    const y2 = pcm[Math.min(nIn - 1, idx + 1)], y3 = pcm[Math.min(nIn - 1, idx + 2)];
    const c1 = 0.5 * (y2 - y0), c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3, c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);
    out[i] = Math.max(-1, Math.min(1, ((c3 * t + c2) * t + c1) * t + y1));
  }
  return out;
}

export function pcmToWavBlob(pcm: Float32Array, sampleRate: number): Blob {
  const hdPcm = resamplePcmHermite(pcm, sampleRate, EXPORT_WAV_SAMPLE_RATE);
  const outRate = EXPORT_WAV_SAMPLE_RATE, numChannels = 1, bitsPerSample = 16;
  const byteRate = outRate * numChannels * (bitsPerSample / 8), blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = hdPcm.length * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); writeStr(8, 'WAVE');
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true); view.setUint32(24, outRate, true);
  view.setUint32(28, byteRate, true); view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true); writeStr(36, 'data'); view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < hdPcm.length; i++) {
    const s = Math.max(-1, Math.min(1, hdPcm[i]));
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
  const safeStart = Math.max(0, Math.min(trimStartSec || 0, totalDuration));
  const safeT1 = Math.max(0, Math.min(rawT1OffsetSec || 0, totalDuration));
  const cutStartSec = rawT1OffsetSec < 0 ? safeStart : Math.min(safeStart, safeT1);
  const safeEnd = Math.max(safeStart + 0.05, Math.min(trimEndSec && trimEndSec > safeStart ? trimEndSec : totalDuration, totalDuration));

  const startSample = Math.floor(cutStartSec * sampleRate);
  const voiceStartSample = Math.floor(safeStart * sampleRate);
  const endSample = Math.min(fullPcm.length, Math.ceil(safeEnd * sampleRate));
  let slicedPcm = startSample < endSample ? fullPcm.slice(startSample, endSample) : fullPcm.slice();

  const muteCount = Math.min(slicedPcm.length, Math.max(0, voiceStartSample - startSample));
  if (muteCount > 0) {
    slicedPcm.fill(0, 0, muteCount);
    const fadeSamples = Math.min(Math.round(sampleRate * 0.005), slicedPcm.length - muteCount);
    for (let i = 0; i < fadeSamples; i++) slicedPcm[muteCount + i] *= i / fadeSamples;
  } else if (rawT1OffsetSec < 0) {
    const padSamples = Math.round(Math.abs(rawT1OffsetSec) * sampleRate);
    const fadeSamples = Math.min(Math.round(sampleRate * 0.005), slicedPcm.length);
    for (let i = 0; i < fadeSamples; i++) slicedPcm[i] *= i / fadeSamples;
    const padded = new Float32Array(padSamples + slicedPcm.length);
    padded.set(slicedPcm, padSamples);
    slicedPcm = padded;
  }

  const slicedDurationSec = Number((slicedPcm.length / sampleRate).toFixed(6));
  const exportedT1OffsetSec = rawT1OffsetSec < 0 ? 0 : Number(Math.max(0, safeT1 - cutStartSec).toFixed(6));
  const startOffsetSec = Number((-exportedT1OffsetSec).toFixed(6));

  return { slicedPcm, slicedDurationSec, exportedT1OffsetSec, startOffsetSec };
}

export function sanitizePatternForFirestore(
  p: VocalPatternItem,
  audioUrl?: string,
  slicedDurationSec?: number,
  exportedT1OffsetSec?: number,
  startOffsetSec?: number,
  transpositionSemitones = 0,
  meta?: SanitizePatternMeta
): Record<string, any> {
  const recBpm = Number((p as any).recordedBpm || p.recordingResult?.recordedBpm || meta?.recordedBpm || p.baseBpm || p.bpm || 88);
  const resolvedAudioUrl = audioUrl || (p as any).audioUrl;
  const resolvedTrimStart = slicedDurationSec !== undefined ? 0 : (p.trimStartSec ?? 0);
  const resolvedTrimEnd = slicedDurationSec ?? p.trimEndSec ?? 0;
  const resolvedT1 = exportedT1OffsetSec ?? p.t1OffsetSec ?? 0;
  const resolvedStartOffset = startOffsetSec ?? (p as any).startOffsetSec ?? -resolvedT1;

  const {
    pack: _pack, rawAudioSamples: _raw, correctedAudioSamples: _corr, troupeTransposedPCM: _troupePcm,
    recordingResult: _recRes, rawPitchCurve: _rawCurve, pitchCurve: _curve,
    variants: _variants, speedVariants: _speedVars, variantSpeedsConfig: _varSpeedsCfg, ...patternRest
  } = p as any;

  return {
    ...patternRest,
    isReady: Boolean(resolvedAudioUrl || isPatternReadyForSequenciador(p)),
    bpm: recBpm, baseBpm: recBpm, recordedBpm: recBpm, sampleRate: EXPORT_WAV_SAMPLE_RATE,
    sungKey: meta?.sungKey ?? (p as any).sungKey, troupeKey: meta?.troupeKey ?? (p as any).troupeKey,
    referencePitch: transposePitchNote(p.referencePitch || 'A3', transpositionSemitones),
    sungReferencePitch: p.referencePitch || 'A3', transpositionSemitones,
    ignoreMelodyPitch: meta?.ignoreMelodyPitch ?? (p as any).ignoreMelodyPitch ?? false,
    hasAnacrusis: p.hasAnacrusis !== false, hasTailBeat: Boolean(p.hasTailBeat || p.exitBeat === 1),
    anacrusisSteps: transposeVocalSteps(p.anacrusisSteps || [], transpositionSemitones),
    mainSteps: transposeVocalSteps(p.mainSteps || [], transpositionSemitones),
    audioUrl: resolvedAudioUrl, t1OffsetSec: resolvedT1, startOffsetSec: resolvedStartOffset,
    trimStartSec: resolvedTrimStart, trimEndSec: resolvedTrimEnd,
  };
}
