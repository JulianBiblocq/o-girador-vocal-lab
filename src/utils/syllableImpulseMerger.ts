/**
 * syllableImpulseMerger.ts
 * Auto-regroupement des syllabes « mangées » par impulsion vocale dans chaque temps [1]..[4]
 * et opérations 1-clic Joindre () / Scinder () sans décalage inter-temps (< 120 lignes).
 */
import type { VocalStepData } from '../types/vocalPack.types';
import { midiToNoteName } from './noteUtils';
import { syllabifySingleWord } from './syllableSplitter';

export function mergeTwoSyllables(left: string, right: string): string {
  const l = left || '', r = right || '';
  if (!l) return r;
  if (!r) return l;
  const rightHasSpace = r.endsWith(' ');
  const lClean = l.trimEnd(), rClean = r.trim();
  if (!l.endsWith(' ')) return `${lClean}${rClean}${rightHasSpace ? ' ' : ''}`;
  // Deux mots courts fusionnés par élision chantée (ex: "e " + "o " -> "e o ")
  return `${lClean} ${rClean}${rightHasSpace ? ' ' : ''}`;
}

export function mergeSyllablesToImpulseCount(syllables: string[], targetImpulses: number): string[] {
  const k = Math.max(1, targetImpulses);
  if (!syllables || syllables.length <= k) return [...(syllables || [])];
  const list = [...syllables];

  while (list.length > k) {
    // Priorité 1 : fusionner la fin d'un mot multi-syllabique mangée au chant (ex: ["ba", "que "] -> ["baque "], ["Trou", "xe ", "a "] -> ["Trouxe ", "a "])
    let mergeIdx = -1;
    for (let i = list.length - 1; i >= 1; i--) {
      if (!list[i - 1].endsWith(' ')) { mergeIdx = i - 1; break; }
    }
    // Priorité 2 : fusionner les deux dernières syllabes du temps (élision vocalique en fin de temps)
    if (mergeIdx === -1) mergeIdx = list.length - 2;
    list.splice(mergeIdx, 2, mergeTwoSyllables(list[mergeIdx], list[mergeIdx + 1]));
  }
  return list;
}

export function countVocalImpulsesInBeatSteps(stepsInBeat: VocalStepData[], writtenSylCount: number): number {
  if (writtenSylCount <= 1 || !stepsInBeat || stepsInBeat.length === 0) return Math.max(1, writtenSylCount);
  let impulses = 0, prevMidi = 0;
  for (let i = 0; i < stepsInBeat.length; i++) {
    const st = stepsInBeat[i];
    if (!st.active || st.midiNumber <= 0) { prevMidi = 0; continue; }
    const isAttack = st.note !== '───' && !st.isTie;
    const pitchChanged = prevMidi > 0 && Math.abs(st.midiNumber - prevMidi) >= 1;
    if (isAttack || pitchChanged || impulses === 0) impulses++;
    prevMidi = st.midiNumber;
  }
  return Math.max(1, Math.min(writtenSylCount, impulses || writtenSylCount));
}

export function joinSyllableWithPrevious(
  steps: VocalStepData[],
  targetStepIdx: number,
  stepsPerBeat = 4
): VocalStepData[] {
  const roots = steps.map((s, idx) => (s.active && s.note !== '───' && !s.isTie ? idx : -1)).filter((idx) => idx !== -1);
  const pos = roots.indexOf(targetStepIdx);
  if (pos <= 0) return steps;
  const prevRootIdx = roots[pos - 1];
  const next = steps.map((s) => ({ ...s }));

  next[prevRootIdx].syllable = mergeTwoSyllables(next[prevRootIdx].syllable || '', next[targetStepIdx].syllable || '');
  const prevMidi = next[prevRootIdx].midiNumber;
  const curMidi = next[targetStepIdx].midiNumber;
  const sameBeat = Math.floor(prevRootIdx / stepsPerBeat) === Math.floor(targetStepIdx / stepsPerBeat);

  if (prevMidi === curMidi || sameBeat) {
    let endMerge = targetStepIdx;
    while (endMerge + 1 < next.length && next[endMerge + 1].active && next[endMerge + 1].note === '───') endMerge++;
    for (let i = prevRootIdx + 1; i <= endMerge; i++) {
      if (next[i].tripletSlot === 'unused') continue;
      next[i] = { ...next[i], active: true, midiNumber: prevMidi, note: '───', isTie: true, syllable: '', syllableAttack: false };
    }
  } else {
    // Hauteur différente : décale les syllabes suivantes d'un cran vers la gauche sans toucher aux notes
    for (let k = pos; k < roots.length - 1; k++) {
      next[roots[k]].syllable = next[roots[k + 1]].syllable || '';
    }
    next[roots[roots.length - 1]].syllable = '';
  }
  return next;
}

export function splitBrickAndSyllableAt(
  steps: VocalStepData[],
  rootStepIdx: number,
  customInputText?: string
): VocalStepData[] {
  const root = steps[rootStepIdx];
  if (!root || !root.active || root.note === '───') return steps;
  let endIdx = rootStepIdx;
  while (endIdx + 1 < steps.length && steps[endIdx + 1].active && steps[endIdx + 1].note === '───') endIdx++;

  let splitIdx = endIdx > rootStepIdx ? rootStepIdx + Math.max(1, Math.floor((endIdx - rootStepIdx + 1) / 2)) : -1;
  if (splitIdx === -1 && rootStepIdx + 1 < steps.length && !steps[rootStepIdx + 1].active) splitIdx = rootStepIdx + 1;
  if (splitIdx === -1) return steps;

  const rawSyl = (customInputText ?? root.syllable ?? '').trim();
  const hadTrailingSpace = (customInputText ?? root.syllable ?? '').endsWith(' ');
  let leftSyl = rawSyl, rightSyl = '';

  if (/\s+|-/.test(rawSyl)) {
    const parts = rawSyl.split(/[\s\-]+/).filter(Boolean);
    leftSyl = parts[0] || '';
    rightSyl = parts.slice(1).join('') + (hadTrailingSpace ? ' ' : '');
  } else {
    const autoParts = syllabifySingleWord(rawSyl);
    if (autoParts.length >= 2) {
      leftSyl = autoParts[0].trimEnd();
      rightSyl = autoParts.slice(1).map((s) => s.trim()).join('') + (hadTrailingSpace ? ' ' : '');
    } else if (rawSyl.length >= 2) {
      const half = Math.ceil(rawSyl.length / 2);
      leftSyl = rawSyl.slice(0, half);
      rightSyl = rawSyl.slice(half) + (hadTrailingSpace ? ' ' : '');
    }
  }

  const next = steps.map((s) => ({ ...s }));
  next[rootStepIdx] = { ...next[rootStepIdx], syllable: leftSyl };
  next[splitIdx] = {
    ...next[splitIdx],
    active: true,
    midiNumber: root.midiNumber,
    note: midiToNoteName(root.midiNumber),
    isTie: false,
    syllableAttack: true,
    syllable: rightSyl,
    velocity: 100,
  };
  return next;
}
