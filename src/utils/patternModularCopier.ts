/**
 * patternModularCopier.ts
 * Copieur modulaire [ ] Audio  [ ] Midi  [ ] Rythme  [ ] Syllabes d'un pattern vers un autre (< 125 lignes).
 * Préserve strictement l'audio et le t1OffsetSec de la cible lorsque options.audio === false.
 */
import type { ToadaProject, VocalPatternItem } from '../types/toadaProject.types';
import type { VocalStepData } from '../types/vocalPack.types';
import { midiToNote, noteToMidi } from './musicalMath';
import { findTwinPatterns } from './twinPatternsHelper';

export interface ModularCopyOptions {
  audio: boolean;
  midi: boolean;
  rhythm: boolean;
  syllables: boolean;
}

function isAttackStep(s?: VocalStepData | null): boolean {
  return Boolean(s && s.active && !s.isTie && s.note !== '───' && s.tripletSlot !== 'unused');
}

function getStepSyl(s: VocalStepData): string {
  return s.syllable ?? (s as any).lyric ?? '';
}

function setStepSyl(s: VocalStepData, syl: string): VocalStepData {
  const out: VocalStepData = { ...s, syllable: syl };
  if ((s as any).lyric !== undefined) (out as any).lyric = syl;
  return out;
}

function cloneStep(s: VocalStepData, idx: number): VocalStepData {
  const out: VocalStepData = {
    ...s, stepIndex: idx, active: Boolean(s.active), isTie: Boolean(s.isTie),
    note: s.note, midiNumber: s.midiNumber ?? (s.note && s.note !== '───' ? noteToMidi(s.note) : 0),
    syllable: getStepSyl(s), tripletSlot: s.tripletSlot,
  };
  if ((s as any).isTriplet !== undefined) (out as any).isTriplet = (s as any).isTriplet;
  if ((s as any).lyric !== undefined) (out as any).lyric = getStepSyl(s);
  return out;
}

function resolveLocalPitchFromCurve(target: VocalPatternItem, stepIdx: number, totalSteps: number): { note: string; midiNumber: number } | null {
  const curve = target.rawPitchCurve || target.pitchCurve;
  if (!curve || curve.length === 0) return null;
  const maxTime = Math.max(...curve.map((pt) => pt.timeSec || 0), 0.1);
  const startSec = (stepIdx / Math.max(1, totalSteps)) * maxTime, endSec = ((stepIdx + 1) / Math.max(1, totalSteps)) * maxTime;
  const pts = curve.filter((pt) => pt.timeSec >= startSec && pt.timeSec <= endSec && ((pt as any).midiFloat > 0 || (pt as any).midi > 0)).map((pt) => Math.round((pt as any).midiFloat ?? (pt as any).midi));
  if (pts.length === 0) return null;
  pts.sort((a, b) => a - b);
  const medianMidi = pts[Math.floor(pts.length / 2)];
  return { note: midiToNote(medianMidi), midiNumber: medianMidi };
}

function applySequentialPitchesAndSyllables(
  steps: VocalStepData[],
  pitchDonors: { note: string; midiNumber: number }[] | null,
  syllableDonors: string[] | null,
  targetForCurve?: VocalPatternItem
): VocalStepData[] {
  let attackCursor = 0, carriedNote = 'C4', carriedMidi = 60;
  return steps.map((rawStep, idx) => {
    let s = cloneStep(rawStep, idx);
    if (!s.active || s.tripletSlot === 'unused') return setStepSyl({ ...s, isTie: false, note: '───', midiNumber: 0 }, '');
    if (!s.isTie && s.note !== '───') {
      if (pitchDonors) {
        const curveNote = targetForCurve ? resolveLocalPitchFromCurve(targetForCurve, idx, steps.length) : null;
        const donor = curveNote || pitchDonors[Math.min(attackCursor, Math.max(0, pitchDonors.length - 1))] || { note: s.note || 'C4', midiNumber: s.midiNumber || 60 };
        carriedNote = donor.note;
        carriedMidi = donor.midiNumber || noteToMidi(donor.note);
        s = { ...s, note: carriedNote, midiNumber: carriedMidi };
      } else {
        carriedNote = s.note;
        carriedMidi = s.midiNumber || noteToMidi(s.note);
      }
      if (syllableDonors) s = setStepSyl(s, syllableDonors[attackCursor] ?? '');
      attackCursor++;
      return s;
    }
    return setStepSyl({ ...s, isTie: true, note: s.note === '───' ? '───' : carriedNote, midiNumber: carriedMidi }, '');
  });
}

