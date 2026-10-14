import type { TimeSignatureString, VocalPackExport } from '../types/vocalPack.types';
import type { AlignmentResult } from './alignmentMath';
import { applyTrimWithFades, audioBufferToWavBase64 } from './wavEncoder';

export interface PackGeneratorParams {
  rawPCM: Float32Array;
  sampleRate: number;
  trimStartSec: number;
  trimEndSec: number;
  bpm: number;
  timeSignature: TimeSignatureString;
  measuresCount: number;
  beatsPerMeasure: number;
  beatResolutions: number[];
  referencePitch: string;
  alignment: AlignmentResult;
}

export function generateVocalPack(params: PackGeneratorParams): VocalPackExport {
  const {
    rawPCM, sampleRate, trimStartSec, trimEndSec,
    bpm, timeSignature, measuresCount, beatsPerMeasure,
    beatResolutions, referencePitch, alignment,
  } = params;

  const cleanPCM = applyTrimWithFades(rawPCM, sampleRate, trimStartSec, trimEndSec);
  const audioBase64 = audioBufferToWavBase64(cleanPCM, sampleRate);

  return {
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
      anacrusis: alignment.anacrusis,
      nudgeMs: 0,
    },
    grid: {
      steps: [],
      totalSteps: measuresCount * beatsPerMeasure * 4,
    },
    audio: {
      format: 'wav',
      sampleRate,
      channels: 1,
      durationSec: alignment.cleanDurationSec,
      audioBase64,
      nudgeMs: 0,
      trim: {
        startSec: 0,
        endSec: alignment.cleanDurationSec,
      },
    },
  };
}
