/**
 * livretResetHelper.ts
 * Réinitialisation complète du Livret 4 depuis le son brut sanctuarisé (< 95 lignes) :
 * Recalcul neuf de la courbe YIN filtrée, purge Melodyne et ré-extraction totale des briques MIDI.
 */
import type { VocalStepData, PitchCurvePoint, VocalPackExport } from '../types/vocalPack.types';
import type { VocalPatternItem } from '../types/toadaProject.types';
import { extractContinuousPitchCurve } from './pitchExtractor';
import { quantizePitchToSteps } from './pitchToStepsQuantizer';
import { applyLyricsSyllablesToSteps } from '../utils/syllableAligner';
import type { ScaleType } from './scaleQuantizer';

export interface ResetLivret1Params {
  rawAudio: Float32Array;
  sampleRate: number;
  totalDurationSec: number;
  activePattern: VocalPatternItem;
  initialPack: VocalPackExport;
  beatsPerMeasure: number;
  measuresCount: number;
  hasAnacrusis: boolean;
  t1OffsetSec: number;
  smoothingLevel: number;
  tonic: string;
  scaleType: ScaleType;
}

export interface ResetLivret1Result {
  freshCurve: PitchCurvePoint[];
  newSteps: VocalStepData[];
  anacrusisSteps: VocalStepData[];
  mainSteps: VocalStepData[];
}

export function resetLivret1MelodicData(params: ResetLivret1Params): ResetLivret1Result {
  const { rawAudio, sampleRate, totalDurationSec, activePattern, initialPack, beatsPerMeasure, measuresCount, hasAnacrusis, smoothingLevel, tonic, scaleType } = params;

  const freshCurve = extractContinuousPitchCurve(rawAudio, {
    sampleRate, totalDurationSec, trimStartSec: 0, trimEndSec: totalDurationSec, tessitura: activePattern.tessitura,
  });

  const cleanT1 = hasAnacrusis ? beatsPerMeasure * (60 / (initialPack.metadata.bpm || 88)) : 0.15;
  const q = quantizePitchToSteps({
    pitchCurve: freshCurve, bpm: initialPack.metadata.bpm, beatsPerMeasure, measuresCount,
    beatResolutions: initialPack.metadata.beatResolutions, trimStartSec: 0, trimEndSec: totalDurationSec,
    hasAnacrusis, t1OffsetSec: cleanT1, smoothingLevel, tonic, scaleType,
    timeAnchors: activePattern.timeAnchors, pcm: rawAudio, sampleRate,
  });

  const rawSteps = hasAnacrusis ? [...q.anacrusisSteps, ...q.gridSteps] : q.gridSteps;
  const stepsPerBeat = initialPack.metadata.beatResolutions?.[0] || 4;
  const newSteps = (activePattern.assignedLyricsText || activePattern.timeAnchors?.length)
    ? applyLyricsSyllablesToSteps(rawSteps, activePattern.assignedLyricsText, activePattern.timeAnchors, beatsPerMeasure, stepsPerBeat)
    : rawSteps;
  const anacLen = hasAnacrusis ? q.anacrusisSteps.length : 0;

  return {
    freshCurve,
    newSteps,
    anacrusisSteps: hasAnacrusis ? newSteps.slice(0, anacLen) : [],
    mainSteps: (hasAnacrusis ? newSteps.slice(anacLen) : newSteps).map((s, idx) => ({ ...s, stepIndex: idx })),
  };
}

export function buildUpdatedVocalPackExport(
  initialPack: VocalPackExport,
  allSteps: VocalStepData[],
  hasAnacrusis: boolean,
  beatsPerMeasure: number,
  displayedCurve: PitchCurvePoint[]
): VocalPackExport {
  const anacrusisCount = hasAnacrusis ? beatsPerMeasure * (initialPack.metadata.beatResolutions[0] || 4) : 0;
  return {
    ...initialPack,
    pitchCurve: displayedCurve,
    alignment: {
      ...initialPack.alignment,
      anacrusis: {
        ...initialPack.alignment.anacrusis,
        hasAnacrusis,
        steps: hasAnacrusis ? allSteps.slice(0, anacrusisCount) : [],
      },
    },
    grid: {
      steps: (hasAnacrusis ? allSteps.slice(anacrusisCount) : allSteps).map((s, idx) => ({ ...s, stepIndex: idx })),
      totalSteps: allSteps.length - anacrusisCount,
    },
  };
}
