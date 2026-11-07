/**
 * pianoRollInteractions.ts
 * Logique pure des opérations d'édition MIDI du Piano Roll :
 * Déplacement vertical, étirement horizontal, outil Colle (souder avec la brique suivante), découpe, gomme et VariAudio %.
 */
import type { VocalStepData } from '../../types/vocalPack.types';
import { midiToNoteName } from '../../utils/noteUtils';
import { findLastTiedStepIndex } from '../../utils/tripletBeatHelper';

export type PianoRollTool = 'pointer' | 'glue' | 'cut' | 'erase' | 'text' | 'draw_move' | 'paste' | 'split' | 'lyric' | 'melodyne_cut';

export function findBrickRange(steps: VocalStepData[], stepIndex: number): { rootIndex: number; endIndex: number } | null {
  const target = steps[stepIndex];
  if (!target || !target.active || target.tripletSlot === 'unused') return null;
  let rootIndex = stepIndex;
  while (rootIndex > 0 && (steps[rootIndex].note === '───' || steps[rootIndex].tripletSlot === 'unused')) rootIndex--;
  const endIndex = findLastTiedStepIndex(steps, rootIndex);
  return { rootIndex, endIndex };
}

export function moveBrick(steps: VocalStepData[], stepIndex: number, newMidi: number): VocalStepData[] {
  const range = findBrickRange(steps, stepIndex);
  if (!range) return steps;
  const next = [...steps];
  const root = next[range.rootIndex];
  next[range.rootIndex] = {
    ...root, midiNumber: newMidi, note: midiToNoteName(newMidi), isTie: false,
    manualPitchMoved: true, isUncertain: false, alternativeNote: undefined, doubtReason: undefined,
  };
  for (let i = range.rootIndex + 1; i <= range.endIndex; i++) {
    if (next[i].tripletSlot === 'unused') continue;
    next[i] = { ...next[i], midiNumber: newMidi, note: '───', isTie: true, manualPitchMoved: true, isUncertain: false };
  }
  return next;
}

export function resizeBrick(steps: VocalStepData[], rootIndex: number, targetEndIndex: number): VocalStepData[] {
  const range = findBrickRange(steps, rootIndex);
  if (!range) return steps;
  const next = [...steps], rootMidi = next[range.rootIndex].midiNumber;
  const clampedTarget = Math.max(range.rootIndex, Math.min(steps.length - 1, targetEndIndex));
  if (clampedTarget > range.endIndex) {
    for (let i = range.endIndex + 1; i <= clampedTarget; i++) {
      next[i] = { ...next[i], active: true, midiNumber: rootMidi, note: '───', isTie: true, velocity: 90 };
    }
  } else if (clampedTarget < range.endIndex) {
    for (let i = clampedTarget + 1; i <= range.endIndex; i++) {
      next[i] = { ...next[i], active: false, midiNumber: 0, note: '', isTie: false, syllable: '', velocity: 0 };
    }
  }
  return next;
}

export function glueBrickToNext(steps: VocalStepData[], stepIndex: number): VocalStepData[] {
  if (stepIndex < 0 || stepIndex >= steps.length) return steps;
  let r1 = findBrickRange(steps, stepIndex);
  if (!r1) {
    let prev = stepIndex - 1;
    while (prev >= 0 && !steps[prev].active) prev--;
    if (prev >= 0) r1 = findBrickRange(steps, prev);
  }
  if (!r1) return steps;

  let nextActive = r1.endIndex + 1;
  while (nextActive < steps.length && !steps[nextActive].active) nextActive++;
  if (nextActive >= steps.length) {
    // Si c'est la dernière brique, souder avec la brique précédente
    let prev = r1.rootIndex - 1;
    while (prev >= 0 && !steps[prev].active) prev--;
    if (prev < 0) return steps;
    const rPrev = findBrickRange(steps, prev);
    if (!rPrev) return steps;
    r1 = rPrev;
    nextActive = r1.endIndex + 1;
    while (nextActive < steps.length && !steps[nextActive].active) nextActive++;
  }
  const r2 = findBrickRange(steps, nextActive);
  if (!r2) return steps;

  const next = [...steps];
  const root1 = next[r1.rootIndex], root2 = next[r2.rootIndex];
  const targetMidi = root1.midiNumber;
  const s1 = root1.syllable ?? '', s2 = (root2.syllable ?? '').trim();
  const mergedSyl = s2 ? (s1.endsWith(' ') ? `${s1}${s2}` : `${s1.trim()}${s2}${root2.syllable?.endsWith(' ') ? ' ' : ''}`) : s1;
  next[r1.rootIndex] = { ...root1, syllable: mergedSyl };
  for (let i = r1.rootIndex + 1; i <= r2.endIndex; i++) {
    next[i] = { ...next[i], active: true, midiNumber: targetMidi, note: '───', isTie: true, syllable: '', velocity: 90 };
  }
  return next;
}

export const glueBrickToPrevious = glueBrickToNext;

export function splitTieAtStep(steps: VocalStepData[], stepIndex: number): VocalStepData[] {
  const step = steps[stepIndex];
  if (!step || !step.active || step.note !== '───') return steps;
  const next = [...steps];
  next[stepIndex] = { ...step, note: midiToNoteName(step.midiNumber), isTie: false, syllableAttack: true, velocity: 100 };
  return next;
}

export function eraseBrick(steps: VocalStepData[], stepIndex: number): VocalStepData[] {
  const range = findBrickRange(steps, stepIndex);
  if (!range) return steps;
  const next = [...steps];
  for (let i = range.rootIndex; i <= range.endIndex; i++) {
    next[i] = { ...next[i], active: false, midiNumber: 0, note: '', isTie: false, syllable: '', velocity: 0, melodynePullPct: 0 };
  }
  return next;
}

export function createSingleNote(steps: VocalStepData[], stepIndex: number, midi: number): VocalStepData[] {
  if (stepIndex < 0 || stepIndex >= steps.length) return steps;
  const next = [...steps];
  next[stepIndex] = { ...next[stepIndex], active: true, midiNumber: midi, note: midiToNoteName(midi), isTie: false, manualPitchMoved: true, syllable: '', velocity: 100 };
  return next;
}

export function setMelodyneCutRatio(steps: VocalStepData[], stepIndex: number, ratio: number): VocalStepData[] {
  const range = findBrickRange(steps, stepIndex);
  if (!range) return steps;
  const clamped = Math.max(0.0, Math.min(0.95, Math.round(ratio * 100) / 100));
  const next = [...steps];
  next[range.rootIndex] = { ...next[range.rootIndex], melodyneStartRatio: clamped };
  return next;
}

export function setBrickMelodynePullPct(steps: VocalStepData[], stepIndex: number, pullPct: number): VocalStepData[] {
  const range = findBrickRange(steps, stepIndex);
  if (!range) return steps;
  const clamped = Math.max(0, Math.min(100, Math.round(pullPct)));
  const next = [...steps];
  next[range.rootIndex] = { ...next[range.rootIndex], melodynePullPct: clamped };
  return next;
}

export function setAllBricksMelodynePullPct(steps: VocalStepData[], pullPct: number): VocalStepData[] {
  const clamped = Math.max(0, Math.min(100, Math.round(pullPct)));
  return steps.map((s) => (s.active && s.note !== '───' ? { ...s, melodynePullPct: clamped } : s));
}
