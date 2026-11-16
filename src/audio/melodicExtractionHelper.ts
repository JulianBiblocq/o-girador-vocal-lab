/**
 * melodicExtractionHelper.ts
 * Pipeline unifié d'extraction de pitch Viterbi, masquage sibilantes, alignement forcé et quantification MIDI (< 125 lignes).
 */
import type { VocalPackExport, PitchCurvePoint, VocalStepData, TimeSignatureString } from '../types/vocalPack.types';
import type { TessituraRange } from '../types/tessitura.types';
import type { TimeAnchor } from '../types/toadaDocument.types';
import type { EffectiveVocalBounds } from '../utils/ambitusStorage';
import { createPaddedPreviewBuffer, audioBufferToWavBase64 } from '../utils/wavEncoder';
import { extractContinuousPitchCurve } from './pitchExtractor';
import { quantizePitchToSteps } from './pitchToStepsQuantizer';
import { recalibrateBricksToLocalPitchCurve } from './pitchStepSegmentation';
import { applyLyricsSyllablesToSteps } from '../utils/syllableAligner';
import { resolveFreshTimeAnchors } from '../utils/timeAnchorParser';
import { getPatternT1OffsetSec, getPatternTotalDurationSec } from '../utils/anacrusisTimingHelper';
import { computeAlignmentMeta } from '../utils/alignmentMath';
import { maskSibilantsInPitchCurve, annotateBricksConsonantAndEnvelope } from './sibilantBreathMasker';
import { alignStepsWithReferenceMidiNotes } from './forcedMelodyAligner';

export interface ExtractMelodicParams {
  rawPCM: Float32Array; sampleRate: number; bpm: number; timeSignature: TimeSignatureString;
  measuresCount: number; beatsPerMeasure: number; beatResolutions: number[]; hasAnacrusis: boolean;
  trimStartSec?: number; trimEndSec?: number; referencePitch: string; pitchShiftSemitones?: number;
  tessitura?: TessituraRange; vocalBounds?: Partial<EffectiveVocalBounds>; assignedLyricsText?: string; timeAnchors?: TimeAnchor[];
  lowCutEnabled?: boolean; enableTonePolish?: boolean; t1OffsetSec?: number; referenceMidiNotes?: number[] | null; createdAt?: string;
}

export interface ExtractMelodicResult {
  pack: VocalPackExport; cleanPCM: Float32Array; pitchCurve: PitchCurvePoint[];
  anacrusisSteps: VocalStepData[]; mainSteps: VocalStepData[]; allSteps: VocalStepData[]; totalDurationSec: number;
}

export function rebuildCanonicalCleanAudio(params: {
  rawPCM: Float32Array; sampleRate: number; bpm: number; measuresCount: number;
  beatsPerMeasure: number; hasAnacrusis: boolean; trimStartSec?: number; trimEndSec?: number;
  t1OffsetSec?: number; lowCutEnabled?: boolean; enableTonePolish?: boolean;
}): Float32Array {
  const beatDuration = 60 / Math.max(30, params.bpm), measureDuration = params.beatsPerMeasure * beatDuration;
  const cleanT1OffsetSec = params.hasAnacrusis ? measureDuration : 0.15;
  const rawT1OffsetSec = getPatternT1OffsetSec(params.hasAnacrusis, measureDuration, params.t1OffsetSec);
  const totalDurationSec = getPatternTotalDurationSec(params.hasAnacrusis, params.measuresCount, measureDuration, 0.25, beatDuration, cleanT1OffsetSec);
  const rawTrimStart = Math.max(0, params.trimStartSec ?? 0);
  const rawTrimEnd = params.trimEndSec && params.trimEndSec > 0 ? params.trimEndSec : (params.rawPCM.length / params.sampleRate);
  return createPaddedPreviewBuffer(
    params.rawPCM, params.sampleRate, totalDurationSec, rawTrimStart, rawTrimEnd, 0,
    params.lowCutEnabled ?? true, true, params.enableTonePolish ?? true, rawT1OffsetSec, cleanT1OffsetSec
  );
}

