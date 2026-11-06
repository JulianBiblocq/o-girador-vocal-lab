/**
 * livretResetHelper.ts
 * Réinitialisation complète du Livret 4 depuis le son brut sanctuarisé (< 95 lignes) :
 * Recalcul neuf de la courbe YIN filtrée, purge Melodyne et ré-extraction totale des briques MIDI.
 */
import type { VocalStepData, PitchCurvePoint, VocalPackExport } from '../types/vocalPack.types';
import type { VocalPatternItem } from '../types/toadaProject.types';
import { extractContinuousPitchCurve } from './pitchExtractor';
import { quantizePitchToSteps } from './pitchToStepsQuantizer';
import { recalibrateBricksToLocalPitchCurve } from './pitchStepSegmentation';
import { applyLyricsSyllablesToSteps } from '../utils/syllableAligner';
import { resolveFreshTimeAnchors } from '../utils/timeAnchorParser';
import type { ScaleType } from './scaleQuantizer';

export interface ResetLivret1Params {
  rawAudio: Float32Array; sampleRate: number; totalDurationSec: number;
  activePattern: VocalPatternItem; initialPack: VocalPackExport; beatsPerMeasure: number;
  measuresCount: number; hasAnacrusis: boolean; t1OffsetSec: number;
  smoothingLevel: number; tonic: string; scaleType: ScaleType; rawTxtCode?: string;
}

export interface ResetLivret1Result {
  freshCurve: PitchCurvePoint[]; newSteps: VocalStepData[];
  anacrusisSteps: VocalStepData[]; mainSteps: VocalStepData[];
  freshAnchors?: import('../types/toadaDocument.types').TimeAnchor[];
}

export function extractProjectRawLyricsSource(project?: any, pat?: VocalPatternItem): string | undefined {
  if (pat?.rawLineCode && /\[(?:M\d+[•·\.:])?([1-9]|1[0-2])\]/i.test(pat.rawLineCode)) return pat.rawLineCode;
  const sheetLines: string[] = Array.isArray(project?.sheetLines)
    ? project.sheetLines.map((s: any) => s?.rawLineCode).filter(Boolean)
    : [];
  const metaOrig = typeof project?.toadaMeta?.parolesOriginales === 'string' ? project.toadaMeta.parolesOriginales : '';
  const metaRaw = project?.toadaMeta?.rawTxtCode || '';
  return [pat?.rawLineCode, ...sheetLines, metaRaw, metaOrig].filter(Boolean).join('\n') || undefined;
}

export function resetLivret1MelodicData(params: ResetLivret1Params): ResetLivret1Result {
  const { rawAudio, sampleRate, totalDurationSec, activePattern, initialPack, beatsPerMeasure, measuresCount, hasAnacrusis, smoothingLevel, tonic, scaleType, rawTxtCode } = params;

  const freshCurve = extractContinuousPitchCurve(rawAudio, {
    sampleRate, totalDurationSec, trimStartSec: 0, trimEndSec: totalDurationSec, tessitura: activePattern.tessitura,
  });

  const bpm = initialPack.metadata.bpm || 88, beatDur = 60 / bpm;
  const cleanT1 = hasAnacrusis ? beatsPerMeasure * beatDur : 0.15;
  const freshAnchors = resolveFreshTimeAnchors(activePattern.rawLineCode, activePattern.timeAnchors, beatsPerMeasure, !hasAnacrusis, activePattern.assignedLyricsText, rawTxtCode);
  const q = quantizePitchToSteps({
    pitchCurve: freshCurve, bpm, beatsPerMeasure, measuresCount,
    beatResolutions: initialPack.metadata.beatResolutions, trimStartSec: 0, trimEndSec: totalDurationSec,
    hasAnacrusis, t1OffsetSec: cleanT1, smoothingLevel, tonic, scaleType,
    timeAnchors: freshAnchors, pcm: rawAudio, sampleRate,
  });

  const rawSteps = hasAnacrusis ? [...q.anacrusisSteps, ...q.gridSteps] : q.gridSteps;
  const stepsPerBeat = initialPack.metadata.beatResolutions?.[0] || 4;
  const alignedSteps = (activePattern.assignedLyricsText || freshAnchors?.length)
    ? applyLyricsSyllablesToSteps(rawSteps, activePattern.assignedLyricsText, freshAnchors, beatsPerMeasure, stepsPerBeat)
    : rawSteps;
  const newSteps = recalibrateBricksToLocalPitchCurve(alignedSteps, freshCurve, hasAnacrusis ? 0 : cleanT1, beatDur / stepsPerBeat, tonic, scaleType, smoothingLevel);
  const anacLen = hasAnacrusis ? q.anacrusisSteps.length : 0;

  return {
    freshCurve, newSteps, freshAnchors,
    anacrusisSteps: hasAnacrusis ? newSteps.slice(0, anacLen) : [],
    mainSteps: (hasAnacrusis ? newSteps.slice(anacLen) : newSteps).map((s, idx) => ({ ...s, stepIndex: idx })),
  };
}

