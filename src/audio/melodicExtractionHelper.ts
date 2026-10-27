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
  const cleanT1OffsetSec = hasAnacrusis ? measureDuration : 0.15;
  const rawT1OffsetSec = getPatternT1OffsetSec(hasAnacrusis, measureDuration, params.t1OffsetSec);
  const totalDurationSec = getPatternTotalDurationSec(hasAnacrusis, measuresCount, measureDuration, 0.25, beatDuration, cleanT1OffsetSec);

  const rawTrimStart = Math.max(0, params.trimStartSec ?? 0);
  const rawTrimEnd = params.trimEndSec && params.trimEndSec > 0 ? params.trimEndSec : (rawPCM.length / sampleRate);
  const deltaT = cleanT1OffsetSec - rawT1OffsetSec;
  const cleanTrimStart = Math.max(0, rawTrimStart + deltaT);
  const cleanTrimEnd = Math.min(totalDurationSec, Math.max(cleanTrimStart + 0.1, rawTrimEnd + deltaT));

  const cleanPCM = createPaddedPreviewBuffer(
    rawPCM, sampleRate, totalDurationSec, rawTrimStart, rawTrimEnd, 0,
    lowCutEnabled, true, enableTonePolish, rawT1OffsetSec, cleanT1OffsetSec
  );

  const pitchCurve = extractContinuousPitchCurve(cleanPCM, {
    sampleRate,
    totalDurationSec,
    trimStartSec: cleanTrimStart,
    trimEndSec: cleanTrimEnd,
    tessitura,
  });

  const q = quantizePitchToSteps({
    pitchCurve,
    bpm,
    beatsPerMeasure,
    measuresCount,
    beatResolutions,
    trimStartSec: cleanTrimStart,
    trimEndSec: cleanTrimEnd,
    pcm: cleanPCM,
    sampleRate,
    hasAnacrusis,
    t1OffsetSec: cleanT1OffsetSec,
    pitchOffsetSemitones: pitchShiftSemitones,
    timeAnchors,
  });

  const rawSteps = hasAnacrusis ? [...q.anacrusisSteps, ...q.gridSteps] : q.gridSteps;
  const allSteps = assignedLyricsText ? applyLyricsSyllablesToSteps(rawSteps, assignedLyricsText) : rawSteps;
  const anacCount = hasAnacrusis ? q.anacrusisSteps.length : 0;
  const anacrusisSteps = hasAnacrusis ? allSteps.slice(0, anacCount) : [];
  const mainSteps = (hasAnacrusis ? allSteps.slice(anacCount) : allSteps).map((s, idx) => ({ ...s, stepIndex: idx }));

  const alignment = computeAlignmentMeta(cleanT1OffsetSec, cleanTrimStart, cleanTrimEnd, bpm, hasAnacrusis);
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
        startSec: cleanTrimStart,
        endSec: cleanTrimEnd,
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
