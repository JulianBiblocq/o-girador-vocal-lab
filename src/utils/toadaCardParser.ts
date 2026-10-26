/**
 * toadaCardParser.ts
 * Découpage des cartes Toada 100% conforme à Organizador (< 120 lignes).
 * Source de vérité SSOT pour le découpage des blocs (#1..#N), rôles, mesures et anacrouses.
 */
import type { VocalRole } from '../types/toadaProject.types';
import type { ParsedLyricsSegment } from '../types/toadaDocument.types';
import { extractTimeAnchors } from './timeAnchorParser';
import { isAnchorOnlyLine, convertTwoLineNotationToBrackets } from './timeAnchorParser';

export function isOrganizadorStructureText(text: string): boolean {
  if (!text) return false;
  return /\[(?:M\d+[•\.:])?([1-9]|1[0-2])\]/.test(text) || isAnchorOnlyLine(text);
}

export function parseOrganizadorCards(rawText: string): string[] {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText.split(/\r?\n/);
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const cur = lines[i];
    const next = lines[i + 1];
    if (isAnchorOnlyLine(cur) && next !== undefined && !isAnchorOnlyLine(next) && next.trim()) {
      result.push(convertTwoLineNotationToBrackets(cur, next));
      i += 2;
      while (i < lines.length && !lines[i].trim()) i++;
    } else {
      const trimmed = cur.trim();
      if (trimmed && !/^\s*\[Section/i.test(trimmed)) {
        result.push(trimmed);
      }
      i++;
    }
  }
  return result;
}

export function parseOrganizadorCardLine(lineText: string, boldRole: VocalRole = 'puxador'): ParsedLyricsSegment {
  let cleanLine = lineText.replace(/^\[sig:(2\/4|3\/4|4\/4|6\/8|12\/8)\]\s*/i, '');
  
  let forcedRole: VocalRole | null = null;
  const puxMatch = cleanLine.match(/^(?:puxador|solo)\s*[:\-]\s*/i);
  const coroMatch = cleanLine.match(/^(?:coro|choeur|refrao|refrão)\s*[:\-]\s*/i);
  if (puxMatch) { forcedRole = 'puxador'; cleanLine = cleanLine.slice(puxMatch[0].length); }
  else if (coroMatch) { forcedRole = 'coro'; cleanLine = cleanLine.slice(coroMatch[0].length); }

  const isBold = (cleanLine.startsWith('*') && cleanLine.endsWith('*')) || /\*[^*]+\*/.test(cleanLine) || /<(?:strong|b)>/.test(cleanLine);
  const role: VocalRole = forcedRole ?? (isBold ? boldRole : (boldRole === 'coro' ? 'puxador' : 'coro'));

  const withoutRoleMarkers = cleanLine.replace(/^(?:puxador|coro|solo|choeur)\s*[:\-]\s*/i, '');
  const anchorRes = extractTimeAnchors(withoutRoleMarkers);

  // Nettoyage complet des balises et caractères spéciaux pour obtenir les paroles
  const cleanLyrics = anchorRes.cleanText
    .replace(/<[^>]*>/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/[\*_]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    role,
    text: cleanLyrics || withoutRoleMarkers,
    measuresCount: anchorRes.measuresCount ?? 1,
    hasAnacrusis: anchorRes.hasAnacrusis,
    anacrusisBeats: anchorRes.anacrusisBeats,
    timeAnchors: anchorRes.timeAnchors,
    exitBeat: anchorRes.exitBeat,
    isLinkedMeasure: false,
  };
}

export function parseOrganizadorToadaSegments(rawStructureText: string, rawPhonetic?: string, boldRole: VocalRole = 'puxador'): ParsedLyricsSegment[] {
  const cardLines = parseOrganizadorCards(rawStructureText);
  const phonLines = rawPhonetic ? rawPhonetic.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && l !== '____' && l !== '____*') : [];

  return cardLines.map((line, idx) => {
    const seg = parseOrganizadorCardLine(line, boldRole);
    if (phonLines[idx]) seg.phoneticText = phonLines[idx];
    return seg;
  });
}