export function copyPatternElements(source: VocalPatternItem, target: VocalPatternItem, options: ModularCopyOptions): VocalPatternItem {
  const next: VocalPatternItem = { ...target };
  if (options.audio) {
    Object.assign(next, {
      recordingResult: source.recordingResult ? { ...source.recordingResult } : source.recordingResult,
      rawAudioSamples: source.rawAudioSamples, correctedAudioSamples: source.correctedAudioSamples,
      t1OffsetSec: source.t1OffsetSec, trimStartSec: source.trimStartSec, trimEndSec: source.trimEndSec,
      rawPitchCurve: source.rawPitchCurve ? [...source.rawPitchCurve] : source.rawPitchCurve,
      pitchCurve: source.pitchCurve ? [...source.pitchCurve] : source.pitchCurve,
      variants: source.variants ? { ...source.variants } : source.variants, activeVariantKey: source.activeVariantKey,
    });
    if ((source as any).recordedBpm !== undefined) (next as any).recordedBpm = (source as any).recordedBpm;
  } else {
    Object.assign(next, {
      recordingResult: target.recordingResult, rawAudioSamples: target.rawAudioSamples,
      t1OffsetSec: target.t1OffsetSec, trimStartSec: target.trimStartSec, trimEndSec: target.trimEndSec,
      rawPitchCurve: target.rawPitchCurve, pitchCurve: target.pitchCurve,
    });
  }

  const srcAttacks = [...(source.anacrusisSteps || []), ...(source.mainSteps || [])].filter(isAttackStep);
  const tgtAttacks = [...(target.anacrusisSteps || []), ...(target.mainSteps || [])].filter(isAttackStep);

  if (options.rhythm || options.midi || options.syllables) {
    const baseAnac = (options.rhythm ? (source.anacrusisSteps || []) : (target.anacrusisSteps || [])).map(cloneStep);
    const baseMain = (options.rhythm ? (source.mainSteps || []) : (target.mainSteps || [])).map(cloneStep);
    const pitchDonors = options.rhythm && !options.midi
      ? tgtAttacks.map((a) => ({ note: a.note, midiNumber: a.midiNumber || noteToMidi(a.note) }))
      : !options.rhythm && options.midi ? srcAttacks.map((a) => ({ note: a.note, midiNumber: a.midiNumber || noteToMidi(a.note) })) : null;
    const syllableDonors = options.syllables ? srcAttacks.map(getStepSyl) : options.rhythm ? tgtAttacks.map(getStepSyl) : null;
    const updated = applySequentialPitchesAndSyllables([...baseAnac, ...baseMain], pitchDonors, syllableDonors, options.rhythm && !options.midi ? target : undefined);
    next.anacrusisSteps = updated.slice(0, baseAnac.length).map((s, i) => ({ ...s, stepIndex: i }));
    next.mainSteps = updated.slice(baseAnac.length).map((s, i) => ({ ...s, stepIndex: i }));
    if (options.rhythm) Object.assign(next, { hasAnacrusis: source.hasAnacrusis, anacrusisBeats: source.anacrusisBeats, hasTailBeat: source.hasTailBeat, exitBeat: source.exitBeat, measuresCount: source.measuresCount });
    if (options.midi) Object.assign(next, { isMidiInitialized: true, midiLocked: true, foldNotesView: source.foldNotesView });
  }
  if (options.syllables) Object.assign(next, { assignedLyricsText: source.assignedLyricsText, assignedPhoneticText: source.assignedPhoneticText });
  return next;
}

export function copyPatternElementsInProject(project: ToadaProject, sourceId: string, targetSelector: string | 'ALL_TWINS', options: ModularCopyOptions) {
  const source = project.patterns.find((p) => p.id === sourceId);
  if (!source) return { updatedProject: project, targetLabel: '', count: 0 };
  const targetIds = targetSelector === 'ALL_TWINS' ? findTwinPatterns(project, sourceId).filter((p) => p.id !== sourceId).map((p) => p.id) : [targetSelector];
  const targetSet = new Set(targetIds);
  const updatedPatterns = project.patterns.map((p) => (targetSet.has(p.id) && p.id !== sourceId ? copyPatternElements(source, p, options) : p));
  const firstTarget = project.patterns.find((p) => targetSet.has(p.id));
  const shortTag = firstTarget?.name?.match(/^#\d+/)?.[0] || firstTarget?.name || '#X';
  return { updatedProject: { ...project, patterns: updatedPatterns }, targetLabel: targetSelector === 'ALL_TWINS' ? `Jumeaux (${targetSet.size})` : shortTag, count: targetSet.size };
}
