/**
 * syllableAligner.ts
 * Alignement des syllabes découpées sur les briques de notes mélodiques actives (< 145 lignes).
 * Modes : A (grille théorique sans audio), B (briques MIDI audio guidées par timeAnchors), C (linéaire).
 */
import type { VocalStepData } from '../types/vocalPack.types';
import type { TimeAnchor } from '../types/toadaDocument.types';
import { splitTextIntoLetraSyllables } from './syllableSplitter';
import { midiToNoteName } from './noteUtils';

export function mapSyllablesToSteps(steps: VocalStepData[], syllables: string[]): VocalStepData[] {
  let syllIdx = 0;
  return steps.map((st) => {
    if (!st.active || st.note === '───') return { ...st, syllable: '' };
    return { ...st, syllable: syllables[syllIdx++] ?? '' };
  });
}

export function alignSyllablesWithTimeAnchors(
  steps: VocalStepData[], timeAnchors: TimeAnchor[], beatsPerMeasure = 4, stepsPerBeat = 4
): VocalStepData[] {
  if (!timeAnchors || timeAnchors.length === 0) return steps;
  const maxStepNeeded = timeAnchors.reduce((max, a) => {
    const s = (a.measureOffset * beatsPerMeasure + (a.beat - 1)) * stepsPerBeat;
    return Math.max(max, s + (a.syllables?.length || 1) + stepsPerBeat);
  }, steps.length);

  const result: VocalStepData[] = steps.length >= maxStepNeeded ? steps.map((s) => ({ ...s })) : [];
  if (result.length < maxStepNeeded) {
    for (let i = 0; i < maxStepNeeded; i++) {
      result.push(steps[i] ? { ...steps[i] } : { stepIndex: i, active: false, note: 'C4', midiNumber: 60, velocity: 100, decay: 200, syllable: '' });
    }
  }

  for (const anchor of timeAnchors) {
    const stepStart = (anchor.measureOffset * beatsPerMeasure + (anchor.beat - 1)) * stepsPerBeat;
    if (anchor.isRest) {
      for (let s = stepStart; s < stepStart + stepsPerBeat && s < result.length; s++) {
        result[s].active = false; result[s].syllable = '';
      }
    } else {
      const syls = anchor.syllables?.length ? anchor.syllables : (anchor.textSlice ? splitTextIntoLetraSyllables(anchor.textSlice) : []);
      for (let sIdx = 0; sIdx < syls.length; sIdx++) {
        const targetStep = stepStart + sIdx;
        if (targetStep < result.length) { result[targetStep].active = true; result[targetStep].syllable = syls[sIdx]; }
      }
    }
  }
  return result;
}

function unTieStep(step: VocalStepData): void {
  if (step.note === '───') {
    step.note = midiToNoteName(step.midiNumber);
    step.isTie = false;
    step.syllableAttack = true;
  }
}

function alignAudioStepsWithTimeAnchors(
  steps: VocalStepData[], timeAnchors: TimeAnchor[], beatsPerMeasure = 4, stepsPerBeat = 4
): VocalStepData[] {
  const result = steps.map((s) => ({ ...s, syllable: '' }));

  for (const anchor of timeAnchors) {
    const beatStart = (anchor.measureOffset * beatsPerMeasure + (anchor.beat - 1)) * stepsPerBeat;
    const beatEnd = Math.min(result.length, beatStart + stepsPerBeat);
    if (beatStart >= result.length || anchor.isRest || anchor.isInitialRest) continue;

    if (anchor.isSustainedHold) {
      for (let i = beatStart; i < beatEnd; i++) {
        if (result[i].active && result[i].note !== '───') result[i].syllable = '-';
      }
      continue;
    }

    const syls = anchor.syllables?.length ? anchor.syllables : (anchor.textSlice ? splitTextIntoLetraSyllables(anchor.textSlice) : []);
    if (syls.length === 0) continue;

    const activeInBeat: number[] = [];
    for (let i = beatStart; i < beatEnd; i++) {
      if (result[i].active && result[i].midiNumber > 0) activeInBeat.push(i);
    }
    if (activeInBeat.length === 0) continue;

    const targetHeads = Math.min(syls.length, activeInBeat.length);
    for (let k = 0; k < targetHeads; k++) {
      const targetIdx = activeInBeat[Math.min(activeInBeat.length - 1, Math.floor((k * activeInBeat.length) / targetHeads))];
      unTieStep(result[targetIdx]);
    }

    const heads = activeInBeat.filter((idx) => result[idx].note !== '───');
    if (heads.length < targetHeads) {
      for (const idx of activeInBeat) {
        if (heads.length >= targetHeads) break;
        if (result[idx].note === '───') { unTieStep(result[idx]); heads.push(idx); }
      }
      heads.sort((a, b) => a - b);
    }

    if (syls.length <= heads.length) {
      for (let k = 0; k < syls.length; k++) result[heads[k]].syllable = syls[k];
      for (let k = syls.length; k < heads.length; k++) result[heads[k]].syllable = '-';
    } else {
      for (let k = 0; k < heads.length - 1; k++) result[heads[k]].syllable = syls[k];
      result[heads[heads.length - 1]].syllable = syls.slice(heads.length - 1).join('');
    }
  }
  return result;
}

export function applyLyricsSyllablesToSteps(
  steps: VocalStepData[], lyricsText?: string, timeAnchors?: TimeAnchor[], beatsPerMeasure = 4, stepsPerBeat = 4
): VocalStepData[] {
  if (timeAnchors && timeAnchors.length > 0) {
    const hasAudioBricks = steps.some((s) => s.active && s.midiNumber > 0 && s.decay < 10);
    return hasAudioBricks
      ? alignAudioStepsWithTimeAnchors(steps, timeAnchors, beatsPerMeasure, stepsPerBeat)
      : alignSyllablesWithTimeAnchors(steps, timeAnchors, beatsPerMeasure, stepsPerBeat);
  }
  if (!lyricsText || !lyricsText.trim()) return steps;
  const syllables = splitTextIntoLetraSyllables(lyricsText);
  let syllIdx = 0;
  return steps.map((st) => {
    if (!st.active) return { ...st, syllable: '' };
    if (st.note === '───') return { ...st, syllable: st.syllable || '-' };
    return { ...st, syllable: syllables[syllIdx++] ?? '' };
  });
}

export function reconstructWordsFromSteps(steps: VocalStepData[]): string {
  return steps
    .filter((st) => st.active && st.note !== '───' && st.syllable)
    .map((st) => (st.syllable === '~' || st.syllable === '-' ? '' : st.syllable))
    .join('');
}
