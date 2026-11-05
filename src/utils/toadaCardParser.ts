/**
 * toadaCardParser.ts
 * Découpage unifié des cartes et directives Toada 100% conforme à Organizador (< 140 lignes).
 * Source de vérité SSOT pour le découpage des blocs (#1..#N), rôles, mesures, accords, sections et anacrouses.
 */
import type { VocalRole } from '../types/toadaProject.types';
import type { ParsedLyricsSegment, TimeAnchor } from '../types/toadaDocument.types';
import { extractTimeAnchors, isAnchorOnlyLine, convertTwoLineNotationToBrackets } from './timeAnchorParser';
import { extractChordsFromTextLine, INLINE_CHORD_REGEX } from './chordParser';

export interface InlineDirectives {
  cleanText: string; measuresCount?: 1 | 2 | 3 | 4; hasAnacrusis?: boolean; anacrusisBeats?: number;
  isLinkedMeasure?: boolean; chords?: string[]; sectionName?: string; sectionBpm?: number;
  lineSignature?: string; timeAnchors?: TimeAnchor[]; exitBeat?: number;
}

export function isOrganizadorStructureText(text: string): boolean {
  if (!text) return false;
  return /\[(?:M\d+[•·\.:])?([1-9]|1[0-2])\]/.test(text) || text.split(/\r?\n/).some((l) => isAnchorOnlyLine(l));
}

export function extractInlineLineDirectives(rawSegmentText: string, beatsPerMeasure = 4): InlineDirectives {
  let text = rawSegmentText.trim();
  let measuresCount: 1 | 2 | 3 | 4 | undefined, hasAnacrusis: boolean | undefined, isLinkedMeasure: boolean | undefined;
  let sectionName: string | undefined, sectionBpm: number | undefined, lineSignature: string | undefined;

  const sigMatch = text.match(/^\[sig:(2\/4|3\/4|4\/4|6\/8|12\/8)\]\s*/i);
  if (sigMatch) { lineSignature = sigMatch[1]; text = text.slice(sigMatch[0].length).trim(); }

  const secMatch = text.match(/^\[\s*(?:Section\s+)?([^\]\-]+?)(?:\s*-\s*(\d+)\s*BPM)?\s*\]\s*/i);
  if (secMatch && !/^(?:M\d+[•\.:])?([1-9]|1[0-2])$/i.test(secMatch[1].trim()) && extractChordsFromTextLine(secMatch[0]).length === 0) {
    sectionName = secMatch[1].trim();
    if (secMatch[2]) sectionBpm = parseInt(secMatch[2], 10);
    text = text.slice(secMatch[0].length).trim();
  }

  if (text.startsWith('+')) { hasAnacrusis = true; text = text.replace(/^\+\s*/, ''); }
  else if (text.startsWith('/')) { isLinkedMeasure = true; text = text.replace(/^\/\s*/, ''); }

  const mMatch = text.match(/\(([1-4])\s*m(?:esures?)?\)/i);
  if (mMatch) { measuresCount = parseInt(mMatch[1], 10) as 1 | 2 | 3 | 4; text = text.replace(mMatch[0], ''); }

  if (/\(\s*(?:avec\s+ana|ana|anacrouse)\s*\)/i.test(text)) {
    hasAnacrusis = true; text = text.replace(/\(\s*(?:avec\s+ana|ana|anacrouse)\s*\)/gi, '');
  } else if (/\(\s*(?:sans\s+ana|no\s+ana)\s*\)/i.test(text)) {
    hasAnacrusis = false; text = text.replace(/\(\s*(?:sans\s+ana|no\s+ana)\s*\)/gi, '');
  }

  const extractedChords = extractChordsFromTextLine(text);
  const chords = extractedChords.length > 0 ? extractedChords.map((c) => c.chord) : undefined;
  if (chords) text = text.replace(new RegExp(INLINE_CHORD_REGEX.source, 'g'), '');

  const anchorRes = extractTimeAnchors(text, beatsPerMeasure, hasAnacrusis === false);
  text = anchorRes.cleanText;
  if (measuresCount === undefined && anchorRes.measuresCount !== undefined) measuresCount = anchorRes.measuresCount;
  if (hasAnacrusis === undefined && anchorRes.hasAnacrusis !== undefined) hasAnacrusis = anchorRes.hasAnacrusis;

  const cleanText = text.replace(/<(?!(\/?u\b))[^>]*>/gi, '').replace(/\[[^\]]+\]/g, '').replace(/[\*_]/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return {
    cleanText, measuresCount, hasAnacrusis, anacrusisBeats: anchorRes.anacrusisBeats, isLinkedMeasure, chords,
    sectionName, sectionBpm, lineSignature,
    timeAnchors: anchorRes.timeAnchors.length > 0 ? anchorRes.timeAnchors : undefined, exitBeat: anchorRes.exitBeat,
  };
}

