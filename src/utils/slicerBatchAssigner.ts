/**
 * slicerBatchAssigner.ts
 * Découpe précise et assignation par lot des tranches audio aux blocs de la Toada (< 135 lignes).
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
  const marginSec = 0.35;
  let firstAssignedId: string | null = null;
  let processedCount = 0;

  activeSegments.forEach((segment, idx) => {
    let targetPattern: VocalPatternItem | undefined;
    let targetId = segment.targetPatternId;

    if (targetId === 'new') {
      const role: VocalRole = segment.role ?? 'puxador';
      const name = segment.name?.trim() || `Bloc ${project.patterns.length + idx + 1}`;
      targetId = addPattern(role, name);
      targetPattern = {
        id: targetId,
        name,
        role,
        measuresCount: 2,
        baseBpm: project.bpm,
        variants: {},
        activeVariantKey: 'spd100_pit0',
        recordingResult: null,
        trimStartSec: 0,
        trimEndSec: 0,
        lowCutEnabled: true,
        anacrusisSteps: [],
        mainSteps: [],
        pitchCurve: [],
      } as unknown as VocalPatternItem;
    } else {
      targetPattern = project.patterns.find((p) => p.id === targetId);
    }

    if (!targetPattern) return;
    if (!firstAssignedId) firstAssignedId = targetId;

    onProgress?.(idx + 1, activeSegments.length, targetPattern.name);

    // 1. Découpage avec marge de sécurité
    const rawStartSec = Math.max(0, segment.startSec - marginSec);
    const rawEndSec = Math.min(masterDurationSec, segment.endSec + marginSec);
    const sStart = Math.floor(rawStartSec * sampleRate);
    const sEnd = Math.floor(rawEndSec * sampleRate);
    if (sEnd <= sStart) return;

    const slicedPCM = masterPCM.slice(sStart, sEnd);
    const trimStartSec = segment.startSec - rawStartSec;
    const trimEndSec = segment.endSec - rawStartSec;

    const bpm = targetPattern.baseBpm ?? project.bpm ?? 55;
    const measuresCount = targetPattern.measuresCount ?? 2;
    const hasAnacrusis = targetPattern.hasAnacrusis !== false;
    const beatResolutions = targetPattern.pack?.metadata.beatResolutions || defaultResolutions;

    // 2. Extraction mélodique & pas MIDI
    const res = extractPatternMelodicData({
      rawPCM: slicedPCM,
      sampleRate,
      bpm,
      timeSignature: project.timeSignature,
      measuresCount,
      beatsPerMeasure,
      beatResolutions,
      hasAnacrusis,
      trimStartSec,
      trimEndSec,
      referencePitch: targetPattern.referencePitch ?? 'C4',
      pitchShiftSemitones: 0,
      tessitura: targetPattern.tessitura,
      assignedLyricsText: targetPattern.assignedLyricsText,
      lowCutEnabled: targetPattern.lowCutEnabled !== false,
      enableTonePolish: targetPattern.enableTonePolish !== false,
    });

    // 3. Mise à jour de la déclinaison active et du pattern
    const activeVarKey = targetPattern.activeVariantKey || 'spd100_pit0';
    updateVariant(targetId, activeVarKey, {
      recordingResult: { pcm: slicedPCM, sampleRate },
      trimStartSec,
      trimEndSec,
    });

    updatePattern(targetId, {
      pack: res.pack,
      rawAudioSamples: res.cleanPCM,
      recordingResult: { pcm: slicedPCM, sampleRate },
      trimStartSec,
      trimEndSec,
      rawPitchCurve: res.pitchCurve,
      pitchCurve: res.pitchCurve,
      anacrusisSteps: res.anacrusisSteps,
      mainSteps: res.mainSteps,
      isMidiInitialized: true,
      midiLocked: true,
    });

    processedCount++;
  });

  return { processedCount, firstAssignedId };
}
