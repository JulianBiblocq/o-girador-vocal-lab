/**
 * timeAnchorParser.ts — Parsing des ancres de temps ([1]..[12], [M•1]), silences initiaux (𝄽) et tenues de note (< 148 lignes).
 */
import type { TimeAnchor } from '../types/toadaDocument.types';
import { splitTextIntoLetraSyllables } from './syllableSplitter';
import { isIntraWordBadgeBoundary, computeBeatSyllableSubdivs } from './subbeatAnchorHelper';
export const TIME_ANCHOR_REGEX = /\[(?:M(\d+)[•·\.:])?([1-9]|1[0-2])\]/gi;

export function isAnchorOnlyLine(line: string): boolean {
  return Boolean(line.trim() && /^[\d\s_M•·\.:\[\]]+$/.test(line) && /\b([1-9]|1[0-2])\b/.test(line));
}
export function convertTwoLineNotationToBrackets(anchorLine: string, lyricsLine: string): string {
  const regex = /\b([1-9]|1[0-2])\b/g, matches: Array<{ beat: number; col: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(anchorLine)) !== null) matches.push({ beat: parseInt(m[1], 10), col: m.index });
  if (matches.length === 0) return lyricsLine;
  matches.sort((a, b) => a.col - b.col);
  let result = matches[0].col > 0 && lyricsLine.slice(0, matches[0].col).trim() ? lyricsLine.slice(0, matches[0].col) : '';
  for (let k = 0; k < matches.length; k++) {
    const cur = matches[k], nextCol = matches[k + 1] ? matches[k + 1].col : lyricsLine.length, slice = lyricsLine.slice(cur.col, nextCol);
    result += !slice.trim() ? `[${cur.beat}] _ ` : `[${cur.beat}]${/^\s+\S/.test(slice) ? '_ ' : ''}${slice.trimStart()}`;
  }
  return result.trim().replace(/\s{2,}/g, ' ');
}
export function preprocessTwoLineLyrics(text: string): string {
  if (!text) return '';
  const lines = text.split(/\r?\n/), resultLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], next = lines[i + 1];
    if (isAnchorOnlyLine(line) && next !== undefined && !isAnchorOnlyLine(next) && next.trim().length > 0) { resultLines.push(convertTwoLineNotationToBrackets(line, next)); i++; }
    else resultLines.push(line);
  }
  return resultLines.join('\n');
}
export function computeMeasuresCountFromAnchors(timeAnchors: TimeAnchor[] | undefined, hasAnacrusis = false, fallbackMeasures: 1 | 2 | 3 | 4 = 1): 1 | 2 | 3 | 4 {
  if (!timeAnchors || timeAnchors.length === 0) return fallbackMeasures;
  const lastA = timeAnchors[timeAnchors.length - 1], prevA = timeAnchors[timeAnchors.length - 2];
  const rawCount1 = timeAnchors.filter((x) => x.beat === 1 && (!hasAnacrusis || x.measureOffset > 0)).length;
  if (rawCount1 === 0) return fallbackMeasures;
  const isTailExitBeat1 = Boolean(rawCount1 >= 2 && lastA?.beat === 1 && prevA && prevA.beat > 1 && !lastA.isSustainedHold);
  return Math.min(4, Math.max(1, isTailExitBeat1 ? rawCount1 - 1 : rawCount1)) as 1 | 2 | 3 | 4;
}

