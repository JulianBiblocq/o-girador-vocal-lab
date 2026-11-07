/**
 * twinPatternsHelper.ts
 * Détection des Groupes de Patterns Jumeaux / Répétés (ex: les 4 « Vovó falou » ou « Estrela brilhante »),
 * assignation 1-clic d'une prise unique ou d'une Paire A/B sur la Frise Conducteur,
 * et copie des Notes MIDI + Rythme + Syllabes vers les jumeaux tout en conservant leur Audio (< 130 lignes).
 */
import type { ToadaProject, VocalPatternItem } from '../types/toadaProject.types';
import type { VocalStepData } from '../types/vocalPack.types';
import { cleanLyricsForAlignment } from './syllableUnderlineFormatter';
import { buildUpdatedVocalPackExport } from '../audio/livretResetHelper';
import { correctAudioPitchWithMelodyne } from '../audio/melodynePitchCorrector';

export function normalizePatternLyricKey(pat?: VocalPatternItem | null): string {
  if (!pat) return '';
  const raw = pat.assignedLyricsText || pat.rawLineCode || (pat.name || '').replace(/^#\d+\s*/, '');
  return cleanLyricsForAlignment(raw).toLowerCase().replace(/-/g, '').replace(/['’_,.;:!?()"]/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function findTwinPatterns(project: ToadaProject, patternId: string): VocalPatternItem[] {
  const refPat = project.patterns.find((p) => p.id === patternId);
  if (!refPat) return [];
  const refKey = normalizePatternLyricKey(refPat);
  if (!refKey) return [refPat];
  const matching = project.patterns.filter((p) => p.role === refPat.role && normalizePatternLyricKey(p) === refKey);
  const matchingMap = new Map(matching.map((p) => [p.id, p]));
  const orderedIds: string[] = [];
  const roleField = refPat.role === 'puxador' ? 'puxadorPatternId' : 'coroPatternId';
  for (const slot of project.slots || []) {
    const pid = slot[roleField];
    if (pid && matchingMap.has(pid) && !orderedIds.includes(pid)) orderedIds.push(pid);
  }
  for (const p of matching) if (!orderedIds.includes(p.id)) orderedIds.push(p.id);
  return orderedIds.map((id) => matchingMap.get(id)!).filter(Boolean);
}

export function findTwinSlotIndices(project: ToadaProject, patternId: string): number[] {
  const twins = findTwinPatterns(project, patternId);
  if (twins.length === 0) return [];
  const twinIds = new Set(twins.map((t) => t.id));
  const roleField = twins[0].role === 'puxador' ? 'puxadorPatternId' : 'coroPatternId';
  const indices: number[] = [];
  (project.slots || []).forEach((slot, idx) => {
    const pid = slot[roleField];
    if (pid && twinIds.has(pid)) indices.push(idx);
  });
  return indices;
}

export function assignSingleBestTwinToAll(project: ToadaProject, winnerPatternId: string): ToadaProject {
  const twins = findTwinPatterns(project, winnerPatternId);
  if (twins.length === 0) return project;
  const winner = project.patterns.find((p) => p.id === winnerPatternId) ?? twins[0];
  const twinIds = new Set(twins.map((t) => t.id));
  const roleField = winner.role === 'puxador' ? 'puxadorPatternId' : 'coroPatternId';
  const updatedSlots = (project.slots || []).map((slot) => {
    const curId = slot[roleField];
    return curId && twinIds.has(curId) ? { ...slot, [roleField]: winner.id } : slot;
  });
  const updatedPatterns = project.patterns.filter((p) => !twinIds.has(p.id) || p.id === winner.id);
  const nextActiveId = twinIds.has(project.activePatternId) ? winner.id : project.activePatternId;
  return { ...project, patterns: updatedPatterns, slots: updatedSlots, activePatternId: nextActiveId };
}

export function assignTwinPairAB(project: ToadaProject, patternAId: string, patternBId: string): ToadaProject {
  const twins = findTwinPatterns(project, patternAId);
  if (twins.length === 0) return project;
  const patA = project.patterns.find((p) => p.id === patternAId) ?? twins[0];
  const patB = project.patterns.find((p) => p.id === patternBId) ?? twins[1] ?? patA;
  const twinIds = new Set([...twins.map((t) => t.id), patA.id, patB.id]);
  const roleField = patA.role === 'puxador' ? 'puxadorPatternId' : 'coroPatternId';
  let occIdx = 0;
  const updatedSlots = (project.slots || []).map((slot) => {
    const curId = slot[roleField];
    if (curId && twinIds.has(curId)) {
      const assignedId = occIdx % 2 === 0 ? patA.id : patB.id;
      occIdx++;
      return { ...slot, [roleField]: assignedId };
    }
    return slot;
  });
  const updatedPatterns = project.patterns.map((p) => {
    if (!twinIds.has(p.id) || p.id === patA.id || p.id === patB.id) return p;
    const tIdx = twins.findIndex((t) => t.id === p.id);
    const donor = tIdx % 2 === 0 ? patA : patB;
    const hasOwnAudio = Boolean(p.recordingResult?.pcm?.length || p.rawAudioSamples?.length);
    if (hasOwnAudio) return { ...p, linkedSourcePatternId: donor.id };
    return {
      ...p, linkedSourcePatternId: donor.id, recordingResult: donor.recordingResult, rawAudioSamples: donor.rawAudioSamples,
      rawPitchCurve: donor.rawPitchCurve, pitchCurve: donor.pitchCurve, trimStartSec: donor.trimStartSec, trimEndSec: donor.trimEndSec,
      t1OffsetSec: donor.t1OffsetSec, anacrusisSteps: (donor.anacrusisSteps || []).map((s, i) => ({ ...s, stepIndex: i })),
      mainSteps: (donor.mainSteps || []).map((s, i) => ({ ...s, stepIndex: i })), pack: donor.pack, isMidiInitialized: donor.isMidiInitialized,
    };
  });
  return { ...project, patterns: updatedPatterns, slots: updatedSlots };
}

function cloneStepDeep(s: VocalStepData, idx: number): VocalStepData {
  const syl = s.syllable ?? (s as any).lyric ?? '';
  const out: VocalStepData = { ...s, stepIndex: idx, active: Boolean(s.active), isTie: Boolean(s.isTie), note: s.note, midiNumber: s.midiNumber, syllable: syl, tripletSlot: s.tripletSlot };
  if ((s as any).lyric !== undefined) (out as any).lyric = syl;
  return out;
}

export function copyMidiAndSyllablesToTwins(project: ToadaProject, sourcePatternId: string, targetPatternIds?: string[]): ToadaProject {
  const src = project.patterns.find((p) => p.id === sourcePatternId);
  if (!src) return project;
  const defaultTargets = findTwinPatterns(project, sourcePatternId).filter((p) => p.id !== sourcePatternId).map((p) => p.id);
  const targetSet = new Set(targetPatternIds && targetPatternIds.length > 0 ? targetPatternIds : defaultTargets);
  if (targetSet.size === 0) return project;
  const updatedPatterns = project.patterns.map((p) => {
    if (!targetSet.has(p.id) || p.id === src.id) return p;
    const anacrusisSteps = (src.anacrusisSteps || []).map(cloneStepDeep);
    const mainSteps = (src.mainSteps || []).map(cloneStepDeep);
    const allCopiedSteps = [...anacrusisSteps, ...mainSteps];
    const basePack = p.pack || src.pack;
    const updatedPack = basePack ? buildUpdatedVocalPackExport(basePack, allCopiedSteps, src.hasAnacrusis !== false, 4, p.rawPitchCurve || p.pitchCurve || []) : p.pack;
    let correctedAudioSamples = p.correctedAudioSamples;
    const hasPull = allCopiedSteps.some((s) => s.active && s.note !== '───' && (s.melodynePullPct ?? 0) > 0);
    if (hasPull && p.rawAudioSamples?.length && (p.rawPitchCurve?.length || p.pitchCurve?.length)) {
      const sr = p.recordingResult?.sampleRate || p.pack?.audio?.sampleRate || 44100;
      correctedAudioSamples = correctAudioPitchWithMelodyne(p.rawAudioSamples, sr, p.rawAudioSamples.length / sr, p.rawPitchCurve || p.pitchCurve, allCopiedSteps, p.melodyneRegions || []);
    }
    const nextPat: VocalPatternItem = {
      ...p, recordingResult: p.recordingResult, t1OffsetSec: p.t1OffsetSec, trimStartSec: p.trimStartSec, trimEndSec: p.trimEndSec, rawPitchCurve: p.rawPitchCurve,
      anacrusisSteps, mainSteps, assignedLyricsText: src.assignedLyricsText, hasAnacrusis: src.hasAnacrusis, anacrusisBeats: src.anacrusisBeats,
      hasTailBeat: src.hasTailBeat, measuresCount: src.measuresCount, foldNotesView: src.foldNotesView, isMidiInitialized: true, midiLocked: true, pack: updatedPack, correctedAudioSamples,
    };
    if ((src as any).isNotesCollapsed !== undefined) (nextPat as any).isNotesCollapsed = (src as any).isNotesCollapsed;
    return nextPat;
  });
  return { ...project, patterns: updatedPatterns };
}
