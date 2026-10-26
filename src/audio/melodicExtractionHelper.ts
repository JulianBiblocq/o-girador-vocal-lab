/**
 * melodicExtractionHelper.ts
 * Pipeline unifie d'extraction de pitch Viterbi et de quantification MIDI (< 130 lignes).
 * Utilise sur la portion trimmee [trimStartSec, trimEndSec] de l'AudioBuffer.
 */
import type { VocalPackExport, PitchCurvePoint, VocalStepData, TimeSignatureString } from '../types/vocalPack.types';
import type { TessituraRange } from '../types/tessitura.types';
import { createPaddedPreviewBuffer, audioBufferToWavBase64 } from '../utils/wavEncoder';
import { extractContinuousPitchCurve } from './pitchExtractor';
import { quantizePitchToSteps } from './pitchToStepsQuantizer';
import { applyLyricsSyllablesToSteps } from '../utils/syllableAligner';
import { getPatternT1OffsetSec, getPatternTotalDurationSec } from '../utils/anacrusisTimingHelper';
import { computeAlignmentMeta } from '../utils/alignmentMath';

export interface ExtractMelodicParams {
  rawPCM: Float32Array;
  sampleRate: number;
  bpm: number;
  timeSignature: TimeSignatureString;
  measuresCount: number;
  beatsPerMeasure: number;
  beatResolutions: number[];
  hasAnacrusis: boolean;
  trimStartSec?: number;
  trimEndSec?: number;
  referencePitch: string;
  pitchShiftSemitones?: number;
  tessitura?: TessituraRange;
  assignedLyricsText?: string;
  timeAnchors?: import('../types/toadaDocument.types').TimeAnchor[];
  lowCutEnabled?: boolean;
  enableTonePolish?: boolean;
  t1OffsetSec?: number;
}

export interface ExtractMelodicResult {
  pack: VocalPackExport;
  cleanPCM: Float32Array;
  pitchCurve: PitchCurvePoint[];
  anacrusisSteps: VocalStepData[];
  mainSteps: VocalStepData[];
  allSteps: VocalStepData[];
  totalDurationSec: number;
}

export function extractPatternMelodicData(params: ExtractMelodicParams): ExtractMelodicResult {
  const {
    rawPCM, sampleRate, bpm, timeSignature, measuresCount, beatsPerMeasure,
    beatResolutions, hasAnacrusis, referencePitch, pitchShiftSemitones = 0,
    tessitura, assignedLyricsText, timeAnchors, lowCutEnabled = true, enableTonePolish = true,
  } = params;

  const beatDuration = 60 / bpm;
  const measureDuration = beatsPerMeasure * beatDuration;
  const t1OffsetSec = getPatternT1OffsetSec(hasAnacrusis, measureDuration, params.t1OffsetSec);
  const totalDurationSec = getPatternTotalDurationSec(hasAnacrusis, measuresCount, measureDuration, 0.25, beatDuration, t1OffsetSec);

  const vTrimStart = Math.max(0, params.trimStartSec ?? 0);
  const vTrimEnd = params.trimEndSec && params.trimEndSec > 0 ? Math.min(totalDurationSec, params.trimEndSec) : totalDurationSec;

  const cleanPCM = createPaddedPreviewBuffer(
    rawPCM, sampleRate, totalDurationSec, vTrimStart, vTrimEnd, 0,
    lowCutEnabled, true, enableTonePolish
  );

  const pitchCurve = extractContinuousPitchCurve(cleanPCM, {
    sampleRate,
    totalDurationSec,
    trimStartSec: vTrimStart,
    trimEndSec: vTrimEnd,
    tessitura,
  });

  const q = quantizePitchToSteps({
    pitchCurve,
    bpm,
    beatsPerMeasure,
    measuresCount,
    beatResolutions,
    trimStartSec: vTrimStart,
    trimEndSec: vTrimEnd,
    pcm: cleanPCM,
    sampleRate,
    hasAnacrusis,
    t1OffsetSec,
    pitchOffsetSemitones: pitchShiftSemitones,
    timeAnchors,
  });

  const rawSteps = hasAnacrusis ? [...q.anacrusisSteps, ...q.gridSteps] : q.gridSteps;
  const allSteps = assignedLyricsText ? applyLyricsSyllablesToSteps(rawSteps, assignedLyricsText) : rawSteps;
  const anacCount = hasAnacrusis ? q.anacrusisSteps.length : 0;
  const anacrusisSteps = hasAnacrusis ? allSteps.slice(0, anacCount) : [];
  const mainSteps = (hasAnacrusis ? allSteps.slice(anacCount) : allSteps).map((s, idx) => ({ ...s, stepIndex: idx }));

  const alignment = computeAlignmentMeta(t1OffsetSec, vTrimStart, vTrimEnd, bpm, hasAnacrusis);
  const audioBase64 = audioBufferToWavBase64(cleanPCM, sampleRate);
  const pack: VocalPackExport = {
    schemaVersion: '1.0',
    metadata: {
      bpm,
      timeSignature,
      measuresCount,
      beatResolutions,
      referencePitch,
      createdAt: new Date().toISOString(),
    },
    alignment: {
      startOffsetSec: alignment.startOffsetSec,
      anacrusis: {
        ...alignment.anacrusis,
        steps: anacrusisSteps,
      },
      nudgeMs: 0,
    },
    grid: {
      steps: mainSteps,
      totalSteps: mainSteps.length,
    },
    audio: {
      format: 'wav',
      sampleRate,
      channels: 1,
      durationSec: totalDurationSec,
      audioBase64,
      nudgeMs: 0,
      trim: {
        startSec: vTrimStart,
        endSec: vTrimEnd,
      },
    },
  };

  return {
    pack,
    cleanPCM,
    pitchCurve,
    anacrusisSteps,
    mainSteps,
    allSteps,
    totalDurationSec,
  };
}
