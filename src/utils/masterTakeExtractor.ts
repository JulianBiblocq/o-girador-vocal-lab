/**
 * masterTakeExtractor.ts
 * Extraction d'un pattern vocal canonique depuis le Banc de Decoupe (< 100 lignes).
 */
import type { TimeSignatureString, VocalPackExport, VocalStepData, PitchCurvePoint } from '../types/vocalPack.types';
import type { VocalRole } from '../types/toadaProject.types';
import { piecewiseTimeWarp } from '../audio/piecewiseTimeWarper';
import { applyHighPass90Hz } from '../audio/vocalFilterHelper';
import { applyVocalToneShaping } from '../audio/vocalToneShaper';
import { normalizeActiveRMS } from '../audio/vocalNormalizer';
import { extractContinuousPitchCurve } from '../audio/pitchExtractor';
import { quantizePitchToSteps } from '../audio/pitchToStepsQuantizer';
import { applyLyricsSyllablesToSteps } from './syllableAligner';
import { generateVocalPack } from './packGenerator';
import { computeAlignmentMeta } from './alignmentMath';

export interface MasterExtractParams {
  rawAudio: Float32Array; sampleRate: number;
  trimInSec: number; trimOutSec: number; beatPegs: number[];
  warpPct: number; phraseBpm: number; role: VocalRole; patternName: string;
  measuresCount: 1 | 2 | 3 | 4; hasAnacrusis: boolean;
  beatsPerMeasure: number; beatResolutions: number[]; referencePitch: string;
  lyricsText?: string; phoneticText?: string;
}

export interface ExtractedPatternResult {
  cleanPCM: Float32Array; totalDurationSec: number; anacrusisDurationSec: number;
  pitchCurve: PitchCurvePoint[]; anacrusisSteps: VocalStepData[]; mainSteps: VocalStepData[];
  pack: VocalPackExport; role: VocalRole; name: string; measuresCount: 1 | 2 | 3 | 4;
  hasAnacrusis: boolean; phraseBpm: number;
  assignedLyricsText?: string; assignedPhoneticText?: string;
}

export function extractPatternFromMaster(params: MasterExtractParams): ExtractedPatternResult {
  const {
    rawAudio, sampleRate, trimInSec, trimOutSec, beatPegs, warpPct, phraseBpm,
    role, patternName, measuresCount, hasAnacrusis, beatsPerMeasure, beatResolutions, referencePitch,
    lyricsText, phoneticText
  } = params;

  const warpedSlice = piecewiseTimeWarp(rawAudio, sampleRate, trimInSec, trimOutSec, beatPegs, warpPct, phraseBpm);
  const beatDur = 60 / phraseBpm;
  const anacrusisDurationSec = hasAnacrusis ? beatsPerMeasure * beatDur : 0.25;
  const totalDurationSec = hasAnacrusis ? (1 + measuresCount) * beatsPerMeasure * beatDur : (measuresCount * beatsPerMeasure * beatDur + 0.25);
  const totalSamples = Math.round(totalDurationSec * sampleRate);

  const t1RelSec = beatPegs.length > 0 ? Math.max(0, beatPegs[0] - trimInSec) : 0;
  const insertStartSec = Math.max(0, anacrusisDurationSec - t1RelSec);
  const insertStartSample = Math.round(insertStartSec * sampleRate);

  const cleanPCM = new Float32Array(totalSamples);
  const copyLen = Math.min(warpedSlice.length, totalSamples - insertStartSample);
  if (copyLen > 0) {
    cleanPCM.set(warpedSlice.subarray(0, copyLen), insertStartSample);
    const rampIn = Math.min(copyLen, Math.round(0.010 * sampleRate));
    for (let i = 0; i < rampIn; i++) cleanPCM[insertStartSample + i] *= 0.5 * (1 - Math.cos((Math.PI * i) / rampIn));
    const rampOut = Math.min(copyLen, Math.round(0.030 * sampleRate));
    for (let i = 0; i < rampOut; i++) cleanPCM[insertStartSample + copyLen - 1 - i] *= 0.5 * (1 - Math.cos((Math.PI * i) / rampOut));
  }

  const filtered = applyHighPass90Hz(cleanPCM, sampleRate);
  const polished = applyVocalToneShaping(filtered, sampleRate);
  const normalized = normalizeActiveRMS(polished, sampleRate);
  cleanPCM.set(normalized);

  const alignment = computeAlignmentMeta(anacrusisDurationSec, 0, totalDurationSec, phraseBpm, hasAnacrusis);
  const timeSignature: TimeSignatureString = beatsPerMeasure === 3 ? '3/4' : '4/4';
  const pack = generateVocalPack({
    rawPCM: cleanPCM, sampleRate, trimStartSec: 0, trimEndSec: totalDurationSec,
    latencyOffsetMs: 0, bpm: Math.round(phraseBpm), timeSignature, measuresCount,
    beatsPerMeasure, beatResolutions, referencePitch, alignment, highPassFilterEnabled: false, normalizeRMS: false, enableTonePolish: false,
  });

  const pitchCurve = extractContinuousPitchCurve(cleanPCM, { sampleRate, totalDurationSec, trimStartSec: 0, trimEndSec: totalDurationSec });
  const q = quantizePitchToSteps({
    pitchCurve, bpm: phraseBpm, beatsPerMeasure, measuresCount, beatResolutions,
    trimStartSec: 0, trimEndSec: totalDurationSec, pcm: cleanPCM, sampleRate,
    hasAnacrusis, t1OffsetSec: anacrusisDurationSec,
  });
  const rawSteps = hasAnacrusis ? [...q.anacrusisSteps, ...q.gridSteps] : q.gridSteps;
  const steps = lyricsText ? applyLyricsSyllablesToSteps(rawSteps, lyricsText) : rawSteps;
  const anacLen = hasAnacrusis ? q.anacrusisSteps.length : 0;

  return {
    cleanPCM, totalDurationSec, anacrusisDurationSec, pitchCurve,
    anacrusisSteps: hasAnacrusis ? steps.slice(0, anacLen) : [],
    mainSteps: steps.slice(anacLen),
    pack, role, name: patternName, measuresCount, hasAnacrusis, phraseBpm,
    assignedLyricsText: lyricsText, assignedPhoneticText: phoneticText,
  };
}
