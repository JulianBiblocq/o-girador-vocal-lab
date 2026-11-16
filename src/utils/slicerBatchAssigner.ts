/**
 * slicerBatchAssigner.ts
 * Découpe précise, calage Anacrouse+Mesures+1T et assignation atomique aux blocs Toada
 * avec exécution asynchrone non-bloquante dans le Web Worker DSP (`Analyse X / N...`) (< 134 lignes).
 */
import { type ToadaProject, type VocalPatternItem, type VocalRole, DEFAULT_TOADA_BPM, createDefaultVocalPattern } from '../types/toadaProject.types';
import type { SliceSegment } from '../types/slicerSegments.types';
import { getBeatsPerMeasure } from './musicalMath';
import { getDefaultBeatResolutions } from './alignmentMath';
import { extractPatternMelodicData, type ExtractMelodicParams, type ExtractMelodicResult } from '../audio/melodicExtractionHelper';
import { extractMelodicDataInWorker } from '../workers/vocalDspWorkerClient';
import { calculateSliceMetricT1Sec } from './slicerAlignmentHelper';
import { applyUpdateVariant } from './variantContextOps';
import { propagateSourceUpdatesToLinkedPatterns } from './patternMirrorHelper';

export interface BatchAssignOptions {
  project: ToadaProject; masterPCM: Float32Array; sampleRate: number; segments: SliceSegment[];
  addPattern?: (role: VocalRole, name?: string) => string;
  updatePattern?: (id: string, partial: Partial<VocalPatternItem>) => void;
  updateVariant?: (patternId: string, variantKey: string, partial: any) => void;
  loadProject?: (updatedProject: ToadaProject) => void;
  onProgress?: (current: number, total: number, name: string) => void;
}
export interface BatchAssignResult { processedCount: number; firstAssignedId: string | null; updatedProject: ToadaProject; }

interface PreparedBatchJob {
  targetId: string; targetPattern: VocalPatternItem; segment: SliceSegment; slicedPCM: Float32Array;
  bpm: number; measuresCount: 1 | 2 | 3 | 4; hasAnacrusis: boolean;
  trimStartSec: number; trimEndSec: number; t1OffsetSec: number; extractParams: ExtractMelodicParams;
}

function prepareBatchJobs(options: BatchAssignOptions) {
  const { project, masterPCM, sampleRate, segments, addPattern, loadProject } = options;
  const activeSegments = segments.filter((s) => s.targetPatternId !== 'ignore');
  let workingProject: ToadaProject = { ...project, patterns: [...project.patterns], slots: [...project.slots] };
  let firstAssignedId: string | null = null;
  const jobs: PreparedBatchJob[] = [];
  if (activeSegments.length === 0) return { jobs, workingProject, firstAssignedId };

  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature), defaultResolutions = getDefaultBeatResolutions(project.timeSignature);
  const masterDurationSec = masterPCM.length / sampleRate;

  for (const segment of activeSegments) {
    let targetId = segment.targetPatternId;
    const hasAnacrusis = segment.hasAnacrusis !== false;
    let targetPattern = targetId !== 'new' ? workingProject.patterns.find((p) => p.id === targetId) : undefined;
    const bpm = targetPattern?.bpm ?? workingProject.bpm ?? DEFAULT_TOADA_BPM, measureDuration = beatsPerMeasure * (60 / bpm);
    const anacBeats = segment.anacrusisBeats ?? (hasAnacrusis ? 2 : 0);
    const metricT1Sec = segment.metricT1Sec ?? calculateSliceMetricT1Sec(segment.startSec, bpm, 0.8, hasAnacrusis, anacBeats);
    const measuresCount = (segment.measuresCount ?? Math.min(4, Math.max(1, Math.round((segment.endSec - metricT1Sec - 0.15) / measureDuration)))) as 1 | 2 | 3 | 4;

    if (targetId === 'new') {
      const role: VocalRole = segment.role ?? 'puxador', roleCount = workingProject.patterns.filter((p) => p.role === role).length + 1;
      const name = segment.name?.trim() || (role === 'puxador' ? `Appel ${roleCount}` : `Chœur ${roleCount}`);
      const created = createDefaultVocalPattern(role, name, measuresCount, bpm, 'C4');
      created.hasAnacrusis = hasAnacrusis;
      targetId = loadProject ? created.id : (addPattern ? addPattern(role, name) : created.id);
      targetPattern = { ...created, id: targetId };
      workingProject = { ...workingProject, patterns: [...workingProject.patterns, targetPattern] };
    }
    if (!targetPattern) continue;
    if (!firstAssignedId) firstAssignedId = targetId;

    const rawStartSec = Math.max(0, Math.min(metricT1Sec - (measureDuration + 0.3), segment.startSec - 0.3));
    const rawEndSec = Math.min(masterDurationSec, Math.max(metricT1Sec + measuresCount * measureDuration + 1.0, segment.endSec + 0.3));
    const sStart = Math.floor(rawStartSec * sampleRate), sEnd = Math.floor(rawEndSec * sampleRate);
    if (sEnd <= sStart) continue;

    const slicedPCM = masterPCM.slice(sStart, sEnd), bufferStartSec = sStart / sampleRate;
    const t1OffsetSec = Math.max(0, metricT1Sec - bufferStartSec), trimStartSec = Math.max(0, segment.startSec - bufferStartSec);
    const trimEndSec = Math.min(slicedPCM.length / sampleRate, Math.max(trimStartSec + 0.1, segment.endSec - bufferStartSec));
    jobs.push({
      targetId, targetPattern, segment, slicedPCM, bpm, measuresCount, hasAnacrusis, trimStartSec, trimEndSec, t1OffsetSec,
      extractParams: {
        rawPCM: slicedPCM, sampleRate, bpm, timeSignature: workingProject.timeSignature, measuresCount, beatsPerMeasure,
        beatResolutions: targetPattern.pack?.metadata.beatResolutions || defaultResolutions, hasAnacrusis,
        trimStartSec, trimEndSec, referencePitch: targetPattern.referencePitch ?? 'C4', pitchShiftSemitones: 0,
        tessitura: targetPattern.tessitura, assignedLyricsText: targetPattern.assignedLyricsText, timeAnchors: targetPattern.timeAnchors,
        lowCutEnabled: targetPattern.lowCutEnabled !== false, enableTonePolish: targetPattern.enableTonePolish !== false,
        t1OffsetSec, referenceMidiNotes: targetPattern.referenceMidiNotes,
      },
    });
  }
  return { jobs, workingProject, firstAssignedId };
}