export function extractPatternMelodicData(params: ExtractMelodicParams): ExtractMelodicResult {
  const {
    rawPCM, sampleRate, bpm, timeSignature, measuresCount, beatsPerMeasure,
    beatResolutions, hasAnacrusis, referencePitch, pitchShiftSemitones = 0,
    tessitura, assignedLyricsText, timeAnchors, lowCutEnabled = true, enableTonePolish = true, referenceMidiNotes,
  } = params;

  const beatDuration = 60 / bpm, measureDuration = beatsPerMeasure * beatDuration;
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

  const rawCurve = extractContinuousPitchCurve(cleanPCM, { sampleRate, totalDurationSec, trimStartSec: cleanTrimStart, trimEndSec: cleanTrimEnd, tessitura, vocalBounds: params.vocalBounds });
  const pitchCurve = maskSibilantsInPitchCurve(rawCurve, cleanPCM, sampleRate);
  const effectiveAnchors = resolveFreshTimeAnchors(undefined, timeAnchors, beatsPerMeasure, !hasAnacrusis, assignedLyricsText);

  const q = quantizePitchToSteps({
    pitchCurve, bpm, beatsPerMeasure, measuresCount, beatResolutions,
    trimStartSec: cleanTrimStart, trimEndSec: cleanTrimEnd, pcm: cleanPCM, sampleRate,
    hasAnacrusis, t1OffsetSec: cleanT1OffsetSec, pitchOffsetSemitones: pitchShiftSemitones, timeAnchors: effectiveAnchors,
  });

  const rawSteps = hasAnacrusis ? [...q.anacrusisSteps, ...q.gridSteps] : q.gridSteps;
  const stepsPerBeat = beatResolutions[0] || 4, gridStartSec = hasAnacrusis ? 0 : cleanT1OffsetSec;
  const alignedSteps = (assignedLyricsText || (effectiveAnchors && effectiveAnchors.length > 0))
    ? applyLyricsSyllablesToSteps(rawSteps, assignedLyricsText, effectiveAnchors, beatsPerMeasure, stepsPerBeat)
    : rawSteps;
  const recalibratedSteps = recalibrateBricksToLocalPitchCurve(alignedSteps, pitchCurve, gridStartSec, beatDuration / stepsPerBeat, referencePitch.replace(/\d+$/, '') || 'C', 'chromatic');
  const forcedSteps = referenceMidiNotes?.length
    ? alignStepsWithReferenceMidiNotes({ steps: recalibratedSteps, referenceMidiNotes, pitchCurve, gridStartSec, beatDurationSec: beatDuration, pcm: cleanPCM, sampleRate })
    : recalibratedSteps;
  const allSteps = annotateBricksConsonantAndEnvelope(forcedSteps, cleanPCM, sampleRate, gridStartSec, beatDuration);

  const anacCount = hasAnacrusis ? q.anacrusisSteps.length : 0;
  const anacrusisSteps = hasAnacrusis ? allSteps.slice(0, anacCount) : [];
  const mainSteps = (hasAnacrusis ? allSteps.slice(anacCount) : allSteps).map((s, idx) => ({ ...s, stepIndex: idx }));

  const alignment = computeAlignmentMeta(cleanT1OffsetSec, cleanTrimStart, cleanTrimEnd, bpm, hasAnacrusis);
  const audioBase64 = audioBufferToWavBase64(cleanPCM, sampleRate);
  const pack: VocalPackExport = {
    schemaVersion: '1.0',
    metadata: { bpm, timeSignature, measuresCount, beatResolutions, referencePitch, createdAt: params.createdAt ?? new Date().toISOString() },
    alignment: { startOffsetSec: alignment.startOffsetSec, anacrusis: { ...alignment.anacrusis, steps: anacrusisSteps }, nudgeMs: 0 },
    grid: { steps: mainSteps, totalSteps: mainSteps.length },
    audio: { format: 'wav', sampleRate, channels: 1, durationSec: totalDurationSec, audioBase64, nudgeMs: 0, trim: { startSec: cleanTrimStart, endSec: cleanTrimEnd } },
  };
  return { pack, cleanPCM, pitchCurve, anacrusisSteps, mainSteps, allSteps, totalDurationSec };
}