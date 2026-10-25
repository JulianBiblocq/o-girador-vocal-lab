/**
 * syllableAligner.ts
 * Alignement des syllabes découpées sur les briques de notes mélodiques actives (< 50 lignes).
 * Prise en charge des mélismes ('-' / '~') prolongeant la voyelle précédente.
 */
import type { VocalStepData } from '../types/vocalPack.types';
import type { TimeAnchor } from '../types/toadaDocument.types';
import { splitTextIntoLetraSyllables } from './syllableSplitter';

export function mapSyllablesToSteps(steps: VocalStepData[], syllables: string[]): VocalStepData[] {
  let syllIdx = 0;
  return steps.map((st) => {
    if (!st.active || st.note === '───') return { ...st, syllable: '' };
    const syll = syllables[syllIdx] ?? '';
    syllIdx++;
    return { ...st, syllable: syll };
  });
}

export function alignSyllablesWithTimeAnchors(
  steps: VocalStepData[],
  timeAnchors: TimeAnchor[],
  beatsPerMeasure = 4,
  stepsPerBeat = 4
): VocalStepData[] {
  if (!timeAnchors || timeAnchors.length === 0) return steps;

  const maxStepNeeded = timeAnchors.reduce((max, a) => {
    const s = (a.measureOffset * beatsPerMeasure + (a.beat - 1)) * stepsPerBeat;
    const sylCount = a.syllables?.length || 1;
    return Math.max(max, s + sylCount + stepsPerBeat);
  }, steps.length);

  const result: VocalStepData[] = steps.length >= maxStepNeeded ? steps.map((s) => ({ ...s })) : [];
  if (result.length < maxStepNeeded) {
    for (let i = 0; i < maxStepNeeded; i++) {
      result.push(steps[i] ? { ...steps[i] } : {
        stepIndex: i,
        active: false,
        note: 'C4',
        midiNumber: 60,
        velocity: 100,
        decay: 200,
        syllable: ''
      });
    }
  }

  for (const anchor of timeAnchors) {
    const m = anchor.measureOffset;
    const b = anchor.beat;
    const stepStart = (m * beatsPerMeasure + (b - 1)) * stepsPerBeat;

    if (anchor.isRest) {
      for (let s = stepStart; s < stepStart + stepsPerBeat && s < result.length; s++) {
        result[s].active = false;
        result[s].syllable = '';
      }
    } else {
      const syls = anchor.syllables && anchor.syllables.length > 0
        ? anchor.syllables
        : (anchor.textSlice ? splitTextIntoLetraSyllables(anchor.textSlice) : []);

      for (let sIdx = 0; sIdx < syls.length; sIdx++) {
        const targetStep = stepStart + sIdx;
        if (targetStep < result.length) {
          result[targetStep].active = true;
          result[targetStep].syllable = syls[sIdx];
        }
      }
    }
  }

  return result;
}

export function applyLyricsSyllablesToSteps(
  steps: VocalStepData[],
  lyricsText?: string,
  timeAnchors?: TimeAnchor[],
  beatsPerMeasure = 4,
  stepsPerBeat = 4
): VocalStepData[] {
  if (timeAnchors && timeAnchors.length > 0) {
    return alignSyllablesWithTimeAnchors(steps, timeAnchors, beatsPerMeasure, stepsPerBeat);
  }
  if (!lyricsText || !lyricsText.trim()) return steps;
  const syllables = splitTextIntoLetraSyllables(lyricsText);
  let syllIdx = 0;
  return steps.map((st) => {
    if (!st.active) return { ...st, syllable: '' };
    if (st.note === '───') return { ...st, syllable: st.syllable || '-' };
    const syll = syllables[syllIdx] ?? '';
    syllIdx++;
    return { ...st, syllable: syll };
  });
}

export function reconstructWordsFromSteps(steps: VocalStepData[]): string {
  return steps
    .filter((st) => st.active && st.note !== '───' && st.syllable)
    .map((st) => (st.syllable === '~' || st.syllable === '-' ? '' : st.syllable))
    .join('');
}
