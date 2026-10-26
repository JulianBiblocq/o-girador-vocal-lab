/**
 * sheetDirectiveHelper.ts
 * Extraction des directives de mesure (+ anacrouse, / liaison, (1m), [Section]...)
 * et nettoyage du texte chanté pour préserver les paroles (< 80 lignes).
 */

import { extractChordsFromTextLine } from './chordParser';
import type { TimeAnchor } from '../types/toadaDocument.types';
import { extractTimeAnchors } from './timeAnchorParser';

export interface LineDirectives {
  cleanText: string;
  measuresCount?: 1 | 2 | 3 | 4;
  hasAnacrusis?: boolean;
  anacrusisBeats?: number;
  isLinkedMeasure?: boolean;
  sectionName?: string;
  sectionBpm?: number;
  chords?: string[];
  timeAnchors?: TimeAnchor[];
  exitBeat?: number;
}

export const SECTION_HEADER_REGEX = /^\s*\[(?!(?:[A-G][b#]?(?:m|maj|min|dim|aug|sus|[0-9]|b5|#5|\/[A-G][b#]?)*)\])([^\]]+)\]\s*$/i;

export function extractInlineLineDirectives(rawText: string): LineDirectives {
  if (!rawText) return { cleanText: '' };

  let text = rawText.trim();
  let hasAnacrusis: boolean | undefined;
  let isLinkedMeasure: boolean | undefined;
  let measuresCount: 1 | 2 | 3 | 4 | undefined;

  // 1. Détection de balise de section [Section] (ignorer [1]..[12])
  const secMatch = text.match(SECTION_HEADER_REGEX);
  if (secMatch && !/^(?:[1-9]|1[0-2])$/.test(secMatch[1].trim())) {
    const rawSec = secMatch[1].trim();
    const bpmMatch = rawSec.match(/(?:@|-|\()\s*(\d{2,3})\s*(?:bpm)?/i);
    const sectionBpm = bpmMatch ? parseInt(bpmMatch[1], 10) : undefined;
    return { cleanText: '', sectionName: rawSec, sectionBpm };
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

  // 6. Extraction des ancres de temps [1]..[12] et silences (_)
  const anchorRes = extractTimeAnchors(text);
  let timeAnchors: TimeAnchor[] | undefined;
  let exitBeat: number | undefined;
  let anacrusisBeats: number | undefined;
  if (anchorRes.timeAnchors.length > 0) {
    timeAnchors = anchorRes.timeAnchors;
    if (measuresCount === undefined) measuresCount = anchorRes.measuresCount;
    if (hasAnacrusis === undefined) hasAnacrusis = anchorRes.hasAnacrusis;
    anacrusisBeats = anchorRes.anacrusisBeats;
    exitBeat = anchorRes.exitBeat;
  }

  // Nettoyage des parenthèses de directives, des accords [Dm7], des ancres et des silences
  const cleanText = anchorRes.cleanText
    .replace(/\(\s*[1-4]\s*m\s*\)/gi, '')
    .replace(/\(\s*(?:sans\s*ana(?:crouse)?|no-?ana(?:crusis)?|avec\s*ana(?:crouse)?|ana(?:crouse|crusis)?)\s*\)/gi, '')
    .replace(/\[(?:[A-G][b#]?(?:m|maj|min|dim|aug|sus|[0-9]|b5|#5|\/[A-G][b#]?)*)\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { cleanText, measuresCount, hasAnacrusis, anacrusisBeats, isLinkedMeasure, chords, timeAnchors, exitBeat };
}
