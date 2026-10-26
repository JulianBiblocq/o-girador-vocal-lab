/**
 * continuousTakeSlicer.ts
 * Découpage automatique d'une prise continue par pattern avec compensation de latence et marges (< 135 lignes).
 */
import type { ToadaProject, VocalPatternItem, VocalRole } from '../types/toadaProject.types';
import { getBeatsPerMeasure } from './musicalMath';
import { extractPatternMelodicData } from '../audio/melodicExtractionHelper';

export interface SlicedTakeResult {
  updatedPatterns: VocalPatternItem[];
  processedCount: number;
}

export function sliceContinuousTake(
  project: ToadaProject,
  targetRole: VocalRole,
  fullPCM: Float32Array,
  sampleRate: number,
  marginBeforeM0Sec = 0.6
): SlicedTakeResult {
  const bpm = project.bpm || 55;
  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const beatDuration = 60 / bpm;
  const measureDuration = beatsPerMeasure * beatDuration;

  let currentMeasure = 1;
  const patternSlots: Array<{ patId: string; measure: number }> = [];

  project.slots.forEach((slot) => {
    const pux = project.patterns.find((p) => p.id === slot.puxadorPatternId);
    const coro = project.patterns.find((p) => p.id === slot.coroPatternId);
    const measuresInSlot = Math.max(pux?.measuresCount ?? 2, coro?.measuresCount ?? 2, 2);

    const patId = targetRole === 'puxador' ? slot.puxadorPatternId : slot.coroPatternId;
    if (patId && !patternSlots.some((ps) => ps.patId === patId)) {
      patternSlots.push({ patId, measure: currentMeasure });
    }
    currentMeasure += (slot.advanceMeasures ?? measuresInSlot);
  });

  const updatedPatterns = project.patterns.map((pat) => {
    const targetSlot = patternSlots.find((ps) => ps.patId === pat.id);
    if (!targetSlot || pat.role !== targetRole) return pat;

    const hasAnac = pat.hasAnacrusis !== false;
    const anacSec = hasAnac ? measureDuration : 0;
    const slotT1InPCM = marginBeforeM0Sec + targetSlot.measure * measureDuration;
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

    const melodic = extractPatternMelodicData({
      rawPCM: slicedPCM,
      sampleRate,
      bpm: pat.baseBpm ?? bpm,
      timeSignature: project.timeSignature,
      measuresCount: pat.measuresCount,
      beatsPerMeasure,
      beatResolutions: pat.pack?.metadata.beatResolutions || [4, 4, 4, 4],
      hasAnacrusis: hasAnac,
      trimStartSec,
      trimEndSec,
      referencePitch: pat.referencePitch || 'C4',
      assignedLyricsText: pat.assignedLyricsText,
      timeAnchors: pat.timeAnchors,
    });

    const activeVarKey = pat.activeVariantKey || 'spd100_pit0';
    const existingVar = pat.variants?.[activeVarKey];
    const updatedVariant = {
      ...(existingVar || {}),
      recordingResult: { pcm: slicedPCM, sampleRate },
      trimStartSec,
      trimEndSec,
    };

    return {
      ...pat,
      recordingResult: { pcm: slicedPCM, sampleRate },
      rawAudioSamples: slicedPCM,
      trimStartSec,
      trimEndSec,
      anacrusisSteps: melodic.anacrusisSteps,
      mainSteps: melodic.mainSteps,
      pitchCurve: melodic.pitchCurve,
      pack: melodic.pack,
      midiLocked: true,
      isMidiInitialized: true,
      variants: {
        ...(pat.variants || {}),
        [activeVarKey]: updatedVariant as any,
      },
    };
  });

  return {
    updatedPatterns,
    processedCount: patternSlots.length,
  };
}
