/**
 * syllableUnderlineFormatter.ts
 * Soulignement automatique 1:1 de la 1re lettre de chaque syllabe (<u>L</u> <-> MAR- CA- ÇÃO) pour Organizador (< 120 lignes).
 */
import type { VocalPatternItem } from '../types/toadaProject.types';
import {
  splitTextIntoLetraSyllables,
  convertPaperHyphensToUnderlinedHtml,
  convertUnderlinedHtmlToPaperHyphens,
} from './syllableSplitter';

export { convertPaperHyphensToUnderlinedHtml, convertUnderlinedHtmlToPaperHyphens };

export function underlineSingleSyllableFirstLetter(syl: string): string {
  const m = syl.match(/[\p{L}\p{M}]/u);
  if (!m || m.index === undefined) return syl;
  return `${syl.slice(0, m.index)}<u>${m[0]}</u>${syl.slice(m.index + m[0].length)}`;
}

export function cleanLyricsForAlignment(rawText: string): string {
  return (rawText || '')
    .replace(/^\[sig:[^\]]+\]\s*/i, '')
    .replace(/^\[(sim|nosim)\]\s*/i, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/(?<![\p{L}\d])0(?![\p{L}\d])|───|[\*_𝄽]/gu, ' ')
    .replace(/(\p{L})-\s+(?=\p{L})/gu, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function extractActiveSyllablesFromPattern(pattern: VocalPatternItem): string[] {
  const allSteps = [...(pattern.anacrusisSteps || []), ...(pattern.mainSteps || [])];
  const stepSyls = allSteps
    .filter((s) => s.active && !s.isTie && !s.isMelisma && s.note !== '───' && s.syllable)
    .map((s) => s.syllable!.trim().replace(/-+$/, '').trim())
    .filter((s) => Boolean(s && s !== '───' && s !== '_' && s !== '0' && s !== '𝄽'));

  if (stepSyls.length > 0) return stepSyls;
  const rawWithUnderlines = (pattern.rawLineCode && /<u>/i.test(pattern.rawLineCode)) ? pattern.rawLineCode : (pattern.assignedLyricsText || pattern.rawLineCode || '');
  const fallbackText = /<u>/i.test(rawWithUnderlines)
    ? rawWithUnderlines.replace(/\[[^\]]+\]/g, '').replace(/(?<![\p{L}\d])0(?![\p{L}\d])|───|[\*_𝄽]/gu, ' ').replace(/\s{2,}/g, ' ').trim()
    : cleanLyricsForAlignment(rawWithUnderlines);
  return splitTextIntoLetraSyllables(fallbackText)
    .map((s) => s.trim().replace(/-+$/, '').trim())
    .filter((s) => Boolean(s && s !== '-' && s !== '_' && s !== '0' && s !== '𝄽'));
}

export function formatWordsWithUnderlinedSyllables(
  wordsText: string,
  syllables: string[],
  isPuxador: boolean,
  isTutti = false
): string {
  const cleanWords = cleanLyricsForAlignment(wordsText);
  if (!cleanWords) return '';

  const expandedSyls = syllables
    .map((rawSyl) => (rawSyl || '').trim().replace(/-+$/, '').trim())
    .filter((s) => Boolean(s && s !== '───' && s !== '_' && s !== '0' && s !== '𝄽'));

  if (expandedSyls.length === 0) {
    if (isTutti) return `<em><strong>${cleanWords}</strong></em>`;
    return isPuxador ? `<strong>${cleanWords}</strong>` : cleanWords;
  }

  let out = '', cursor = 0;
  for (const syl of expandedSyls) {
    const sylLetters = Array.from(syl).filter((c) => /[\p{L}\p{N}]/u.test(c));
    if (sylLetters.length === 0) continue;
    while (cursor < cleanWords.length && !/[\p{L}\p{N}]/u.test(cleanWords[cursor])) out += cleanWords[cursor++];
    if (cursor >= cleanWords.length) break;

    let matchedFirstLetter = false;
    for (let k = 0; k < sylLetters.length && cursor < cleanWords.length; k++) {
      while (cursor < cleanWords.length && !/[\p{L}\p{N}]/u.test(cleanWords[cursor])) {
        if (cleanWords[cursor] === "'" || cleanWords[cursor] === '’' || cleanWords[cursor] === '-') out += cleanWords[cursor++];
        else if (k > 0 && cleanWords[cursor] === ' ' && syl.includes("'")) {
          while (cursor < cleanWords.length && cleanWords[cursor] === ' ') cursor++;
          out += "'";
        } else break;
      }
      if (cursor >= cleanWords.length) break;
      const ch = cleanWords[cursor++];
      out += !matchedFirstLetter ? `<u>${ch}</u>` : ch;
      matchedFirstLetter = true;
    }
  }
  while (cursor < cleanWords.length) out += cleanWords[cursor++];
  if (isTutti) return `<em><strong>${out}</strong></em>`;
  return isPuxador ? `<strong>${out}</strong>` : out;
}
