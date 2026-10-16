/**
 * pianoRollInteractions.ts
 * Logique pure des opérations d'édition MIDI du Piano Roll :
 * Déplacement vertical, étirement horizontal, collage/fusion, découpe et gomme.
 */
import type { VocalStepData } from '../../types/vocalPack.types';
import { midiToNoteName } from '../../utils/noteUtils';

export type PianoRollTool = 'pointer' | 'glue' | 'cut' | 'erase' | 'text' | 'draw_move' | 'paste' | 'split' | 'lyric' | 'melodyne_cut';

export function findBrickRange(steps: VocalStepData[], stepIndex: number): { rootIndex: number; endIndex: number } | null {
  const target = steps[stepIndex];
  if (!target || !target.active) return null;

  let rootIndex = stepIndex;
  while (rootIndex > 0 && steps[rootIndex].note === '───') rootIndex--;

  let endIndex = rootIndex;
  while (endIndex + 1 < steps.length && steps[endIndex + 1].note === '───') endIndex++;

  return { rootIndex, endIndex };
}

export function moveBrick(steps: VocalStepData[], stepIndex: number, newMidi: number): VocalStepData[] {
  const range = findBrickRange(steps, stepIndex);
  if (!range) return steps;

  const next = [...steps];
  const root = next[range.rootIndex];
  next[range.rootIndex] = { ...root, midiNumber: newMidi, note: midiToNoteName(newMidi) };

  for (let i = range.rootIndex + 1; i <= range.endIndex; i++) {
    next[i] = { ...next[i], midiNumber: newMidi, note: '───' };
  }
  return next;
}

export function resizeBrick(steps: VocalStepData[], rootIndex: number, targetEndIndex: number): VocalStepData[] {
  const range = findBrickRange(steps, rootIndex);
  if (!range) return steps;

  const next = [...steps];
  const rootMidi = next[range.rootIndex].midiNumber;
  const clampedTarget = Math.max(range.rootIndex, Math.min(steps.length - 1, targetEndIndex));

  if (clampedTarget > range.endIndex) {
    for (let i = range.endIndex + 1; i <= clampedTarget; i++) {
      next[i] = { ...next[i], active: true, midiNumber: rootMidi, note: '───', velocity: 90 };
    }
  } else if (clampedTarget < range.endIndex) {
    for (let i = clampedTarget + 1; i <= range.endIndex; i++) {
      next[i] = { ...next[i], active: false, midiNumber: 0, note: '', syllable: '', velocity: 0 };
    }
  }
  return next;
}

export function glueBrickToPrevious(steps: VocalStepData[], stepIndex: number): VocalStepData[] {
  if (stepIndex <= 0) return steps;
  let prevActive = stepIndex - 1;
  while (prevActive >= 0 && !steps[prevActive].active) prevActive--;
  if (prevActive < 0) return steps;

  const targetMidi = steps[prevActive].midiNumber;
  const range = findBrickRange(steps, stepIndex);
  const end = range ? range.endIndex : stepIndex;

  const next = [...steps];
  for (let i = stepIndex; i <= end; i++) {
    next[i] = { ...next[i], active: true, midiNumber: targetMidi, note: '───', velocity: 90 };
  }
  return next;
}

export function splitTieAtStep(steps: VocalStepData[], stepIndex: number): VocalStepData[] {
  const step = steps[stepIndex];
  if (!step || !step.active || step.note !== '───') return steps;

  const next = [...steps];
  next[stepIndex] = { ...step, note: midiToNoteName(step.midiNumber), velocity: 100 };
  return next;
}

export function eraseBrick(steps: VocalStepData[], stepIndex: number): VocalStepData[] {
  const range = findBrickRange(steps, stepIndex);
  if (!range) return steps;

  const next = [...steps];
  for (let i = range.rootIndex; i <= range.endIndex; i++) {
    next[i] = { ...next[i], active: false, midiNumber: 0, note: '', syllable: '', velocity: 0 };
  }
  return next;
}

export function createSingleNote(steps: VocalStepData[], stepIndex: number, midi: number): VocalStepData[] {
  if (stepIndex < 0 || stepIndex >= steps.length) return steps;
  const next = [...steps];
  next[stepIndex] = {
    ...next[stepIndex],
    active: true,
    midiNumber: midi,
    note: midiToNoteName(midi),
    syllable: '',
    velocity: 100,
  };
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

