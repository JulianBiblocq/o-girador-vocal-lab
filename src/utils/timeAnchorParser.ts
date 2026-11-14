/**
 * timeAnchorParser.ts — Parsing v2 des ancres ([1]..[12], [M•1]), silences explicites (0 / 𝄽) et tenues/mélismes (_) (< 120 lignes).
 */
import type { TimeAnchor } from '../types/toadaDocument.types';
import { splitTextIntoLetraSyllables } from './syllableSplitter';
import { isIntraWordBadgeBoundary, computeBeatSyllableSubdivs } from './subbeatAnchorHelper';
import { mergeSyllablesToImpulseCount } from './syllableImpulseMerger';
import { normalizeToadaTextV1ToV2 } from './vocalGrammarV2';
import {
  isAnchorOnlyLine, convertTwoLineNotationToBrackets, preprocessTwoLineLyrics, buildBeatLyricsMap, buildNormalizedPatternKey,
} from './timeAnchorTwoLineHelper';

export { isAnchorOnlyLine, convertTwoLineNotationToBrackets, preprocessTwoLineLyrics, buildBeatLyricsMap, buildNormalizedPatternKey };
export const TIME_ANCHOR_REGEX = /\[(?:M(\d+)[•·\.:])?([1-9]|1[0-2])\]/gi;
const REST_OR_HOLD_SUB_RE = /(?<![\p{L}\d])0(?![\p{L}\d])|[_𝄽]/gu;

export function computeMeasuresCountFromAnchors(timeAnchors: TimeAnchor[] | undefined, hasAnacrusis = false, fallbackMeasures: 1 | 2 | 3 | 4 = 1): 1 | 2 | 3 | 4 {
  if (!timeAnchors || timeAnchors.length === 0) return fallbackMeasures;
  const lastA = timeAnchors[timeAnchors.length - 1], prevA = timeAnchors[timeAnchors.length - 2], rawCount1 = timeAnchors.filter((x) => x.beat === 1 && (!hasAnacrusis || x.measureOffset > 0)).length;
  if (rawCount1 === 0) return fallbackMeasures;
  const isTailExitBeat1 = Boolean(rawCount1 >= 2 && lastA?.beat === 1 && prevA && prevA.beat > 1 && !(lastA.textSlice || '').trim().includes(' '));
  return Math.min(4, Math.max(1, isTailExitBeat1 ? rawCount1 - 1 : rawCount1)) as 1 | 2 | 3 | 4;
}

export interface ExtractedAnchorsResult {
  cleanText: string; timeAnchors: TimeAnchor[]; measuresCount?: 1 | 2 | 3 | 4;
  hasAnacrusis?: boolean; anacrusisBeats?: number; anacrusisStartBeat?: number; exitBeat?: number;
}

