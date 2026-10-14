/**
 * syllabifier.ts
 * Découpeur syllabique phonétique (portugais / français) et application
 * stricte de la convention de liaison des mots pour Sequenciador.
 */
import type { VocalStepData } from '../types/vocalPack.types';

const VOWEL_REGEX = /[aáàâãeéêiíoóôõuúyAÁÀÂÃEÉÊIÍOÓÔÕUÚY]/;
const DIPHTHONG_REGEX = /^(ai|au|ei|eu|oi|ou|ui|ia|ie|io|ua|ue|uo|ão|ãe|õe)/i;

function syllabifySingleWord(word: string): string[] {
  const clean = word.trim();
  if (!clean) return [];

  // Si l'utilisateur a inséré des tirets explicites (ex: "va-di-ar")
  if (clean.includes('-')) {
    const rawParts = clean.split('-').filter(Boolean);
    return rawParts.map((part, idx) => (idx === rawParts.length - 1 ? `${part} ` : part));
  }

  const syllables: string[] = [];
  let current = '';

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    current += char;

    if (VOWEL_REGEX.test(char)) {
      // Détection des diphtongues naturelles inséparables (ex: "Eu", "vou")
      if (i + 1 < clean.length && DIPHTHONG_REGEX.test(clean.slice(i, i + 2))) {
        current += clean[i + 1];
        i++;
      }

      const rest = clean.slice(i + 1);
      if (VOWEL_REGEX.test(rest)) {
        const nextChar = clean[i + 1];
        const nextNextChar = clean[i + 2];
        const isDigraph = nextChar && nextNextChar && /^(lh|nh|ch|[bcdfghptv][rl])/i.test(clean.slice(i + 1, i + 3));

        if (!nextChar || VOWEL_REGEX.test(nextChar)) {
          syllables.push(current);
          current = '';
        } else if (isDigraph) {
          syllables.push(current);
          current = '';
        } else if (nextNextChar && !VOWEL_REGEX.test(nextNextChar)) {
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

  // Application de la convention stricte Sequenciador :
  // Syllabe intérieure : pas d'espace. Dernière syllabe du mot : un espace final.
  return syllables.map((s, idx) => (idx === syllables.length - 1 ? `${s} ` : s));
}

export function splitTextIntoLetraSyllables(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const result: string[] = [];
  for (const w of words) {
    result.push(...syllabifySingleWord(w));
  }
  return result;
}

export function mapSyllablesToSteps(steps: VocalStepData[], syllables: string[]): VocalStepData[] {
  let syllIdx = 0;
  return steps.map((st) => {
    if (!st.active || st.note === '───') {
      return { ...st, syllable: '' };
    }
    const syll = syllables[syllIdx] ?? '';
    syllIdx++;
    return { ...st, syllable: syll };
  });
}

export function reconstructWordsFromSteps(steps: VocalStepData[]): string {
  return steps
    .filter((st) => st.active && st.note !== '───' && st.syllable)
    .map((st) => st.syllable)
    .join('');
}