export function parseOrganizadorCards(rawText: string): string[] {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText.split(/\r?\n/), result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const cur = lines[i], next = lines[i + 1];
    if (isAnchorOnlyLine(cur) && next !== undefined && !isAnchorOnlyLine(next) && next.trim()) {
      result.push(convertTwoLineNotationToBrackets(cur, next));
      i += 2;
      while (i < lines.length && !lines[i].trim()) i++;
    } else {
      const trimmed = cur.trim();
      if (trimmed && !/^\s*#/.test(trimmed)) result.push(trimmed);
      i++;
    }
  }
  return result;
}

export function parseOrganizadorCardLine(lineText: string, boldRole: VocalRole = 'puxador', cardIndex?: number, beatsPerMeasure = 4): ParsedLyricsSegment {
  const rawLineCode = lineText.trim();
  const pauseMatch = rawLineCode.match(/^\[\s*(?:PAUSE|SILENCE)(?:\s+(?:BAQUE|[A-Z]+))?\s+(\d+)\s*M(?:ESURES?)?\s*\]$/i);
  if (pauseMatch) {
    const mCount = Math.max(1, Math.min(8, parseInt(pauseMatch[1], 10) || 1));
    return {
      cardIndex, rawLineCode, role: boldRole, text: '',
      measuresCount: Math.min(4, mCount) as 1 | 2 | 3 | 4,
      hasAnacrusis: false, isSilenceSlot: true, silenceMeasures: mCount,
    };
  }
  let cleanLine = rawLineCode;
  let forcedRole: VocalRole | null = null;
  const puxMatch = cleanLine.match(/^(?:puxador|solo)\s*[:\-]\s*/i);
  const coroMatch = cleanLine.match(/^(?:coro|choeur|refrao|refrão)\s*[:\-]\s*/i);
  if (puxMatch) { forcedRole = 'puxador'; cleanLine = cleanLine.slice(puxMatch[0].length); }
  else if (coroMatch) { forcedRole = 'coro'; cleanLine = cleanLine.slice(coroMatch[0].length); }

  const isBold = (cleanLine.startsWith('*') && cleanLine.endsWith('*')) || /\*[^*]+\*/.test(cleanLine) || /<(?:strong|b)>/i.test(cleanLine);
  const role: VocalRole = forcedRole ?? (isBold ? boldRole : (boldRole === 'coro' ? 'puxador' : 'coro'));
  const dir = extractInlineLineDirectives(cleanLine, beatsPerMeasure);

  return {
    cardIndex, rawLineCode, lineSignature: dir.lineSignature, role,
    text: dir.cleanText || cleanLine,
    measuresCount: dir.measuresCount ?? 1,
    hasAnacrusis: dir.hasAnacrusis ?? false,
    anacrusisBeats: dir.anacrusisBeats,
    timeAnchors: dir.timeAnchors,
    exitBeat: dir.exitBeat,
    chords: dir.chords,
    sectionName: dir.sectionName,
    sectionBpm: dir.sectionBpm,
    isLinkedMeasure: dir.isLinkedMeasure ?? false,
  };
}

export function parseOrganizadorToadaSegments(rawStructureText: string, rawPhonetic?: string, boldRole: VocalRole = 'puxador', beatsPerMeasure = 4): ParsedLyricsSegment[] {
  const cardLines = parseOrganizadorCards(rawStructureText);
  const phonLines = rawPhonetic ? rawPhonetic.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && l !== '____' && l !== '____*') : [];
  const segments: ParsedLyricsSegment[] = [];
  let currentSectionName: string | undefined, currentSectionBpm: number | undefined, cardIdx = 0;

  for (const line of cardLines) {
    const seg = parseOrganizadorCardLine(line, boldRole, cardIdx, beatsPerMeasure);
    if (seg.sectionName) { currentSectionName = seg.sectionName; currentSectionBpm = seg.sectionBpm; }
    if (!seg.text && !seg.timeAnchors?.length && !seg.isSilenceSlot) continue;
    seg.cardIndex = cardIdx;
    seg.sectionName = currentSectionName;
    seg.sectionBpm = currentSectionBpm;
    if (phonLines[cardIdx]) seg.phoneticText = phonLines[cardIdx].replace(/[\*_]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    segments.push(seg);
    cardIdx++;
  }
  return segments;
}
