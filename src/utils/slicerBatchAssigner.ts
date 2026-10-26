/**
 * slicerBatchAssigner.ts
 * Découpe précise, calage Anacrouse+Mesures+1T et assignation aux blocs Toada (< 135 lignes).
 */
import type { ToadaProject, VocalPatternItem, VocalRole } from '../types/toadaProject.types';
import type { SliceSegment } from '../types/slicerSegments.types';
import { getBeatsPerMeasure } from './musicalMath';
import { getDefaultBeatResolutions } from './alignmentMath';
import { extractPatternMelodicData } from '../audio/melodicExtractionHelper';

export interface BatchAssignOptions {
  project: ToadaProject;
  masterPCM: Float32Array;
  sampleRate: number;
  segments: SliceSegment[];
  addPattern: (role: VocalRole, name?: string) => string;
  updatePattern: (id: string, partial: Partial<VocalPatternItem>) => void;
  updateVariant: (patternId: string, variantKey: string, partial: any) => void;
  onProgress?: (current: number, total: number, name: string) => void;
}

export function executeBatchAssign(options: BatchAssignOptions): { processedCount: number; firstAssignedId: string | null } {
  const { project, masterPCM, sampleRate, segments, addPattern, updatePattern, updateVariant, onProgress } = options;
  const activeSegments = segments.filter((s) => s.targetPatternId !== 'ignore');
  if (activeSegments.length === 0) return { processedCount: 0, firstAssignedId: null };

  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const defaultResolutions = getDefaultBeatResolutions(project.timeSignature);
  const masterDurationSec = masterPCM.length / sampleRate;
  let firstAssignedId: string | null = null;
  let processedCount = 0;

  activeSegments.forEach((segment, idx) => {
    let targetPattern: VocalPatternItem | undefined;
    let targetId = segment.targetPatternId;
    const measuresCount = segment.measuresCount ?? 2;
    const hasAnacrusis = segment.hasAnacrusis !== false;

    if (targetId === 'new') {
      const role: VocalRole = segment.role ?? 'puxador';
      const name = segment.name?.trim() || `Bloc ${project.patterns.length + idx + 1}`;
      targetId = addPattern(role, name);
      targetPattern = {
        id: targetId, name, role, measuresCount, baseBpm: project.bpm, hasAnacrusis,
        variants: {}, activeVariantKey: 'spd100_pit0', recordingResult: null,
        trimStartSec: 0, trimEndSec: 0, lowCutEnabled: true, anacrusisSteps: [], mainSteps: [], pitchCurve: [],
      } as unknown as VocalPatternItem;
    } else {
      targetPattern = project.patterns.find((p) => p.id === targetId);
    }

    if (!targetPattern) return;
    if (!firstAssignedId) firstAssignedId = targetId;

    onProgress?.(idx + 1, activeSegments.length, targetPattern.name);

    const bpm = targetPattern.bpm ?? targetPattern.baseBpm ?? project.bpm ?? 88;
    const beatDuration = 60 / bpm;
    const measureDuration = beatsPerMeasure * beatDuration;
    const anacBeats = segment.anacrusisBeats ?? (hasAnacrusis ? 2 : 0);
    const metricT1Sec = segment.metricT1Sec ?? (hasAnacrusis ? segment.startSec + anacBeats * beatDuration : segment.startSec);

    // 1. Fenêtrage large centré sur la grille métrique et les bornes de coupe
    const rawStartSec = Math.max(0, Math.min(metricT1Sec - 1.5, segment.startSec - 0.3));
    const rawEndSec = Math.min(masterDurationSec, Math.max(metricT1Sec + measuresCount * measureDuration + 1.0, segment.endSec + 0.3));
    const sStart = Math.floor(rawStartSec * sampleRate);
    const sEnd = Math.floor(rawEndSec * sampleRate);
    if (sEnd <= sStart) return;

    const slicedPCM = masterPCM.slice(sStart, sEnd);
    const bufferStartSec = sStart / sampleRate;
    const t1OffsetSec = Math.max(0, metricT1Sec - bufferStartSec);
    const trimStartSec = Math.max(0, segment.startSec - bufferStartSec);
    const trimEndSec = Math.min(slicedPCM.length / sampleRate, Math.max(trimStartSec + 0.1, segment.endSec - bufferStartSec));
    const beatResolutions = targetPattern.pack?.metadata.beatResolutions || defaultResolutions;

    // 2. Extraction mélodique & pas MIDI selon les mesures choisies
    const res = extractPatternMelodicData({
      rawPCM: slicedPCM, sampleRate, bpm, timeSignature: project.timeSignature,
      measuresCount, beatsPerMeasure, beatResolutions, hasAnacrusis,
      trimStartSec, trimEndSec, referencePitch: targetPattern.referencePitch ?? 'C4',
      pitchShiftSemitones: 0, tessitura: targetPattern.tessitura, assignedLyricsText: targetPattern.assignedLyricsText,
      lowCutEnabled: targetPattern.lowCutEnabled !== false, enableTonePolish: targetPattern.enableTonePolish !== false,
      t1OffsetSec,
    });

    // 3. Mise à jour de la déclinaison active et du pattern avec ancre absolue t1OffsetSec
    const activeVarKey = targetPattern.activeVariantKey || 'spd100_pit0';
    updateVariant(targetId, activeVarKey, {
      recordingResult: { pcm: slicedPCM, sampleRate, t1OffsetSec },
      trimStartSec, trimEndSec, t1OffsetSec,
    });

    updatePattern(targetId, {
      baseBpm: bpm, bpm: bpm, measuresCount, hasAnacrusis, anacrusisBeats: segment.anacrusisBeats, pack: res.pack, rawAudioSamples: res.cleanPCM,
      recordingResult: { pcm: slicedPCM, sampleRate, t1OffsetSec }, trimStartSec, trimEndSec, t1OffsetSec,
      rawPitchCurve: res.pitchCurve, pitchCurve: res.pitchCurve,
      anacrusisSteps: res.anacrusisSteps, mainSteps: res.mainSteps,
      isMidiInitialized: true, midiLocked: true,
    });

    processedCount++;
  });

  return { processedCount, firstAssignedId };
}
