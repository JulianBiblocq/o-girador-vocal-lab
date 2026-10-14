/**
 * syllabifier.ts
 * Découpeur syllabique phonétique : convention d'espaces de liaison,
 * support des mélismes ('-' / '--' -> '~') et élisions ('_' / apostrophe).
 */
import type { VocalStepData } from '../types/vocalPack.types';

const VOWEL_REGEX = /[aáàâãeéêiíoóôõuúyAÁÀÂÃEÉÊIÍOÓÔÕUÚY]/;
const DIPHTHONG_REGEX = /^(ai|au|ei|eu|oi|ou|ui|ia|ie|io|ua|ue|uo|ão|ãe|õe)/i;

function syllabifySingleWord(word: string): string[] {
  const clean = word.trim();
  if (!clean) return [];

  // Tiret explicite (ex: "va-di-ar")
  if (clean.includes('-')) {
    const rawParts = clean.split('-').filter(Boolean);
    return rawParts.map((part, idx) => (idx === rawParts.length - 1 ? `${part} ` : part));
  }

  // Élision avec apostrophe (ex: "qu'eu", "d'ouro", "êtr'le") : assigné en un bloc
  if (clean.includes("'")) {
    return [`${clean} `];
  }

  const syllables: string[] = [];
  let current = '';

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    current += char;

    if (VOWEL_REGEX.test(char)) {
      if (i + 1 < clean.length && DIPHTHONG_REGEX.test(clean.slice(i, i + 2))) {
        current += clean[i + 1];
        i++;
      }
      const rest = clean.slice(i + 1);
      if (VOWEL_REGEX.test(rest)) {
        const nextChar = clean[i + 1];
        const nextNext = clean[i + 2];
        const isDigraph = nextChar && nextNext && /^(lh|nh|ch|[bcdfghptv][rl])/i.test(clean.slice(i + 1, i + 3));

        if (!nextChar || VOWEL_REGEX.test(nextChar) || isDigraph) {
          syllables.push(current);
          current = '';
        } else if (nextNext && !VOWEL_REGEX.test(nextNext)) {
          current += nextChar;
          i++;
          syllables.push(current);
          current = '';
        } else {
          syllables.push(current);
          current = '';
        }
      }
    }
  }

  if (current) syllables.push(current);
  return syllables.map((s, idx) => (idx === syllables.length - 1 ? `${s} ` : s));
}

export function splitTextIntoLetraSyllables(text: string): string[] {
  // Normaliser les mélismes multiples ("va--di" -> "va - di")
  const normalized = text.replace(/--+/g, ' - ');
  const tokens = normalized.trim().split(/\s+/).filter(Boolean);
  const result: string[] = [];

  for (const token of tokens) {
    if (token === '-' || token === '~') {
      result.push('~'); // Marqueur de mélisme
    } else if (token.includes('_')) {
      // Élision / Synalèphe ("être_le" -> "être le ")
      result.push(token.replace(/_/g, ' ') + ' ');
    } else {
      result.push(...syllabifySingleWord(token));
    }
  }
  return result;
}

export function mapSyllablesToSteps(steps: VocalStepData[], syllables: string[]): VocalStepData[] {
  let syllIdx = 0;
  return steps.map((st) => {
    if (!st.active || st.note === '───') return { ...st, syllable: '' };
    const syll = syllables[syllIdx] ?? '';
    syllIdx++;
    return { ...st, syllable: syll };
  });
}

export function reconstructWordsFromSteps(steps: VocalStepData[]): string {
  return steps
    .filter((st) => st.active && st.note !== '───' && st.syllable)
    .map((st) => (st.syllable === '~' ? '' : st.syllable))
    .join('');
}
