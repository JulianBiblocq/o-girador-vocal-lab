/**
 * projectAudioResetter.ts
 * Purge locale intégrale des prises audio et données mélodiques d'un ToadaProject (< 80 lignes).
 * Conserve à 100 % la structure Organizador (slots, mesures, paroles, ancres, BPM, toadaMeta).
 */
import { type ToadaProject, type VocalPatternItem, makeVariantKey } from '../types/toadaProject.types';
import type { VocalStepData } from '../types/vocalPack.types';
import { getBeatsPerMeasure } from './musicalMath';
import { getDefaultBeatResolutions } from './alignmentMath';
import { resolveFreshTimeAnchors } from './timeAnchorParser';
import { applyLyricsSyllablesToSteps } from './syllableAligner';
import { extractProjectRawLyricsSource } from '../audio/livretResetHelper';
import { saveProjectToIndexedDB } from './projectAutoSave';
import { saveToadaToLibrary } from './toadaLibraryStorage';
import { setRoleSlicerSession } from './slicerSessionStore';

export function projectHasAnyRecordedAudio(project: ToadaProject): boolean {
  return (project.patterns || []).some((p) => Boolean(
    p.recordingResult?.pcm?.length || p.rawAudioSamples?.length || p.correctedAudioSamples?.length ||
    p.troupeTransposedPCM?.length || p.audioUrl || p.pack ||
    Object.values(p.variants || {}).some((v) => Boolean(v?.recordingResult?.pcm?.length))
  ));
}

export async function persistResetProjectAudio(project: ToadaProject): Promise<void> {
  await Promise.all([saveProjectToIndexedDB(project), saveToadaToLibrary(project)]);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('toada-saved', { detail: { id: project.id } }));
}

function buildVirginOrganizadorSteps(pat: VocalPatternItem, project: ToadaProject, beatsPerM: number, stepsPerB: number) {
  const hasAnac = pat.hasAnacrusis !== false, hasTail = Boolean(pat.hasTailBeat || pat.exitBeat === 1);
  const anacCount = hasAnac ? beatsPerM * stepsPerB : 0;
  const mainCount = Math.max(1, pat.measuresCount || 1) * beatsPerM * stepsPerB + (hasTail ? stepsPerB : 0);
  const blank: VocalStepData[] = Array.from({ length: anacCount + mainCount }, (_, i) => ({
    stepIndex: i, active: false, note: '', midiNumber: null, velocity: 100, decay: 200, syllable: '',
  }));
  const rawAnchors = resolveFreshTimeAnchors(pat.rawLineCode, pat.timeAnchors, beatsPerM, !hasAnac, pat.assignedLyricsText, extractProjectRawLyricsSource(project, pat));
  const hasLyricsOrAnchors = Boolean(rawAnchors?.length && (pat.assignedLyricsText?.trim() || rawAnchors.some((a) => a.syllables?.length || a.textSlice)));
  if (!hasLyricsOrAnchors || !rawAnchors) {
    return { anacrusisSteps: blank.slice(0, anacCount), mainSteps: blank.slice(anacCount).map((s, i) => ({ ...s, stepIndex: i })) };
  }
  const shiftM = hasAnac && rawAnchors[0].measureOffset === 0 && rawAnchors[0].beat === 1 ? 1 : 0;
  const shifted = shiftM ? rawAnchors.map((a) => ({ ...a, measureOffset: a.measureOffset + shiftM })) : rawAnchors;
  const aligned = applyLyricsSyllablesToSteps(blank, pat.assignedLyricsText, shifted, beatsPerM, stepsPerB);
  const padded = aligned.length >= anacCount + mainCount ? aligned : [...aligned, ...blank.slice(aligned.length)];
  return {
    anacrusisSteps: hasAnac ? padded.slice(0, anacCount).map((s, i) => ({ ...s, stepIndex: i })) : [],
    mainSteps: padded.slice(anacCount, anacCount + mainCount).map((s, i) => ({ ...s, stepIndex: i })),
  };
}

export function resetAllProjectRecordings(project: ToadaProject, options?: { skipImmediatePersist?: boolean }): ToadaProject {
  const beatsPerM = getBeatsPerMeasure(project.timeSignature);
  const stepsPerB = getDefaultBeatResolutions(project.timeSignature)[0] || 4, defVarKey = makeVariantKey(1.0, 0);
  setRoleSlicerSession(project.id, 'puxador', null);
  setRoleSlicerSession(project.id, 'coro', null);

  const patterns: VocalPatternItem[] = (project.patterns || []).map((pat) => {
    const { vocalAudioUrl: _vu, audioBase64: _ab, ...basePat } = pat as VocalPatternItem & { vocalAudioUrl?: unknown; audioBase64?: unknown };
    const { anacrusisSteps, mainSteps } = buildVirginOrganizadorSteps(basePat, project, beatsPerM, stepsPerB);
    return {
      ...basePat, recordingResult: null, rawAudioSamples: undefined, correctedAudioSamples: undefined,
      troupeTransposedPCM: undefined, troupeTransposedSemitones: undefined, audioUrl: undefined,
      variants: {}, activeVariantKey: defVarKey, pack: undefined, rawPitchCurve: undefined, pitchCurve: [],
      melodyneRegions: [], anacrusisSteps, mainSteps, isMidiInitialized: false, midiLocked: false,
      hasCanonicalAlignment: false, isRhythmValidated: false, isNotesValidated: false, stepStatus: undefined,
      t1OffsetSec: undefined, trimStartSec: 0, trimEndSec: 0, recordedAtPitchHz: undefined, pitchCorrectionAmount: undefined,
    };
  });

  const resetProject: ToadaProject = {
    ...project, patterns, sungScaleRoot: undefined, sungScaleMode: undefined,
    detectedScale: undefined, recordedAtPitchHz: undefined, customPitchClasses: null,
  };
  if (!options?.skipImmediatePersist) void persistResetProjectAudio(resetProject);
  return resetProject;
}
