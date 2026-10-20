/**
 * sheetDirectiveHelper.ts
 * Extraction des directives de mesure (+ anacrouse, / liaison, (1m), [Section]...)
 * et nettoyage du texte chanté pour préserver les paroles (< 80 lignes).
 */

import { extractChordsFromTextLine } from './chordParser';

export interface LineDirectives {
  cleanText: string;
  measuresCount?: 1 | 2 | 3 | 4;
  hasAnacrusis?: boolean;
  isLinkedMeasure?: boolean;
  sectionName?: string;
  chords?: string[];
}

export const SECTION_HEADER_REGEX = /^\s*\[(?!(?:[A-G][b#]?(?:m|maj|min|dim|aug|sus|[0-9]|b5|#5|\/[A-G][b#]?)*)\])([^\]]+)\]\s*$/i;

export function extractInlineLineDirectives(rawText: string): LineDirectives {
  if (!rawText) return { cleanText: '' };

  let text = rawText.trim();
  let hasAnacrusis: boolean | undefined;
  let isLinkedMeasure: boolean | undefined;
  let measuresCount: 1 | 2 | 3 | 4 | undefined;

  // 1. Détection de balise de section [Section]
  const secMatch = text.match(SECTION_HEADER_REGEX);
  if (secMatch) {
    return { cleanText: '', sectionName: secMatch[1].trim() };
  }

  // 2. Détection préfixe Anacrouse (+) ou Mesure liée (/)
  if (text.startsWith('+')) {
    hasAnacrusis = true;
    text = text.replace(/^\+\s*/, '');
  } else if (text.startsWith('/')) {
    isLinkedMeasure = true;
    text = text.replace(/^\/\s*/, '');
  }

  // 3. Détection des mesures inline : (1m), (2m), (3m), (4m)
  const mMatch = text.match(/\(\s*([1-4])\s*m\s*\)/i);
  if (mMatch) {
    measuresCount = parseInt(mMatch[1], 10) as 1 | 2 | 3 | 4;
  }

  // 4. Détection anacrouse inline : (avec ana) / (sans ana)
  if (/\(\s*(?:sans\s*ana(?:crouse)?|no-?ana(?:crusis)?)\s*\)/i.test(text)) {
    hasAnacrusis = false;
  } else if (/\(\s*(?:avec\s*ana(?:crouse)?|ana(?:crouse|crusis)?)\s*\)/i.test(text)) {
    hasAnacrusis = true;
  }

  // 5. Extraction des accords [Dm7], [G7]...
  const extractedChords = extractChordsFromTextLine(text).map((c) => c.chord);
  const chords = extractedChords.length > 0 ? extractedChords : undefined;

  // Nettoyage des parenthèses de directives et des accords [Dm7]
  const cleanText = text
    .replace(/\(\s*[1-4]\s*m\s*\)/gi, '')
    .replace(/\(\s*(?:sans\s*ana(?:crouse)?|no-?ana(?:crusis)?|avec\s*ana(?:crouse)?|ana(?:crouse|crusis)?)\s*\)/gi, '')
    .replace(/\[(?:[A-G][b#]?(?:m|maj|min|dim|aug|sus|[0-9]|b5|#5|\/[A-G][b#]?)*)\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { cleanText, measuresCount, hasAnacrusis, isLinkedMeasure, chords };
}