export function upgradeStalePatternStepsIfNeeded(params: {
  rawDefaultSteps: VocalStepData[]; expectedStepsCount: number; rawPitchCurve: PitchCurvePoint[];
  activePattern: VocalPatternItem; initialPack: VocalPackExport; beatsPerMeasure: number;
  measuresCount: number; hasAnac: boolean; t1OffsetSec: number; resPerBeat: number;
  totalDurationSec: number; tonic: string; scaleType: ScaleType; rawPCM: Float32Array;
  sampleRate: number; rawTxtCode?: string;
}): VocalStepData[] {
  const { rawDefaultSteps, expectedStepsCount, rawPitchCurve, activePattern, initialPack, beatsPerMeasure, measuresCount, hasAnac, t1OffsetSec, resPerBeat, totalDurationSec, tonic, scaleType, rawPCM, sampleRate, rawTxtCode } = params;
  const anacLen = hasAnac ? beatsPerMeasure * resPerBeat : 0;
  let cleanedSteps = rawDefaultSteps;
  if (hasAnac && (activePattern.anacrusisSteps?.length || 0) === anacLen && (activePattern.mainSteps?.length || 0) >= expectedStepsCount - resPerBeat) {
    cleanedSteps = [...(activePattern.anacrusisSteps || []), ...(activePattern.mainSteps || []).slice(anacLen)];
  }
  const normalizedExisting = cleanedSteps.map((s, idx) => ({
    ...s,
    stepIndex: idx,
    isTie: s.active ? s.note === '───' : false,
  }));
  if (activePattern.midiLocked || normalizedExisting.some((s) => s.active && s.note !== '───')) {
    if (!activePattern.midiLocked && rawPitchCurve.length > 0 && normalizedExisting.every((s) => !s.manualPitchMoved)) {
      const stepDur = (60 / (initialPack.metadata.bpm || 88)) / resPerBeat;
      return recalibrateBricksToLocalPitchCurve(normalizedExisting, rawPitchCurve, hasAnac ? 0 : t1OffsetSec, stepDur, tonic, scaleType);
    }
    return normalizedExisting;
  }
  const anchors = resolveFreshTimeAnchors(activePattern.rawLineCode, activePattern.timeAnchors, beatsPerMeasure, !hasAnac, activePattern.assignedLyricsText, rawTxtCode);
  const bpm = initialPack.metadata.bpm || 88, stepDur = (60 / bpm) / resPerBeat;
  if (rawPitchCurve.length > 0) {
    const q = quantizePitchToSteps({ pitchCurve: rawPitchCurve, bpm, beatsPerMeasure, measuresCount, beatResolutions: initialPack.metadata.beatResolutions, trimStartSec: 0, trimEndSec: totalDurationSec, hasAnacrusis: hasAnac, t1OffsetSec, smoothingLevel: 0.15, tonic, scaleType, pcm: rawPCM, sampleRate, timeAnchors: anchors });
    const rawS = hasAnac ? [...q.anacrusisSteps, ...q.gridSteps] : q.gridSteps;
    const aligned = applyLyricsSyllablesToSteps(rawS, activePattern.assignedLyricsText, anchors, beatsPerMeasure, resPerBeat);
    return recalibrateBricksToLocalPitchCurve(aligned, rawPitchCurve, hasAnac ? 0 : t1OffsetSec, stepDur, tonic, scaleType).map((s, idx) => ({ ...s, stepIndex: idx }));
  }
  const baseSteps = (normalizedExisting.length >= expectedStepsCount || normalizedExisting.length === 0)
    ? normalizedExisting
    : [...normalizedExisting, ...Array.from({ length: expectedStepsCount - normalizedExisting.length }, (_, k) => ({ stepIndex: normalizedExisting.length + k, active: false, note: '', midiNumber: 0, velocity: 0, decay: stepDur }))];
  return baseSteps.map((s, idx) => ({ ...s, stepIndex: idx }));
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
