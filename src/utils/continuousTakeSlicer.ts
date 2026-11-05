/**
 * continuousTakeSlicer.ts
 * Découpage automatique d'une prise continue par pattern avec sélection RMS et ancrage T1 (< 135 lignes).
 */
import type { ToadaProject, VocalPatternItem, VocalRole } from '../types/toadaProject.types';
import { getBeatsPerMeasure } from './musicalMath';
import { NO_ANACRUSIS_PRE_MARGIN_SEC } from './anacrusisTimingHelper';
import { extractPatternMelodicData } from '../audio/melodicExtractionHelper';
import { computeSlotsMeasureLayout } from '../components/conductor/toadaTimingScheduler';
import { CONTINUOUS_LEAD_IN_MEASURES } from '../audio/continuousCueHelper';

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
  const layouts = computeSlotsMeasureLayout(project.slots, project.patterns);

  const occurrencesByPatId = new Map<string, number[]>();
  layouts.forEach((layout) => {
    const slot = project.slots[layout.slotIndex];
    const patId = targetRole === 'puxador' ? slot.puxadorPatternId : slot.coroPatternId;
    if (!patId) return;
    const slotMeasureFromM0 = (CONTINUOUS_LEAD_IN_MEASURES - 1) + layout.startMeasure;
    const list = occurrencesByPatId.get(patId) || [];
    list.push(slotMeasureFromM0);
    occurrencesByPatId.set(patId, list);
  });

  let processedCount = 0;

  const updatedPatterns = project.patterns.map((pat) => {
    const measureList = occurrencesByPatId.get(pat.id);
    if (!measureList || measureList.length === 0 || pat.role !== targetRole) return pat;

    const hasAnac = pat.hasAnacrusis !== false;
    const anacSec = hasAnac ? measureDuration : NO_ANACRUSIS_PRE_MARGIN_SEC;

    let bestMeasureFromM0 = measureList[0];
    if (measureList.length > 1) {
      let bestRms = -1;
      for (const mFromM0 of measureList) {
        const t1Sec = preM0MarginSec + mFromM0 * measureDuration;
        const rms = computeWindowRms(fullPCM, sampleRate, t1Sec - anacSec, t1Sec + pat.measuresCount * measureDuration);
        if (rms > bestRms) { bestRms = rms; bestMeasureFromM0 = mFromM0; }
      }
    }

    const slotT1InPCM = preM0MarginSec + bestMeasureFromM0 * measureDuration;
    const patStartInPCM = slotT1InPCM - anacSec;
    const patEndInPCM = slotT1InPCM + pat.measuresCount * measureDuration + beatDuration;

    const sliceStartSec = Math.max(0, patStartInPCM - 0.5);
    const sliceEndSec = Math.min(fullPCM.length / sampleRate, patEndInPCM + 0.5);

    const sStart = Math.floor(sliceStartSec * sampleRate);
    const sEnd = Math.floor(sliceEndSec * sampleRate);
    if (sEnd <= sStart) return pat;

    const slicedPCM = fullPCM.slice(sStart, sEnd);
    const trimStartSec = patStartInPCM - sliceStartSec;
    const trimEndSec = patEndInPCM - sliceStartSec;
    const t1OffsetSec = slotT1InPCM - sliceStartSec;

    const melodic = extractPatternMelodicData({
      rawPCM: slicedPCM,
      sampleRate,
      bpm,
      timeSignature: project.timeSignature,
      measuresCount: pat.measuresCount,
      beatsPerMeasure,
      beatResolutions: pat.pack?.metadata.beatResolutions || [4, 4, 4, 4],
      hasAnacrusis: hasAnac,
      trimStartSec,
      trimEndSec,
      t1OffsetSec,
      referencePitch: pat.referencePitch || 'C4',
      assignedLyricsText: pat.assignedLyricsText,
      timeAnchors: pat.timeAnchors,
    });

    const recResult = { pcm: slicedPCM, sampleRate, recordedBpm: bpm, t1OffsetSec };
    const activeVarKey = pat.activeVariantKey || 'spd100_pit0';
    const existingVar = pat.variants?.[activeVarKey];
    const updatedVariant = {
      ...(existingVar || {}),
      recordingResult: recResult,
      t1OffsetSec,
      trimStartSec,
      trimEndSec,
      anacrusisSteps: melodic.anacrusisSteps,
      mainSteps: melodic.mainSteps,
      pitchCurve: melodic.pitchCurve,
    };

    processedCount++;
    return {
      ...pat,
      bpm,
      baseBpm: pat.baseBpm ?? bpm,
      recordingResult: recResult,
      rawAudioSamples: melodic.cleanPCM,
      rawPitchCurve: melodic.pitchCurve,
      t1OffsetSec,
      trimStartSec,
      trimEndSec,
      anacrusisSteps: melodic.anacrusisSteps,
      mainSteps: melodic.mainSteps,
      pitchCurve: melodic.pitchCurve,
      pack: melodic.pack,
      midiLocked: true,
      isMidiInitialized: true,
      hasCanonicalAlignment: true as any,
      correctedAudioSamples: null,
      melodyneRegions: [],
      variants: { ...(pat.variants || {}), [activeVarKey]: updatedVariant as any },
    };
  });

  return { updatedPatterns, processedCount };
}
