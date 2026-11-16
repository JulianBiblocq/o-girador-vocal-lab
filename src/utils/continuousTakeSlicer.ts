/**
 * continuousTakeSlicer.ts
 * Découpage automatique d'une prise continue par pattern via conductorRoleTimelineBuilder,
 * avec version synchrone (tests legacy) et version asynchrone Web Worker DSP non-bloquante (< 138 lignes).
 */
import type { ToadaProject, VocalPatternItem, VocalRole } from '../types/toadaProject.types';
import { getBeatsPerMeasure } from './musicalMath';
import { NO_ANACRUSIS_PRE_MARGIN_SEC } from './anacrusisTimingHelper';
import { extractPatternMelodicData, type ExtractMelodicParams, type ExtractMelodicResult } from '../audio/melodicExtractionHelper';
import { extractMelodicDataInWorker } from '../workers/vocalDspWorkerClient';
import { resolveFreshTimeAnchors } from './timeAnchorParser';
import { alignT1ByAnchorCrossCorrelation } from './slicerAlignmentHelper';
import { findOptimalAcousticCutSec, snapToNearestZeroCrossing } from './slicerBoundaryOptimizer';
import { buildConductorRoleTimeline, type RoleTimelineItem } from './conductorRoleTimelineBuilder';

export interface SlicedTakeResult {
  updatedPatterns: VocalPatternItem[];
  processedCount: number;
}

interface PreparedPatternSlice {
  pat: VocalPatternItem;
  slicedPCM: Float32Array;
  sampleRate: number;
  bpm: number;
  trimStartSec: number;
  trimEndSec: number;
  t1OffsetSec: number;
  effectiveAnchors: any;
  extractParams: ExtractMelodicParams;
}

function computeWindowRms(pcm: Float32Array, sampleRate: number, startSec: number, endSec: number): number {
  const i0 = Math.max(0, Math.floor(startSec * sampleRate)), i1 = Math.min(pcm.length, Math.floor(endSec * sampleRate));
  if (i1 <= i0) return 0;
  let sumSq = 0;
  for (let i = i0; i < i1; i++) sumSq += pcm[i] * pcm[i];
  return Math.sqrt(sumSq / (i1 - i0));
}

function prepareContinuousSlices(
  project: ToadaProject, targetRole: VocalRole, fullPCM: Float32Array, sampleRate: number, preM0MarginSec: number
): Map<string, PreparedPatternSlice> {
  const bpm = project.bpm || 88, beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const beatDuration = 60 / bpm, measureDuration = beatsPerMeasure * beatDuration;
  const timeline = buildConductorRoleTimeline(project, targetRole, preM0MarginSec);
  const occurrencesByPatId = new Map<string, RoleTimelineItem[]>();
  for (const item of timeline) {
    if (item.isRoleGap || !item.patternId) continue;
    const list = occurrencesByPatId.get(item.patternId) || []; list.push(item); occurrencesByPatId.set(item.patternId, list);
  }
  const prepared = new Map<string, PreparedPatternSlice>();
  for (const pat of project.patterns) {
    const occList = occurrencesByPatId.get(pat.id);
    if (!occList || occList.length === 0 || pat.role !== targetRole) continue;
    const hasAnac = pat.hasAnacrusis !== false, anacSec = hasAnac ? measureDuration : NO_ANACRUSIS_PRE_MARGIN_SEC;
    const effectiveAnchors = resolveFreshTimeAnchors(pat.rawLineCode, pat.timeAnchors, beatsPerMeasure, !hasAnac, pat.assignedLyricsText);
    let bestOcc = occList[0];
    if (occList.length > 1) {
      let bestRms = -1;
      for (const occ of occList) { const rms = computeWindowRms(fullPCM, sampleRate, occ.windowStartSec, occ.windowEndSec); if (rms > bestRms) { bestRms = rms; bestOcc = occ; } }
    }
    const slotT1InPCM = alignT1ByAnchorCrossCorrelation(fullPCM, sampleRate, bestOcc.metricT1Sec, bpm, effectiveAnchors, hasAnac, beatsPerMeasure, 0.30);
    const patStartInPCM = snapToNearestZeroCrossing(fullPCM, sampleRate, slotT1InPCM - anacSec, 5);
    const bodyEndInPCM = slotT1InPCM + pat.measuresCount * measureDuration;
    const patEndInPCM = findOptimalAcousticCutSec(fullPCM, sampleRate, bodyEndInPCM + beatDuration, bodyEndInPCM + 0.12 * beatDuration, bodyEndInPCM + 1.15 * beatDuration);
    const sliceStartSec = snapToNearestZeroCrossing(fullPCM, sampleRate, Math.max(0, patStartInPCM - 0.5), 5);
    const sliceEndSec = snapToNearestZeroCrossing(fullPCM, sampleRate, Math.min(fullPCM.length / sampleRate, patEndInPCM + 0.5), 5);
    const sStart = Math.floor(sliceStartSec * sampleRate), sEnd = Math.floor(sliceEndSec * sampleRate);
    if (sEnd <= sStart) continue;
    const slicedPCM = fullPCM.slice(sStart, sEnd);
    const trimStartSec = patStartInPCM - sliceStartSec, trimEndSec = patEndInPCM - sliceStartSec, t1OffsetSec = slotT1InPCM - sliceStartSec;
    prepared.set(pat.id, {
      pat, slicedPCM, sampleRate, bpm, trimStartSec, trimEndSec, t1OffsetSec, effectiveAnchors,
      extractParams: {
        rawPCM: slicedPCM, sampleRate, bpm, timeSignature: project.timeSignature, measuresCount: pat.measuresCount, beatsPerMeasure,
        beatResolutions: pat.pack?.metadata.beatResolutions || [4, 4, 4, 4], hasAnacrusis: hasAnac, trimStartSec, trimEndSec, t1OffsetSec,
        referencePitch: pat.referencePitch || 'C4', assignedLyricsText: pat.assignedLyricsText, timeAnchors: effectiveAnchors, referenceMidiNotes: pat.referenceMidiNotes,
      },
    });
  }
  return prepared;
}