export interface ExtractedAnchorsResult {
  cleanText: string; timeAnchors: TimeAnchor[]; measuresCount?: 1 | 2 | 3 | 4;
  hasAnacrusis?: boolean; anacrusisBeats?: number; anacrusisStartBeat?: number; exitBeat?: number;
}
export function extractTimeAnchors(rawText: string, beatsPerMeasure = 4, forceThetic = false): ExtractedAnchorsResult {
  const matches: Array<{ beat: number; absMeasure?: number; index: number; fullLength: number }> = [], regex = /\[(?:M(\d+)[•·\.:])?([1-9]|1[0-2])\]/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(rawText)) !== null) matches.push({ absMeasure: m[1] ? parseInt(m[1], 10) : undefined, beat: parseInt(m[2], 10), index: m.index, fullLength: m[0].length });
  if (matches.length === 0) return { cleanText: rawText, timeAnchors: [] };
  const isExplicitM1 = matches[0].absMeasure === 1 || forceThetic, firstOneIdx = matches.findIndex((x) => x.beat === 1);
  let hasAnacrusis = false, anacrusisStartBeat: number | undefined, anacrusisBeats: number | undefined;
  const textBeforeFirst = rawText.slice(0, matches[0].index).replace(/\[[^\]]+\]/g, '').replace(/[𝄽\*_]/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!isExplicitM1) {
    if (firstOneIdx > 0 || (firstOneIdx === -1 && matches[0].beat > 1)) {
      const sBeat = matches[0].beat; hasAnacrusis = true; anacrusisStartBeat = sBeat; anacrusisBeats = Math.max(1, beatsPerMeasure + 1 - sBeat);
    } else if (firstOneIdx === 0 && textBeforeFirst.length > 0) { hasAnacrusis = true; anacrusisStartBeat = beatsPerMeasure; anacrusisBeats = 1; }
  }
  const timeAnchors: TimeAnchor[] = [];
  let measureOffset = 0, hasEncounteredSyllables = false;
  if (hasAnacrusis && firstOneIdx === 0 && textBeforeFirst.length > 0) {
    const preSyls = splitTextIntoLetraSyllables(textBeforeFirst); hasEncounteredSyllables = preSyls.length > 0;
    timeAnchors.push({ beat: beatsPerMeasure, measureOffset: 0, isRest: false, isInitialRest: false, isSustainedHold: false, hasLeadingRest: false, charOffset: 0, textSlice: textBeforeFirst, syllables: preSyls });
  }
  for (let k = 0; k < matches.length; k++) {
    const cur = matches[k], nextIndex = matches[k + 1] ? matches[k + 1].index : rawText.length, chunk = rawText.slice(cur.index + cur.fullLength, nextIndex);
    const isExplicitSilence = /\[(?:silence|pause)\]|𝄽/i.test(chunk), trimmedChunk = chunk.replace(/\[[^\]]+\]/g, '').replace(/\*/g, '').trim();
    const isRestSymbol = isExplicitSilence || /^[\s_𝄽]*$/.test(trimmedChunk), prevAnchor = timeAnchors[timeAnchors.length - 1];
    const isSameBeatAfterRest = k > 0 && cur.beat === matches[k - 1].beat && !isRestSymbol && prevAnchor && (prevAnchor.syllables?.length ?? 0) === 0;
    if (!isSameBeatAfterRest) {
      if (hasAnacrusis) {
        if (firstOneIdx >= 0 && k === firstOneIdx) measureOffset = 1;
        else if ((firstOneIdx >= 0 && k > firstOneIdx && (cur.beat === 1 || cur.beat <= matches[k - 1].beat)) || (firstOneIdx === -1 && k > 0 && cur.beat <= matches[k - 1].beat)) measureOffset++;
      } else if (k > 0 && (cur.beat === 1 || cur.beat <= matches[k - 1].beat)) measureOffset++;
    }
    const hasLeadingRest = (!isRestSymbol && /^[_𝄽]\s*/.test(trimmedChunk)) || Boolean(isSameBeatAfterRest);
    const isGluedToSyl = /^[\p{L}\p{M}]/u.test(chunk.replace(/\*/g, '').replace(/<\/?u\b[^>]*>/gi, ''));
    const isDownbeatLocked = !hasLeadingRest && !isRestSymbol && (isIntraWordBadgeBoundary(rawText, cur.index, cur.fullLength) || Boolean(prevAnchor?.hasLeadingRest) || isGluedToSyl);
    const hasTrailingPickup = k + 1 < matches.length && isIntraWordBadgeBoundary(rawText, matches[k + 1].index, matches[k + 1].fullLength);
    const rawSlice = isRestSymbol ? '' : trimmedChunk.replace(/[_𝄽]/g, ' ').replace(/\s+/g, ' ').trim();
    const syllables = rawSlice ? splitTextIntoLetraSyllables(rawSlice) : [];
    const textSlice = rawSlice.replace(/<\/?u\b[^>]*>/gi, '');
    const syllableSubdivs = computeBeatSyllableSubdivs(trimmedChunk, syllables, hasLeadingRest, hasTrailingPickup);
    if (syllables.length > 0) hasEncounteredSyllables = true;
    const isInitialRest = isExplicitSilence || (isRestSymbol && !hasEncounteredSyllables), isSustainedHold = !isExplicitSilence && isRestSymbol && hasEncounteredSyllables;
    if (isSameBeatAfterRest) timeAnchors.pop();
    timeAnchors.push({ beat: cur.beat, measureOffset, isRest: isInitialRest, isInitialRest, isSustainedHold, hasLeadingRest, isDownbeatLocked, hasTrailingPickup, syllableSubdivs, charOffset: cur.index, textSlice, syllables });
  }

  if (!hasAnacrusis) {
    const firstSung = timeAnchors.find((a) => !a.isInitialRest && !a.isRest && (a.syllables?.length || a.textSlice));
    if (firstSung && firstSung.measureOffset === 0 && firstSung.beat > 1) {
      for (let b = firstSung.beat - 1; b >= 1; b--) if (!timeAnchors.some((a) => a.measureOffset === 0 && a.beat === b)) timeAnchors.unshift({ beat: b, measureOffset: 0, isRest: true, isInitialRest: true, isSustainedHold: false, textSlice: '', syllables: [] });
      timeAnchors.sort((a, b) => (a.measureOffset - b.measureOffset) || (a.beat - b.beat));
    }
  }
  const cleanText = rawText.replace(/\[(?:M\d+[•·\.:])?([1-9]|1[0-2])\]/gi, '').replace(/<\/?u\b[^>]*>/gi, '').replace(/\[(?:silence|pause)\]|𝄽/gi, ' ').replace(/_/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const lastA = timeAnchors[timeAnchors.length - 1], prevA = timeAnchors[timeAnchors.length - 2], rawCount1 = timeAnchors.filter((x) => x.beat === 1 && (!hasAnacrusis || x.measureOffset > 0)).length;
  const lastChunk = rawText.slice(matches[matches.length - 1].index + matches[matches.length - 1].fullLength);
  const isTailExit1 = Boolean(rawCount1 >= 2 && lastA?.beat === 1 && prevA && prevA.beat > 1 && !lastA.isSustainedHold && !/_\s+_/.test(lastChunk));
  const count1 = isTailExit1 ? rawCount1 - 1 : rawCount1;
  const rawMeasuresCount = Math.min(4, Math.max(1, count1 > 0 ? count1 : (hasAnacrusis ? (measureOffset || 1) : measureOffset + 1))) as 1 | 2 | 3 | 4;
  return { cleanText, timeAnchors, measuresCount: rawMeasuresCount, hasAnacrusis, anacrusisBeats, anacrusisStartBeat, exitBeat: isTailExit1 ? 1 : timeAnchors[timeAnchors.length - 1]?.beat };
}

