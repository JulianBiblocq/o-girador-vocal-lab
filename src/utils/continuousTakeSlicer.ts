/**
 * continuousTakeSlicer.ts
 * Découpage automatique d'une prise continue par pattern via conductorRoleTimelineBuilder,
 * en ignorant 100 % des trous de l'autre rôle (< 130 lignes).
 */
import type { ToadaProject, VocalPatternItem, VocalRole } from '../types/toadaProject.types';
import { getBeatsPerMeasure } from './musicalMath';
import { NO_ANACRUSIS_PRE_MARGIN_SEC } from './anacrusisTimingHelper';
import { extractPatternMelodicData } from '../audio/melodicExtractionHelper';
import { resolveFreshTimeAnchors } from './timeAnchorParser';
import { alignT1ByAnchorCrossCorrelation } from './slicerAlignmentHelper';
import { findOptimalAcousticCutSec, snapToNearestZeroCrossing } from './slicerBoundaryOptimizer';
import { buildConductorRoleTimeline, type RoleTimelineItem } from './conductorRoleTimelineBuilder';

export interface SlicedTakeResult {
  updatedPatterns: VocalPatternItem[];
  processedCount: number;
}

function computeWindowRms(pcm: Float32Array, sampleRate: number, startSec: number, endSec: number): number {
  const i0 = Math.max(0, Math.floor(startSec * sampleRate));
  const i1 = Math.min(pcm.length, Math.floor(endSec * sampleRate));
  if (i1 <= i0) return 0;
  let sumSq = 0;
  for (let i = i0; i < i1; i++) sumSq += pcm[i] * pcm[i];
  return Math.sqrt(sumSq / (i1 - i0));
}

export function sliceContinuousTake(
  project: ToadaProject,
  targetRole: VocalRole,
  fullPCM: Float32Array,
  sampleRate: number,
  preM0MarginSec = 0
): SlicedTakeResult {
  const bpm = project.bpm || 88;
  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const beatDuration = 60 / bpm;
  const measureDuration = beatsPerMeasure * beatDuration;

  const timeline = buildConductorRoleTimeline(project, targetRole, preM0MarginSec);
  const occurrencesByPatId = new Map<string, RoleTimelineItem[]>();
  for (const item of timeline) {
    if (item.isRoleGap || !item.patternId) continue;
    const list = occurrencesByPatId.get(item.patternId) || [];
    list.push(item);
    occurrencesByPatId.set(item.patternId, list);
  }

  let processedCount = 0;

  const updatedPatterns = project.patterns.map((pat) => {
    const occList = occurrencesByPatId.get(pat.id);
    if (!occList || occList.length === 0 || pat.role !== targetRole) return pat;

    const hasAnac = pat.hasAnacrusis !== false;
    const anacSec = hasAnac ? measureDuration : NO_ANACRUSIS_PRE_MARGIN_SEC;
    const effectiveAnchors = resolveFreshTimeAnchors(pat.rawLineCode, pat.timeAnchors, beatsPerMeasure, !hasAnac, pat.assignedLyricsText);

    let bestOcc = occList[0];
    if (occList.length > 1) {
      let bestRms = -1;
      for (const occ of occList) {
        const rms = computeWindowRms(fullPCM, sampleRate, occ.windowStartSec, occ.windowEndSec);
        if (rms > bestRms) { bestRms = rms; bestOcc = occ; }
      }
    }

    const nominalSlotT1 = bestOcc.metricT1Sec;
    const slotT1InPCM = alignT1ByAnchorCrossCorrelation(
      fullPCM, sampleRate, nominalSlotT1, bpm, effectiveAnchors, hasAnac, beatsPerMeasure, 0.30
    );
    const patStartInPCM = snapToNearestZeroCrossing(fullPCM, sampleRate, slotT1InPCM - anacSec, 5);
    const bodyEndInPCM = slotT1InPCM + pat.measuresCount * measureDuration;
    const patEndInPCM = findOptimalAcousticCutSec(
      fullPCM, sampleRate, bodyEndInPCM + beatDuration, bodyEndInPCM + 0.12 * beatDuration, bodyEndInPCM + 1.15 * beatDuration
    );

    const sliceStartSec = snapToNearestZeroCrossing(fullPCM, sampleRate, Math.max(0, patStartInPCM - 0.5), 5);
    const sliceEndSec = snapToNearestZeroCrossing(fullPCM, sampleRate, Math.min(fullPCM.length / sampleRate, patEndInPCM + 0.5), 5);

    const sStart = Math.floor(sliceStartSec * sampleRate);
    const sEnd = Math.floor(sliceEndSec * sampleRate);
    if (sEnd <= sStart) return pat;

    const slicedPCM = fullPCM.slice(sStart, sEnd);
    const trimStartSec = patStartInPCM - sliceStartSec;
    const trimEndSec = patEndInPCM - sliceStartSec;
    const t1OffsetSec = slotT1InPCM - sliceStartSec;

    const melodic = extractPatternMelodicData({
      rawPCM: slicedPCM, sampleRate, bpm, timeSignature: project.timeSignature,
      measuresCount: pat.measuresCount, beatsPerMeasure,
      beatResolutions: pat.pack?.metadata.beatResolutions || [4, 4, 4, 4],
      hasAnacrusis: hasAnac, trimStartSec, trimEndSec, t1OffsetSec,
      referencePitch: pat.referencePitch || 'C4', assignedLyricsText: pat.assignedLyricsText, timeAnchors: effectiveAnchors,
    });

    const recResult = { pcm: slicedPCM, sampleRate, recordedBpm: bpm, t1OffsetSec };
    const activeVarKey = pat.activeVariantKey || 'spd100_pit0';
    const existingVar = pat.variants?.[activeVarKey];
    const updatedVariant = {
      ...(existingVar || {}), recordingResult: recResult, t1OffsetSec, trimStartSec, trimEndSec,
      anacrusisSteps: melodic.anacrusisSteps, mainSteps: melodic.mainSteps, pitchCurve: melodic.pitchCurve,
    };

    processedCount++;
    return {
      ...pat, bpm, baseBpm: pat.baseBpm ?? bpm, recordingResult: recResult,
      rawAudioSamples: melodic.cleanPCM, rawPitchCurve: melodic.pitchCurve,
      t1OffsetSec, trimStartSec, trimEndSec,
      anacrusisSteps: melodic.anacrusisSteps, mainSteps: melodic.mainSteps, pitchCurve: melodic.pitchCurve,
      pack: melodic.pack, timeAnchors: effectiveAnchors ?? pat.timeAnchors,
      midiLocked: true, isMidiInitialized: true, hasCanonicalAlignment: true as any,
      correctedAudioSamples: null, melodyneRegions: [],
      variants: { ...(pat.variants || {}), [activeVarKey]: updatedVariant as any },
    };
  });

  return { updatedPatterns, processedCount };
}
