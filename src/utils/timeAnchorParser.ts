/**
 * timeAnchorParser.ts
 * Parsing des ancres de temps ([1]..[12], [M•1]), silences initiaux (𝄽) et tenues de note (< 145 lignes).
 */
import type { TimeAnchor } from '../types/toadaDocument.types';
import { splitTextIntoLetraSyllables } from './syllableSplitter';
export const TIME_ANCHOR_REGEX = /\[(?:M(\d+)[•\.:])?([1-9]|1[0-2])\]/gi;

export function isAnchorOnlyLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || !/^[\d\s_M•\.:\[\]]+$/.test(line)) return false;
  return /\b([1-9]|1[0-2])\b/.test(line);
}

export function convertTwoLineNotationToBrackets(anchorLine: string, lyricsLine: string): string {
  const regex = /\b([1-9]|1[0-2])\b/g;
  const matches: Array<{ beat: number; col: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(anchorLine)) !== null) matches.push({ beat: parseInt(m[1], 10), col: m.index });
  if (matches.length === 0) return lyricsLine;
  matches.sort((a, b) => a.col - b.col);

  let result = '';
  if (matches[0].col > 0) {
    const prefix = lyricsLine.slice(0, matches[0].col);
    if (prefix.trim()) result += prefix;
  }
  for (let k = 0; k < matches.length; k++) {
    const cur = matches[k], nextCol = matches[k + 1] ? matches[k + 1].col : lyricsLine.length;
    const slice = lyricsLine.slice(cur.col, nextCol);
    result += !slice.trim() ? `[${cur.beat}] _ ` : `[${cur.beat}]${slice.trimStart()}`;
  }
  return result.trim().replace(/\s{2,}/g, ' ');
}

export function preprocessTwoLineLyrics(text: string): string {
  if (!text) return '';
  const lines = text.split(/\r?\n/), resultLines: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i], next = lines[i + 1];
    if (isAnchorOnlyLine(line) && next !== undefined && !isAnchorOnlyLine(next) && next.trim().length > 0) {
      resultLines.push(convertTwoLineNotationToBrackets(line, next));
      i += 2;
    } else {
      resultLines.push(line);
      i++;
    }
  }
  return resultLines.join('\n');
}

export interface ExtractedAnchorsResult {
  cleanText: string; timeAnchors: TimeAnchor[]; measuresCount?: 1 | 2 | 3 | 4;
  hasAnacrusis?: boolean; anacrusisBeats?: number; anacrusisStartBeat?: number; exitBeat?: number;
}

