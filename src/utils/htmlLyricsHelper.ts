/**
 * htmlLyricsHelper.ts
 * Découpe et extraction des fragments HTML (<strong>, <b>, <u>) et Markdown (**...**) (< 85 lignes).
 * Préserve les balises <u>...</u> pour le découpage syllabique explicite.
 */
import type { VocalRole } from '../types/toadaProject.types';

export interface RawTextSegment {
  role: VocalRole;
  text: string;
}

export function splitHtmlOrTextIntoRawLines(input: string): string[] {
  if (!input) return [];
  const text = input
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?(p|div|tr|li)[^>]*>/gi, '\n\n');

  const rawParagraphs = text.split(/\n{2,}/);
  const result: string[] = [];

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed || trimmed === '&nbsp;') continue;

    const subLines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
    let currentBlock = '';

    for (const sub of subLines) {
      if (/^\s*\[Section/i.test(sub)) {
        if (currentBlock) { result.push(currentBlock); currentBlock = ''; }
        result.push(sub);
      } else {
        currentBlock = currentBlock ? `${currentBlock} ${sub}` : sub;
      }
    }
    if (currentBlock) result.push(currentBlock);
  }
  return result.filter((l) => l.length > 0 && l !== '&nbsp;');
}

export function cleanHtmlText(text: string, preserveUnderline = true): string {
  let cleaned = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  if (preserveUnderline) {
    cleaned = cleaned.replace(/<(?!(\/?u\b))[^>]+>/gi, '');
  } else {
    cleaned = cleaned.replace(/<[^>]+>/g, '');
  }
  return cleaned.trim();
}

export function parseRichLineIntoSegments(rawLine: string, boldRole: VocalRole): RawTextSegment[] {
  let line = rawLine.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<b>$1</b>');

  let forcedRole: VocalRole | null = null;
  const puxMatch = line.match(/^(puxador|solo)\s*[:\-]\s*/i);
  const coroMatch = line.match(/^(coro|choeur|refrão|refrao)\s*[:\-]\s*/i);
  if (puxMatch) { forcedRole = 'puxador'; line = line.slice(puxMatch[0].length); }
  else if (coroMatch) { forcedRole = 'coro'; line = line.slice(coroMatch[0].length); }

  const segments: RawTextSegment[] = [];
  const regex = /(<(?:strong|b)>.*?<\/(?:strong|b)>|[^<]+|<[^>]+>)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    const chunk = match[0];
    if (chunk.startsWith('<') && !/<(?:strong|b|u)>/i.test(chunk)) continue;
    const isBold = /<(?:strong|b)>/i.test(chunk);
    const cleaned = cleanHtmlText(chunk, true);
    if (!cleaned) continue;

    const role: VocalRole = forcedRole ?? (isBold ? boldRole : (boldRole === 'coro' ? 'puxador' : 'coro'));
    segments.push({ role, text: cleaned });
  }

  const merged: RawTextSegment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && last.role === seg.role) last.text += ` ${seg.text}`;
    else merged.push({ ...seg });
  }
  return merged;
}