export function extractTimeAnchors(rawInput: string, beatsPerMeasure = 4, forceThetic = false, grammarVersion = 1): ExtractedAnchorsResult {
  const rawText = normalizeToadaTextV1ToV2(rawInput, { grammarVersion });
  const matches: Array<{ beat: number; absMeasure?: number; index: number; fullLength: number }> = [], regex = /\[(?:M(\d+)[•·\.:])?([1-9]|1[0-2])\]/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(rawText)) !== null) matches.push({ absMeasure: m[1] ? parseInt(m[1], 10) : undefined, beat: parseInt(m[2], 10), index: m.index, fullLength: m[0].length });
  if (matches.length === 0) return { cleanText: rawText, timeAnchors: [] };
  const isExplicitM1 = matches[0].absMeasure === 1 || forceThetic, firstOneIdx = matches.findIndex((x) => x.beat === 1);
  let hasAnacrusis = false, anacrusisStartBeat: number | undefined, anacrusisBeats: number | undefined;
  const textBeforeFirst = rawText.slice(0, matches[0].index).replace(/\[[^\]]+\]/g, '').replace(REST_OR_HOLD_SUB_RE, ' ').replace(/\*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!isExplicitM1) {
    if (firstOneIdx > 0 || (firstOneIdx === -1 && matches[0].beat > 1)) {
      const sBeat = matches[0].beat; hasAnacrusis = true; anacrusisStartBeat = sBeat; anacrusisBeats = Math.max(1, beatsPerMeasure + 1 - sBeat);
    } else if (firstOneIdx === 0 && textBeforeFirst.length > 0) { hasAnacrusis = true; anacrusisStartBeat = beatsPerMeasure; anacrusisBeats = 1; }
  }
  const timeAnchors: TimeAnchor[] = [];
  let measureOffset = 0, hasEncounteredSyllables = false;
  if (hasAnacrusis && firstOneIdx === 0 && textBeforeFirst.length > 0) {
    const preSyls = splitTextIntoLetraSyllables(textBeforeFirst); hasEncounteredSyllables = preSyls.length > 0;
    timeAnchors.push({ beat: beatsPerMeasure, measureOffset: 0, isRest: false, isInitialRest: false, isSustainedHold: false, hasLeadingRest: false, charOffset: 0, textSlice: textBeforeFirst.replace(/<\/?u\b[^>]*>/gi, ''), syllables: preSyls });
  }
  for (let k = 0; k < matches.length; k++) {
    const cur = matches[k], nextIndex = matches[k + 1] ? matches[k + 1].index : rawText.length, chunk = rawText.slice(cur.index + cur.fullLength, nextIndex);
    const hasSilenceTag = /\[(?:silence|pause)\]/i.test(chunk), trimmedChunk = chunk.replace(/\[[^\]]+\]/g, '').replace(/\*/g, '').trim();
    const isExplicitSilence = hasSilenceTag || (/^[\s0𝄽]+$/.test(trimmedChunk) && /[0𝄽]/.test(trimmedChunk));
    const isHoldOnly = !isExplicitSilence && /^[\s_]*$/.test(trimmedChunk);
    const isRestSymbol = isExplicitSilence || isHoldOnly, prevAnchor = timeAnchors[timeAnchors.length - 1];
    const isSameBeatAfterRest = k > 0 && cur.beat === matches[k - 1].beat && !isRestSymbol && prevAnchor && (prevAnchor.syllables?.length ?? 0) === 0;
    if (!isSameBeatAfterRest) {
      if (hasAnacrusis) {
        if (firstOneIdx >= 0 && k === firstOneIdx) measureOffset = 1;
        else if ((firstOneIdx >= 0 && k > firstOneIdx && (cur.beat === 1 || cur.beat <= matches[k - 1].beat)) || (firstOneIdx === -1 && k > 0 && cur.beat <= matches[k - 1].beat)) measureOffset++;
      } else if (k > 0 && (cur.beat === 1 || cur.beat <= matches[k - 1].beat)) measureOffset++;
    }
    const hasLeadingRest = (!isRestSymbol && /^[0_𝄽]\s*/.test(trimmedChunk)) || Boolean(isSameBeatAfterRest);
    const isGluedToSyl = /^[\p{L}\p{M}]/u.test(chunk.replace(/\*/g, '').replace(/<\/?u\b[^>]*>/gi, ''));
    const isDownbeatLocked = !hasLeadingRest && !isRestSymbol && (isIntraWordBadgeBoundary(rawText, cur.index, cur.fullLength) || Boolean(prevAnchor?.hasLeadingRest) || isGluedToSyl);
    const hasTrailingPickup = k + 1 < matches.length && isIntraWordBadgeBoundary(rawText, matches[k + 1].index, matches[k + 1].fullLength);
    const restCount = (trimmedChunk.match(REST_OR_HOLD_SUB_RE) || []).length, maxSlots = Math.max(1, 4 - restCount);
    const rawSlice = isRestSymbol ? '' : trimmedChunk.replace(REST_OR_HOLD_SUB_RE, ' ').replace(/\s+/g, ' ').trim();
    const rawSylls = rawSlice ? splitTextIntoLetraSyllables(rawSlice) : [];
    const syllables = rawSylls.length > maxSlots ? mergeSyllablesToImpulseCount(rawSylls, maxSlots) : rawSylls;
    const textSlice = rawSlice.replace(/<\/?u\b[^>]*>/gi, '');
    const syllableSubdivs = computeBeatSyllableSubdivs(trimmedChunk, syllables, hasLeadingRest, hasTrailingPickup);
    if (syllables.length > 0) hasEncounteredSyllables = true;
    const isRest = isExplicitSilence || (isHoldOnly && !hasEncounteredSyllables), isInitialRest = isRest && !hasEncounteredSyllables, isSustainedHold = !isExplicitSilence && isHoldOnly && hasEncounteredSyllables;
    if (isSameBeatAfterRest) timeAnchors.pop();
    timeAnchors.push({ beat: cur.beat, measureOffset, isRest, isInitialRest, isSustainedHold, hasLeadingRest, isDownbeatLocked, hasTrailingPickup, syllableSubdivs, charOffset: cur.index, textSlice, syllables });
  }
  if (!hasAnacrusis) {
    const firstSung = timeAnchors.find((a) => !a.isInitialRest && !a.isRest && (a.syllables?.length || a.textSlice));
    if (firstSung && firstSung.measureOffset === 0 && firstSung.beat > 1) {
      for (let b = firstSung.beat - 1; b >= 1; b--) if (!timeAnchors.some((a) => a.measureOffset === 0 && a.beat === b)) timeAnchors.unshift({ beat: b, measureOffset: 0, isRest: true, isInitialRest: true, isSustainedHold: false, textSlice: '', syllables: [] });
      timeAnchors.sort((a, b) => (a.measureOffset - b.measureOffset) || (a.beat - b.beat));
    }
  }
  const cleanText = rawText.replace(/\[(?:M\d+[•·\.:])?([1-9]|1[0-2])\]/gi, '').replace(/<\/?u\b[^>]*>/gi, '').replace(/\[(?:silence|pause)\]/gi, ' ').replace(REST_OR_HOLD_SUB_RE, ' ').replace(/\s{2,}/g, ' ').trim();
  const lastA = timeAnchors[timeAnchors.length - 1], prevA = timeAnchors[timeAnchors.length - 2], rawCount1 = timeAnchors.filter((x) => x.beat === 1 && (!hasAnacrusis || x.measureOffset > 0)).length;
  const isTailExit1 = Boolean(rawCount1 >= 2 && lastA?.beat === 1 && prevA && prevA.beat > 1 && !(lastA.textSlice || '').trim().includes(' '));
  const count1 = isTailExit1 ? rawCount1 - 1 : rawCount1;
  const rawMeasuresCount = Math.min(4, Math.max(1, count1 > 0 ? count1 : (hasAnacrusis ? (measureOffset || 1) : measureOffset + 1))) as 1 | 2 | 3 | 4;
  return { cleanText, timeAnchors, measuresCount: rawMeasuresCount, hasAnacrusis, anacrusisBeats, anacrusisStartBeat, exitBeat: isTailExit1 ? 1 : timeAnchors[timeAnchors.length - 1]?.beat };
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
    if (parsed.length > 0) return (existing && existing.length === parsed.length) ? parsed.map((p, i) => (existing[i]?.syllables?.some((s) => s.includes("'")) && normLetters(existing[i].syllables!.join('')) === normLetters((p.syllables || []).join(''))) ? { ...p, syllables: existing[i].syllables, syllableSubdivs: existing[i].syllableSubdivs ?? p.syllableSubdivs } : p) : parsed;
  }
  return existing;
}