function applyMelodicToSlicedPattern(prep: PreparedPatternSlice, melodic: ExtractMelodicResult): VocalPatternItem {
  const { pat, slicedPCM, sampleRate, bpm, trimStartSec, trimEndSec, t1OffsetSec, effectiveAnchors } = prep;
  const recResult = { pcm: slicedPCM, sampleRate, recordedBpm: bpm, t1OffsetSec };
  const activeVarKey = pat.activeVariantKey || 'spd100_pit0';
  const updatedVariant = { ...(pat.variants?.[activeVarKey] || {}), recordingResult: recResult, t1OffsetSec, trimStartSec, trimEndSec, anacrusisSteps: melodic.anacrusisSteps, mainSteps: melodic.mainSteps, pitchCurve: melodic.pitchCurve };
  return {
    ...pat, bpm, baseBpm: pat.baseBpm ?? bpm, recordingResult: recResult, rawAudioSamples: melodic.cleanPCM, rawPitchCurve: melodic.pitchCurve,
    t1OffsetSec, trimStartSec, trimEndSec, anacrusisSteps: melodic.anacrusisSteps, mainSteps: melodic.mainSteps, pitchCurve: melodic.pitchCurve,
    pack: melodic.pack, timeAnchors: effectiveAnchors ?? pat.timeAnchors, midiLocked: true, isMidiInitialized: true, hasCanonicalAlignment: true as any,
    correctedAudioSamples: null, melodyneRegions: [], variants: { ...(pat.variants || {}), [activeVarKey]: updatedVariant as any },
  };
}

export function sliceContinuousTake(project: ToadaProject, targetRole: VocalRole, fullPCM: Float32Array, sampleRate: number, preM0MarginSec = 0): SlicedTakeResult {
  const prepared = prepareContinuousSlices(project, targetRole, fullPCM, sampleRate, preM0MarginSec);
  const updatedPatterns = project.patterns.map((pat) => {
    const prep = prepared.get(pat.id);
    return prep ? applyMelodicToSlicedPattern(prep, extractPatternMelodicData(prep.extractParams)) : pat;
  });
  return { updatedPatterns, processedCount: prepared.size };
}

export async function sliceContinuousTakeAsync(
  project: ToadaProject, targetRole: VocalRole, fullPCM: Float32Array, sampleRate: number, preM0MarginSec = 0
): Promise<SlicedTakeResult> {
  const prepared = prepareContinuousSlices(project, targetRole, fullPCM, sampleRate, preM0MarginSec);
  const melodicByPatId = new Map<string, ExtractMelodicResult>();
  for (const [patId, prep] of prepared.entries()) {
    melodicByPatId.set(patId, await extractMelodicDataInWorker(prep.extractParams));
  }
  const updatedPatterns = project.patterns.map((pat) => {
    const prep = prepared.get(pat.id), mel = melodicByPatId.get(pat.id);
    return prep && mel ? applyMelodicToSlicedPattern(prep, mel) : pat;
  });
  return { updatedPatterns, processedCount: prepared.size };
}