export function buildBeatLyricsMap(timeAnchors: TimeAnchor[], _hasAnacrusis = false): Record<string, TimeAnchor> {
  const map: Record<string, TimeAnchor> = {};
  for (const a of timeAnchors) map[`${a.measureOffset}_${a.beat}`] = { ...a, syllables: a.syllables || [] };
  const firstSung = timeAnchors.find((a) => !a.isInitialRest && !a.isRest && (a.syllables?.length || a.textSlice));
  if (firstSung && firstSung.measureOffset === 0 && firstSung.beat > 1) {
    for (let b = 1; b < firstSung.beat; b++) if (!map[`0_${b}`]) map[`0_${b}`] = { beat: b, measureOffset: 0, isRest: true, isInitialRest: true, isSustainedHold: false, hasLeadingRest: false, syllables: [] };
  }
  return map;
}
export function resolveFreshTimeAnchors(rawLineCode?: string, existing?: TimeAnchor[], beatsPerMeasure = 4, forceThetic = false, fallbackText?: string, rawTxtCode?: string): TimeAnchor[] | undefined {
  const normLetters = (s: string) => s.replace(/\[[^\]]+\]/g, '').replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  let candidate = rawLineCode && /\[(?:M\d+[•·\.:])?([1-9]|1[0-2])\]/i.test(rawLineCode) ? rawLineCode : undefined;
  if (!candidate && rawTxtCode && (fallbackText || rawLineCode)) {
    const target = normLetters(fallbackText || rawLineCode || ''), pre = preprocessTwoLineLyrics(rawTxtCode);
    if (target) candidate = pre.split(/\r?\n/).find((l) => /\[(?:M\d+[•·\.:])?([1-9]|1[0-2])\]/i.test(l) && normLetters(l) === target);
  }
  if (!candidate && fallbackText && /\[(?:M\d+[•·\.:])?([1-9]|1[0-2])\]/i.test(fallbackText)) candidate = fallbackText;
  if (candidate) {
    const parsed = extractTimeAnchors(candidate.replace(/^\s*(?:puxador|solo|coro|choeur|refrao|refrão)\s*[:\-]\s*/i, ''), beatsPerMeasure, forceThetic).timeAnchors;
    if (parsed.length > 0) return parsed;
  }
  const fb = fallbackText?.replace(/\[[^\]]+\]/g, '').replace(/[𝄽\*_]/g, ' ').replace(/\s+/g, ' ').trim();
  if (existing?.length && fb && normLetters(existing.map((a) => a.textSlice || (a.syllables || []).join('')).join('')) !== normLetters(fb)) {
    const rep = existing.map((a) => ({ ...a })); let cur = 0;
    for (let i = 0; i < rep.length; i++) {
      const t = (rep[i].textSlice || (rep[i].syllables || []).join('')).trim(), pos = t ? fb.toLowerCase().indexOf(t.toLowerCase(), cur) : -1;
      if (pos < 0) continue;
      const gap = fb.slice(cur, pos).trim();
      if (gap && i > 0 && !(rep[i - 1].syllables?.length)) rep[i - 1] = { ...rep[i - 1], isRest: false, isInitialRest: false, isSustainedHold: false, hasLeadingRest: true, textSlice: gap, syllables: splitTextIntoLetraSyllables(gap) };
      cur = pos + t.length;
    }
    return rep;
  }
  return existing;
}
export function buildNormalizedPatternKey(role: string, text: string, timeAnchors?: TimeAnchor[]): string {
  const norm = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!timeAnchors?.length) return `${role}:${norm}`;
  const firstSung = timeAnchors.findIndex((a) => !a.isRest && !a.isInitialRest), sung = firstSung >= 0 ? timeAnchors.slice(firstSung) : timeAnchors;
  return `${role}:${norm}:${sung.map((a) => `${a.beat}${a.isRest ? 'R' : ''}`).join('-')}`;
}
