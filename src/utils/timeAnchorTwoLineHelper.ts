/**
 * timeAnchorTwoLineHelper.ts — Utilitaires notation 2-lignes et clés de motifs pour timeAnchorParser (< 70 lignes).
 */
import type { TimeAnchor } from '../types/toadaDocument.types';

export function isAnchorOnlyLine(line: string): boolean {
  return Boolean(line.trim() && /^[\d\s_𝄽M•·\.:\[\]]+$/.test(line) && /\b([1-9]|1[0-2])\b/.test(line));
}

export function convertTwoLineNotationToBrackets(anchorLine: string, lyricsLine: string): string {
  const regex = /\b([1-9]|1[0-2])\b/g, matches: Array<{ beat: number; col: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(anchorLine)) !== null) matches.push({ beat: parseInt(m[1], 10), col: m.index });
  if (matches.length === 0) return lyricsLine;
  matches.sort((a, b) => a.col - b.col);
  let result = matches[0].col > 0 && lyricsLine.slice(0, matches[0].col).trim() ? lyricsLine.slice(0, matches[0].col) : '';
  let seenLex = Boolean(result.trim());
  for (let k = 0; k < matches.length; k++) {
    const cur = matches[k], nextCol = matches[k + 1] ? matches[k + 1].col : lyricsLine.length, slice = lyricsLine.slice(cur.col, nextCol);
    if (!slice.trim()) result += `[${cur.beat}]0 `;
    else { result += `[${cur.beat}]${/^\s+\S/.test(slice) ? (seenLex ? '_ ' : '0 ') : ''}${slice.trimStart()}`; seenLex = true; }
  }
  return result.trim().replace(/\s{2,}/g, ' ');
}

export function preprocessTwoLineLyrics(text: string): string {
  if (!text) return '';
  const lines = text.split(/\r?\n/), resultLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], next = lines[i + 1];
    if (isAnchorOnlyLine(line) && next !== undefined && !isAnchorOnlyLine(next) && next.trim().length > 0) {
      resultLines.push(convertTwoLineNotationToBrackets(line, next));
      i++;
    } else resultLines.push(line);
  }
  return resultLines.join('\n');
}

export function buildBeatLyricsMap(timeAnchors: TimeAnchor[], _hasAnacrusis = false): Record<string, TimeAnchor> {
  const map: Record<string, TimeAnchor> = {};
  for (const a of timeAnchors) map[`${a.measureOffset}_${a.beat}`] = { ...a, syllables: a.syllables || [] };
  const firstSung = timeAnchors.find((a) => !a.isInitialRest && !a.isRest && (a.syllables?.length || a.textSlice));
  if (firstSung && firstSung.measureOffset === 0 && firstSung.beat > 1) {
    for (let b = 1; b < firstSung.beat; b++) {
      if (!map[`0_${b}`]) map[`0_${b}`] = { beat: b, measureOffset: 0, isRest: true, isInitialRest: true, isSustainedHold: false, hasLeadingRest: false, syllables: [] };
    }
  }
  return map;
}

export function buildNormalizedPatternKey(role: string, text: string, timeAnchors?: TimeAnchor[]): string {
  const norm = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!timeAnchors?.length) return `${role}:${norm}`;
  const firstSung = timeAnchors.findIndex((a) => !a.isRest && !a.isInitialRest), sung = firstSung >= 0 ? timeAnchors.slice(firstSung) : timeAnchors;
  return `${role}:${norm}:${sung.map((a) => `${a.beat}${a.isRest ? 'R' : ''}`).join('-')}`;
}
