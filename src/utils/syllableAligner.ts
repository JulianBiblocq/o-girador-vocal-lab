/**
 * syllableAligner.ts
 * Alignement des syllabes découpées sur les briques de notes mélodiques actives (< 50 lignes).
 * Prise en charge des mélismes ('-' / '~') prolongeant la voyelle précédente.
 */
import type { VocalStepData } from '../types/vocalPack.types';
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

export function applyLyricsSyllablesToSteps(steps: VocalStepData[], lyricsText?: string): VocalStepData[] {
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