export function extractTimeAnchors(rawText: string, beatsPerMeasure = 4, forceThetic = false): ExtractedAnchorsResult {
  const matches: Array<{ beat: number; absMeasure?: number; index: number; fullLength: number }> = [];
  let m: RegExpExecArray | null;
  const regex = /\[(?:M(\d+)[•\.:])?([1-9]|1[0-2])\]/gi;
  while ((m = regex.exec(rawText)) !== null) {
    matches.push({ absMeasure: m[1] ? parseInt(m[1], 10) : undefined, beat: parseInt(m[2], 10), index: m.index, fullLength: m[0].length });
  }
  if (matches.length === 0) return { cleanText: rawText, timeAnchors: [] };

  const isExplicitM1 = matches[0].absMeasure === 1 || forceThetic;
  const firstOneIdx = matches.findIndex((x) => x.beat === 1);
  let hasAnacrusis = false, anacrusisStartBeat: number | undefined, anacrusisBeats: number | undefined;
  if (!isExplicitM1) {
    if (firstOneIdx > 0) {
      const sBeat = matches[0].beat; hasAnacrusis = true; anacrusisStartBeat = sBeat; anacrusisBeats = Math.max(1, beatsPerMeasure + 1 - sBeat);
    } else if (firstOneIdx === 0) {
      const textBefore = rawText.slice(0, matches[0].index).replace(/\[[^\]]+\]/g, '').replace(/[\*_]/g, '').trim();
      if (textBefore.length > 0) { hasAnacrusis = true; anacrusisStartBeat = beatsPerMeasure; anacrusisBeats = 1; }
    } else if (firstOneIdx === -1 && matches.length > 0 && matches[0].beat > 1) {
      const sBeat = matches[0].beat; hasAnacrusis = true; anacrusisStartBeat = sBeat; anacrusisBeats = Math.max(1, beatsPerMeasure + 1 - sBeat);
    }
  }

  const timeAnchors: TimeAnchor[] = [];
  let measureOffset = 0, hasEncounteredSyllables = false;

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
    const chunk = rawText.slice(cur.index + cur.fullLength, nextIndex);
    const isExplicitSilence = /\[(?:silence|pause)\]|𝄽/i.test(chunk);
    const cleanChunkWords = chunk.replace(/\[[^\]]+\]/g, '').replace(/[𝄽\*_]/g, ' ').trim();
    const isRestSymbol = isExplicitSilence || cleanChunkWords.length === 0;
    const textSlice = isRestSymbol ? '' : chunk.replace(/\[[^\]]+\]/g, '').replace(/[𝄽\*_]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    const syllables = textSlice ? splitTextIntoLetraSyllables(textSlice) : [];

    if (syllables.length > 0) hasEncounteredSyllables = true;
    const isInitialRest = isExplicitSilence || (isRestSymbol && !hasEncounteredSyllables);
    const isSustainedHold = !isExplicitSilence && isRestSymbol && hasEncounteredSyllables;

    timeAnchors.push({ beat: cur.beat, measureOffset, isRest: isInitialRest, isInitialRest, isSustainedHold, charOffset: cur.index, textSlice, syllables });
  }

  if (!hasAnacrusis) {
    const firstSung = timeAnchors.find((a) => !a.isInitialRest && !a.isRest && (a.syllables?.length || a.textSlice));
    if (firstSung && firstSung.measureOffset === 0 && firstSung.beat > 1) {
      for (let b = firstSung.beat - 1; b >= 1; b--) {
        if (!timeAnchors.some((a) => a.measureOffset === 0 && a.beat === b)) {
          timeAnchors.unshift({ beat: b, measureOffset: 0, isRest: true, isInitialRest: true, isSustainedHold: false, textSlice: '', syllables: [] });
        }
      }
      timeAnchors.sort((a, b) => (a.measureOffset - b.measureOffset) || (a.beat - b.beat));
    }
  }
  const cleanText = rawText.replace(/\[(?:M\d+[•\.:])?([1-9]|1[0-2])\]/gi, '').replace(/\[(?:silence|pause)\]|𝄽/gi, ' ').replace(/_/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const lastA = timeAnchors[timeAnchors.length - 1], prevA = timeAnchors[timeAnchors.length - 2], rawCount1 = timeAnchors.filter((x) => x.beat === 1 && (!hasAnacrusis || x.measureOffset > 0)).length;
  const count1 = (rawCount1 >= 2 && lastA?.beat === 1 && prevA && prevA.beat > 1 && (lastA.syllables?.length ?? 0) <= 1) ? rawCount1 - 1 : rawCount1;
  const rawMeasuresCount = Math.min(4, Math.max(1, count1 > 0 ? count1 : (hasAnacrusis ? (measureOffset || 1) : measureOffset + 1))) as 1 | 2 | 3 | 4;
  return { cleanText, timeAnchors, measuresCount: rawMeasuresCount, hasAnacrusis, anacrusisBeats, anacrusisStartBeat, exitBeat: timeAnchors[timeAnchors.length - 1]?.beat };
}

export function buildBeatLyricsMap(timeAnchors: TimeAnchor[], hasAnacrusis = false): Record<string, { isInitialRest: boolean; isSustainedHold: boolean; syllables: string[] }> {
  const map: Record<string, { isInitialRest: boolean; isSustainedHold: boolean; syllables: string[] }> = {};
  for (const a of timeAnchors) map[`${a.measureOffset}_${a.beat}`] = { isInitialRest: !!a.isInitialRest, isSustainedHold: !!a.isSustainedHold, syllables: a.syllables || [] };
  const firstSung = !hasAnacrusis ? timeAnchors.find((a) => !a.isInitialRest && !a.isRest && (a.syllables?.length || a.textSlice)) : undefined;
  if (firstSung && firstSung.measureOffset === 0 && firstSung.beat > 1) {
    for (let b = 1; b < firstSung.beat; b++) if (!map[`0_${b}`]) map[`0_${b}`] = { isInitialRest: true, isSustainedHold: false, syllables: [] };
  }
  return map;
}

export function buildNormalizedPatternKey(role: string, text: string, timeAnchors?: TimeAnchor[]): string {
  const norm = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!timeAnchors?.length) return `${role}:${norm}`;
  const firstSung = timeAnchors.findIndex((a) => !a.isRest && !a.isInitialRest);
  const sung = firstSung >= 0 ? timeAnchors.slice(firstSung) : timeAnchors;
  return `${role}:${norm}:${sung.map((a) => `${a.beat}${a.isRest ? 'R' : ''}`).join('-')}`;
}
