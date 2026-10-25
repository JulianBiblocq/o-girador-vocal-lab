/**
 * timeAnchorParser.ts
 * Parsing des ancres de temps [1]..[12], silences (_) et format .txt sur 2 lignes (< 120 lignes).
 */
import type { TimeAnchor } from '../types/toadaDocument.types';
import { splitTextIntoLetraSyllables } from './syllableSplitter';

export const TIME_ANCHOR_REGEX = /\[([1-9]|1[0-2])\]/g;

export function isAnchorOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (!/^[\d\s_]+$/.test(line)) return false;
  return /\b([1-9]|1[0-2])\b/.test(line);
}

export function convertTwoLineNotationToBrackets(anchorLine: string, lyricsLine: string): string {
  const anchorRegex = /\b([1-9]|1[0-2])\b/g;
  const matches: Array<{ beat: number; col: number }> = [];
  let m: RegExpExecArray | null;

  while ((m = anchorRegex.exec(anchorLine)) !== null) {
    matches.push({ beat: parseInt(m[1], 10), col: m.index });
  }

  if (matches.length === 0) return lyricsLine;
  matches.sort((a, b) => a.col - b.col);

  let result = '';
  if (matches[0].col > 0) {
    const prefix = lyricsLine.slice(0, matches[0].col);
    if (prefix.trim()) result += prefix;
  }

  for (let k = 0; k < matches.length; k++) {
    const cur = matches[k];
    const nextCol = matches[k + 1] ? matches[k + 1].col : lyricsLine.length;
    const slice = lyricsLine.slice(cur.col, nextCol);

    if (!slice.trim()) {
      result += `[${cur.beat}] _ `;
    } else {
      const trimmedStart = slice.trimStart();
      result += `[${cur.beat}]${trimmedStart}`;
    }
  }

  return result.trim().replace(/\s{2,}/g, ' ');
}

export function preprocessTwoLineLyrics(text: string): string {
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  const resultLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const nextLine = lines[i + 1];
    if (isAnchorOnlyLine(line) && nextLine !== undefined && !isAnchorOnlyLine(nextLine) && nextLine.trim().length > 0) {
      resultLines.push(convertTwoLineNotationToBrackets(line, nextLine));
      i += 2;
    } else {
      resultLines.push(line);
      i++;
    }
  }
  return resultLines.join('\n');
}

export interface ExtractedAnchorsResult {
  cleanText: string;
  timeAnchors: TimeAnchor[];
  measuresCount?: 1 | 2 | 3 | 4;
  hasAnacrusis?: boolean;
  exitBeat?: number;
}

export function extractTimeAnchors(rawText: string): ExtractedAnchorsResult {
  const matches: Array<{ beat: number; index: number; fullLength: number }> = [];
  let m: RegExpExecArray | null;
  const regex = /\[([1-9]|1[0-2])\]/g;
  while ((m = regex.exec(rawText)) !== null) {
    matches.push({ beat: parseInt(m[1], 10), index: m.index, fullLength: m[0].length });
  }
  if (matches.length === 0) return { cleanText: rawText, timeAnchors: [] };

  const firstOneIdx = matches.findIndex((m) => m.beat === 1);
  const textBefore = rawText.slice(0, matches[0].index).replace(/\[([1-9]|1[0-2])\]/g, '').replace(/[\*_]/g, '').trim();
  const hasAnacrusis = firstOneIdx > 0 || (firstOneIdx === 0 && textBefore.length > 0) || (firstOneIdx === -1 && (matches.length > 0 || textBefore.length > 0));

  const timeAnchors: TimeAnchor[] = [];
  let measureOffset = 0;

  for (let k = 0; k < matches.length; k++) {
    const cur = matches[k];
    if (hasAnacrusis) {
      if (firstOneIdx >= 0 && k === firstOneIdx) measureOffset = 1;
      else if (firstOneIdx >= 0 && k > firstOneIdx && (cur.beat === 1 || cur.beat <= matches[k - 1].beat)) measureOffset++;
      else if (firstOneIdx === -1 && k > 0 && cur.beat <= matches[k - 1].beat) measureOffset++;
    } else if (k > 0 && (cur.beat === 1 || cur.beat <= matches[k - 1].beat)) {
      measureOffset++;
    }

    const nextIndex = matches[k + 1] ? matches[k + 1].index : rawText.length;
    const chunk = rawText.slice(cur.index + cur.fullLength, nextIndex), trimmedChunk = chunk.trim();
    const isRest = trimmedChunk === '' || trimmedChunk === '_' || trimmedChunk.startsWith('_');
    const textSlice = isRest ? '' : chunk.replace(/_/g, ' ').replace(/\s{2,}/g, ' ').trim();

    timeAnchors.push({
      beat: cur.beat, measureOffset, isRest, charOffset: cur.index, textSlice,
      syllables: textSlice ? splitTextIntoLetraSyllables(textSlice) : []
    });
  }

  const cleanText = rawText.replace(/\[([1-9]|1[0-2])\]/g, '').replace(/_/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const count1 = matches.filter((m) => m.beat === 1).length;
  const rawMeasuresCount = Math.min(4, Math.max(1, count1 > 0 ? count1 : (hasAnacrusis ? (measureOffset || 1) : measureOffset + 1))) as 1 | 2 | 3 | 4;
  const lastAnchor = timeAnchors[timeAnchors.length - 1];

  return { cleanText, timeAnchors, measuresCount: rawMeasuresCount, hasAnacrusis, exitBeat: lastAnchor?.beat };
}

export function buildNormalizedPatternKey(role: string, text: string, timeAnchors?: TimeAnchor[]): string {
  const norm = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!timeAnchors?.length) return `${role}:${norm}`;
  const firstSung = timeAnchors.findIndex((a) => !a.isRest);
  const sung = firstSung >= 0 ? timeAnchors.slice(firstSung) : timeAnchors;
  return `${role}:${norm}:${sung.map((a) => `${a.beat}${a.isRest ? 'R' : ''}`).join('-')}`;
}
