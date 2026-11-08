/**
 * syllableUnderlineFormatter.ts
 * Soulignement automatique de la 1re lettre de chaque syllabe (<u>L</u>) pour Organizador (< 120 lignes).
 */
import type { VocalPatternItem } from '../types/toadaProject.types';
import { splitTextIntoLetraSyllables } from './syllableSplitter';

export function underlineSingleSyllableFirstLetter(syl: string): string {
  const m = syl.match(/[\p{L}\p{M}]/u);
  if (!m || m.index === undefined) return syl;
  const idx = m.index;
  const ch = m[0];
  return `${syl.slice(0, idx)}<u>${ch}</u>${syl.slice(idx + ch.length)}`;
}

export function cleanLyricsForAlignment(rawText: string): string {
  return (rawText || '')
    .replace(/^\[sig:[^\]]+\]\s*/i, '')
    .replace(/^\[(sim|nosim)\]\s*/i, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[\*_𝄽]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function extractActiveSyllablesFromPattern(pattern: VocalPatternItem): string[] {
  const allSteps = [...(pattern.anacrusisSteps || []), ...(pattern.mainSteps || [])];
  const stepSyls = allSteps
    .filter((s) => s.active && !s.isTie && s.note !== '───' && s.syllable && s.syllable.trim() && s.syllable.trim() !== '───')
    .map((s) => s.syllable!.trim().replace(/-+$/, '').trim())
    .filter(Boolean);

  if (stepSyls.length > 0) return stepSyls;
  const fallbackText = cleanLyricsForAlignment(pattern.assignedLyricsText || pattern.rawLineCode || '');
  return splitTextIntoLetraSyllables(fallbackText)
    .map((s) => s.trim().replace(/-+$/, '').trim())
    .filter((s) => s && s !== '-');
}

function normalizeLetterChar(ch: string): string {
  return ch.toLowerCase();
}

export function formatWordsWithUnderlinedSyllables(
  wordsText: string,
  syllables: string[],
  isPuxador: boolean,
  isTutti = false
): string {
  const cleanWords = cleanLyricsForAlignment(wordsText);
  if (!cleanWords) return '';

  const expandedSyls: string[] = [];
  for (const rawSyl of syllables) {
    const s = (rawSyl || '').trim().replace(/-+$/, '').trim();
    if (!s || s === '───' || s === '_') continue;
    expandedSyls.push(s);
  }

  if (expandedSyls.length === 0) {
    if (isTutti) return `<em><strong>${cleanWords}</strong></em>`;
    return isPuxador ? `<strong>${cleanWords}</strong>` : cleanWords;
  }

  let out = '';
  let cursor = 0;

  for (const syl of expandedSyls) {
    const sylLetters = Array.from(syl).filter((c) => /[\p{L}\p{N}]/u.test(c));
    if (sylLetters.length === 0) continue;

    while (cursor < cleanWords.length && !/[\p{L}\p{N}]/u.test(cleanWords[cursor])) {
      out += cleanWords[cursor++];
    }
    if (cursor >= cleanWords.length) break;

    let matchedFirstLetter = false;
    for (let k = 0; k < sylLetters.length && cursor < cleanWords.length; k++) {
      while (cursor < cleanWords.length && !/[\p{L}\p{N}]/u.test(cleanWords[cursor])) {
        if (cleanWords[cursor] === "'" || cleanWords[cursor] === '’' || cleanWords[cursor] === '-') {
          out += cleanWords[cursor++];
        } else if (k > 0 && cleanWords[cursor] === ' ' && syl.includes("'")) {
          while (cursor < cleanWords.length && cleanWords[cursor] === ' ') cursor++;
          out += "'";
        } else {
          break;
        }
      }
      if (cursor >= cleanWords.length) break;
      const ch = cleanWords[cursor];
      if (!matchedFirstLetter) {
        out += `<u>${ch}</u>`;
        matchedFirstLetter = true;
      } else {
        out += ch;
      }
      cursor++;
      if (normalizeLetterChar(ch) !== normalizeLetterChar(sylLetters[k])) {
        // Tolérance si une voyelle accentuée diffère légèrement
      }
    }
  }

  while (cursor < cleanWords.length) {
    out += cleanWords[cursor++];
  }

  if (isTutti) return `<em><strong>${out}</strong></em>`;
  return isPuxador ? `<strong>${out}</strong>` : out;
}