function commitJobToProject(workingProject: ToadaProject, job: PreparedBatchJob, res: ExtractMelodicResult, options: BatchAssignOptions): ToadaProject {
  const { targetId, targetPattern, segment, slicedPCM, bpm, measuresCount, hasAnacrusis, trimStartSec, trimEndSec, t1OffsetSec } = job;
  const activeVarKey = targetPattern.activeVariantKey || 'spd100_pit0';
  const varPartial = { recordingResult: { pcm: slicedPCM, sampleRate: options.sampleRate, t1OffsetSec, recordedBpm: bpm }, trimStartSec, trimEndSec, t1OffsetSec };
  const patPartial: Partial<VocalPatternItem> = {
    baseBpm: bpm, bpm, measuresCount, hasAnacrusis, anacrusisBeats: segment.anacrusisBeats, pack: res.pack, rawAudioSamples: res.cleanPCM,
    recordingResult: varPartial.recordingResult, trimStartSec, trimEndSec, t1OffsetSec, rawPitchCurve: res.pitchCurve, pitchCurve: res.pitchCurve,
    anacrusisSteps: res.anacrusisSteps, mainSteps: res.mainSteps, isMidiInitialized: true, midiLocked: true,
    hasCanonicalAlignment: true as any, correctedAudioSamples: null, melodyneRegions: [],
    stepStatus: { ...(targetPattern.stepStatus || {}), recorded: true, trimmed: true },
  };
  let nextProj = applyUpdateVariant(workingProject, targetId, activeVarKey, varPartial);
  nextProj = { ...nextProj, patterns: propagateSourceUpdatesToLinkedPatterns(nextProj.patterns.map((p) => (p.id === targetId ? { ...p, ...patPartial } : p)), targetId) };
  if (!options.loadProject) { options.updateVariant?.(targetId, activeVarKey, varPartial); options.updatePattern?.(targetId, patPartial); }
  return nextProj;
}

export function executeBatchAssign(options: BatchAssignOptions): BatchAssignResult {
  const { jobs, workingProject: initProj, firstAssignedId } = prepareBatchJobs(options);
  let workingProject = initProj;
  jobs.forEach((job, idx) => { options.onProgress?.(idx + 1, jobs.length, job.targetPattern.name); workingProject = commitJobToProject(workingProject, job, extractPatternMelodicData(job.extractParams), options); });
  if (firstAssignedId) workingProject = { ...workingProject, activePatternId: firstAssignedId };
  options.loadProject?.(workingProject);
  return { processedCount: jobs.length, firstAssignedId, updatedProject: workingProject };
}

export async function executeBatchAssignAsync(options: BatchAssignOptions): Promise<BatchAssignResult> {
  const { jobs, workingProject: initProj, firstAssignedId } = prepareBatchJobs(options);
  let workingProject = initProj;
  for (let idx = 0; idx < jobs.length; idx++) {
    const job = jobs[idx];
    options.onProgress?.(idx + 1, jobs.length, job.targetPattern.name);
    workingProject = commitJobToProject(workingProject, job, await extractMelodicDataInWorker(job.extractParams), options);
  }
  if (firstAssignedId) workingProject = { ...workingProject, activePatternId: firstAssignedId };
  options.loadProject?.(workingProject);
  return { processedCount: jobs.length, firstAssignedId, updatedProject: workingProject };
}
