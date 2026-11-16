/**
 * vocalDspTaskRunner.ts
 * Exécuteur pur partageable (Web Worker + Fallback Node.js) pour les 4 familles DSP de Cantador (< 115 lignes).
 * Zéro dépendance à window, document ou AudioContext — 100 % Float32Array et objets sérialisables.
 */
import { extractPatternMelodicData } from '../audio/melodicExtractionHelper';
import { extractContinuousPitchCurve } from '../audio/pitchExtractor';
import { reanalyzeNotesOnAlignedSyllables } from '../audio/syllableGuidedPitchReanalyzer';
import { computeCorrectedPitchCurve, correctAudioPitchWithMelodyne } from '../audio/melodynePitchCorrector';
import { shiftVocalPitchFormantPreserved } from '../audio/formantPreservingPitchShifter';
import { createPaddedPreviewBuffer, encodePcmToWavArrayBuffer } from '../utils/wavEncoder';
import type {
  VocalDspTaskType,
  VocalDspPayloadMap,
  VocalDspResultMap,
  ReanalyzeSyllablesTaskPayload,
  ReanalyzeSyllablesTaskResult,
  RenderVoiceTaskPayload,
  RenderVoiceTaskResult,
  EncodeWavTaskPayload,
  EncodeWavTaskResult,
} from './vocalDspProtocol.types';

function ensureOwnedFloat32(candidate: Float32Array, source: Float32Array): Float32Array {
  return candidate.buffer === source.buffer ? candidate.slice() : candidate;
}

function executeReanalyzeBatch(payload: ReanalyzeSyllablesTaskPayload): ReanalyzeSyllablesTaskResult {
  const items = (payload.items || []).map((item) => {
    const sr = item.sampleRate || 48000;
    const hasPcm = Boolean(item.pcm && item.pcm.length > 0);
    const durSec = item.totalDurationSec ?? (hasPcm ? item.pcm!.length / sr : 0);
    const curve = item.extractCurveFromPcm && hasPcm
      ? extractContinuousPitchCurve(item.pcm!, {
          sampleRate: sr, totalDurationSec: durSec, trimStartSec: 0, trimEndSec: durSec,
          tessitura: item.tessitura, vocalBounds: item.vocalBounds,
        })
      : (item.pitchCurve || []);

    const steps = reanalyzeNotesOnAlignedSyllables({
      steps: item.steps, pitchCurve: curve, gridStartSec: item.gridStartSec,
      stepDurationSec: item.stepDurationSec, beatDurationSec: item.beatDurationSec,
      tonic: item.tonic, scaleType: item.scaleType, allowedPitchClasses: item.allowedPitchClasses,
      vocalBounds: item.vocalBounds, referenceMidiNotes: item.referenceMidiNotes, pcm: item.pcm, sampleRate: sr,
    });
    return { id: item.id, steps, pitchCurve: curve };
  });
  return { items };
}

function executeRenderVoice(payload: RenderVoiceTaskPayload): RenderVoiceTaskResult {
  const { mode, pcm, sampleRate } = payload;
  const totalDur = payload.totalDurationSec ?? (pcm.length / Math.max(1, sampleRate));
  const curve = payload.rawPitchCurve || [], steps = payload.allSteps || [], regions = payload.regions || [];
  const shift = payload.shiftSemitones ?? 0;

  if (mode === 'formant_shift') {
    const shifted = shiftVocalPitchFormantPreserved(pcm, sampleRate, shift);
    return { processedPCM: ensureOwnedFloat32(shifted, pcm) };
  }

  const melodyned = correctAudioPitchWithMelodyne(
    pcm, sampleRate, totalDur, curve, steps, regions, payload.tGridStart, payload.gridDur
  );
  const correctedCurve = computeCorrectedPitchCurve(curve, steps, totalDur, regions, payload.tGridStart, payload.gridDur);
  if (mode === 'melodyne_and_shift' && Math.abs(shift) >= 0.01) {
    const shifted = shiftVocalPitchFormantPreserved(melodyned, sampleRate, shift);
    return { processedPCM: ensureOwnedFloat32(shifted, pcm), correctedCurve };
  }
  return { processedPCM: ensureOwnedFloat32(melodyned, pcm), correctedCurve };
}

function executeEncodeWav(payload: EncodeWavTaskPayload): EncodeWavTaskResult {
  const pad = payload.cleanPadding;
  const workingPcm = pad
    ? createPaddedPreviewBuffer(
        payload.pcm, payload.sampleRate, pad.totalDurationSec, pad.trimStartSec, pad.trimEndSec,
        pad.latencyOffsetMs ?? 0, pad.lowCutEnabled ?? true, pad.normalizeRMS ?? true,
        pad.enableTonePolish ?? true, pad.rawT1OffsetSec, pad.cleanT1OffsetSec
      )
    : payload.pcm;
  const wavArrayBuffer = encodePcmToWavArrayBuffer(workingPcm, payload.sampleRate, payload.targetSampleRate);
  const outRate = payload.targetSampleRate && payload.targetSampleRate > 0 ? payload.targetSampleRate : payload.sampleRate;
  return { wavArrayBuffer, sampleRate: outRate, durationSec: workingPcm.length / Math.max(1, payload.sampleRate) };
}

export function runVocalDspTask<T extends VocalDspTaskType>(
  taskType: T,
  payload: VocalDspPayloadMap[T]
): VocalDspResultMap[T] {
  switch (taskType) {
    case 'EXTRACT_MELODIC_DATA': {
      const res = extractPatternMelodicData(payload as VocalDspPayloadMap['EXTRACT_MELODIC_DATA']);
      const cleanPCM = ensureOwnedFloat32(res.cleanPCM, (payload as VocalDspPayloadMap['EXTRACT_MELODIC_DATA']).rawPCM);
      return { ...res, cleanPCM } as VocalDspResultMap[T];
    }
    case 'REANALYZE_ALIGNED_SYLLABLES':
      return executeReanalyzeBatch(payload as ReanalyzeSyllablesTaskPayload) as VocalDspResultMap[T];
    case 'RENDER_CORRECTED_OR_SHIFTED_VOICE':
      return executeRenderVoice(payload as RenderVoiceTaskPayload) as VocalDspResultMap[T];
    case 'ENCODE_WAV':
      return executeEncodeWav(payload as EncodeWavTaskPayload) as VocalDspResultMap[T];
  }
}

export function collectResultTransferables<T extends VocalDspTaskType>(
  taskType: T,
  result: VocalDspResultMap[T]
): Transferable[] {
  if (taskType === 'EXTRACT_MELODIC_DATA') return [(result as VocalDspResultMap['EXTRACT_MELODIC_DATA']).cleanPCM.buffer];
  if (taskType === 'RENDER_CORRECTED_OR_SHIFTED_VOICE') return [(result as RenderVoiceTaskResult).processedPCM.buffer];
  if (taskType === 'ENCODE_WAV') return [(result as EncodeWavTaskResult).wavArrayBuffer];
  return [];
}
