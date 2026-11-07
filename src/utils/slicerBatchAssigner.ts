/**
 * slicerBatchAssigner.ts
 * Découpe précise, calage Anacrouse+Mesures+1T et assignation atomique aux blocs Toada (< 120 lignes).
 */
import {
  type ToadaProject, type VocalPatternItem, type VocalRole,
  DEFAULT_TOADA_BPM, createDefaultVocalPattern,
} from '../types/toadaProject.types';
import type { SliceSegment } from '../types/slicerSegments.types';
import { getBeatsPerMeasure } from './musicalMath';
import { getDefaultBeatResolutions } from './alignmentMath';
import { extractPatternMelodicData } from '../audio/melodicExtractionHelper';
import { calculateSliceMetricT1Sec } from './slicerAlignmentHelper';
import { applyUpdateVariant } from './variantContextOps';
import { propagateSourceUpdatesToLinkedPatterns } from './patternMirrorHelper';

export interface BatchAssignOptions {
  project: ToadaProject;
  masterPCM: Float32Array;
  sampleRate: number;
  segments: SliceSegment[];
  addPattern?: (role: VocalRole, name?: string) => string;
  updatePattern?: (id: string, partial: Partial<VocalPatternItem>) => void;
  updateVariant?: (patternId: string, variantKey: string, partial: any) => void;
  loadProject?: (updatedProject: ToadaProject) => void;
  onProgress?: (current: number, total: number, name: string) => void;
}

export function executeBatchAssign(options: BatchAssignOptions): {
  processedCount: number;
  firstAssignedId: string | null;
  updatedProject: ToadaProject;
} {
  const { project, masterPCM, sampleRate, segments, addPattern, updatePattern, updateVariant, loadProject, onProgress } = options;
  const activeSegments = segments.filter((s) => s.targetPatternId !== 'ignore');
  if (activeSegments.length === 0) return { processedCount: 0, firstAssignedId: null, updatedProject: project };

  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const defaultResolutions = getDefaultBeatResolutions(project.timeSignature);
  const masterDurationSec = masterPCM.length / sampleRate;
  let workingProject: ToadaProject = { ...project, patterns: [...project.patterns], slots: [...project.slots] };
  let firstAssignedId: string | null = null;
  let processedCount = 0;

  activeSegments.forEach((segment, idx) => {
    let targetId = segment.targetPatternId;
    const hasAnacrusis = segment.hasAnacrusis !== false;
    let targetPattern = targetId !== 'new' ? workingProject.patterns.find((p) => p.id === targetId) : undefined;
    const bpm = targetPattern?.bpm ?? workingProject.bpm ?? DEFAULT_TOADA_BPM;
    const beatDuration = 60 / bpm;
    const measureDuration = beatsPerMeasure * beatDuration;
    const anacBeats = segment.anacrusisBeats ?? (hasAnacrusis ? 2 : 0);
    const metricT1Sec = segment.metricT1Sec ?? calculateSliceMetricT1Sec(segment.startSec, bpm, 0.8, hasAnacrusis, anacBeats);
    const rawSpan = Math.max(1, Math.round((segment.endSec - metricT1Sec - 0.15) / measureDuration));
    const measuresCount = (segment.measuresCount ?? Math.min(4, Math.max(1, rawSpan))) as 1 | 2 | 3 | 4;

    if (targetId === 'new') {
      const role: VocalRole = segment.role ?? 'puxador';
      const roleCount = workingProject.patterns.filter((p) => p.role === role).length + 1;
      const name = segment.name?.trim() || (role === 'puxador' ? `Appel ${roleCount}` : `Chœur ${roleCount}`);
      const created = createDefaultVocalPattern(role, name, measuresCount, bpm, 'C4');
      created.hasAnacrusis = hasAnacrusis;
      targetId = loadProject ? created.id : (addPattern ? addPattern(role, name) : created.id);
      targetPattern = { ...created, id: targetId };
      workingProject = { ...workingProject, patterns: [...workingProject.patterns, targetPattern] };
    }

    if (!targetPattern) return;
    if (!firstAssignedId) firstAssignedId = targetId;
    onProgress?.(idx + 1, activeSegments.length, targetPattern.name);

    const rawStartSec = Math.max(0, Math.min(metricT1Sec - (measureDuration + 0.3), segment.startSec - 0.3));
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

    const res = extractPatternMelodicData({
      rawPCM: slicedPCM, sampleRate, bpm, timeSignature: workingProject.timeSignature,
      measuresCount, beatsPerMeasure, beatResolutions, hasAnacrusis,
      trimStartSec, trimEndSec, referencePitch: targetPattern.referencePitch ?? 'C4',
      pitchShiftSemitones: 0, tessitura: targetPattern.tessitura, assignedLyricsText: targetPattern.assignedLyricsText, timeAnchors: targetPattern.timeAnchors,
      lowCutEnabled: targetPattern.lowCutEnabled !== false, enableTonePolish: targetPattern.enableTonePolish !== false,
      t1OffsetSec,
    });

    const activeVarKey = targetPattern.activeVariantKey || 'spd100_pit0';
    const varPartial = {
      recordingResult: { pcm: slicedPCM, sampleRate, t1OffsetSec, recordedBpm: bpm },
      trimStartSec, trimEndSec, t1OffsetSec,
    };
    const patPartial: Partial<VocalPatternItem> = {
      baseBpm: bpm, bpm, measuresCount, hasAnacrusis, anacrusisBeats: segment.anacrusisBeats, pack: res.pack, rawAudioSamples: res.cleanPCM,
      recordingResult: { pcm: slicedPCM, sampleRate, t1OffsetSec, recordedBpm: bpm }, trimStartSec, trimEndSec, t1OffsetSec,
      rawPitchCurve: res.pitchCurve, pitchCurve: res.pitchCurve,
      anacrusisSteps: res.anacrusisSteps, mainSteps: res.mainSteps,
      isMidiInitialized: true, midiLocked: true,
      hasCanonicalAlignment: true as any, correctedAudioSamples: null, melodyneRegions: [],
      stepStatus: { ...(targetPattern.stepStatus || {}), recorded: true, trimmed: true },
    };

    workingProject = applyUpdateVariant(workingProject, targetId, activeVarKey, varPartial);
    workingProject = {
      ...workingProject,
      patterns: propagateSourceUpdatesToLinkedPatterns(
        workingProject.patterns.map((p) => (p.id === targetId ? { ...p, ...patPartial } : p)),
        targetId
      ),
    };

    if (!loadProject) {
      updateVariant?.(targetId, activeVarKey, varPartial);
      updatePattern?.(targetId, patPartial);
    }
    processedCount++;
  });

  if (firstAssignedId) workingProject = { ...workingProject, activePatternId: firstAssignedId };
  loadProject?.(workingProject);
  return { processedCount, firstAssignedId, updatedProject: workingProject };
}
