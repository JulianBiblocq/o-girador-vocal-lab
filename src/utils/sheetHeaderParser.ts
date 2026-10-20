/**
 * sheetHeaderParser.ts
 * Extraction des métadonnées d'en-tête (Signature, Tempo, Tonalité, Rythme...) (< 65 lignes).
 */
import type { ToadaDocument } from '../types/toadaDocument.types';

export interface ExtractedSheetHeaders {
  meta: Partial<ToadaDocument>;
  cleanLyricsText: string;
}

const HEADER_REGEX = /^\s*(signature|timeSignature|tempo|bpm|tonalit[eé]|tonality|titre|title|rythme|rhythm|na[cç][aã]o)\s*:\s*(.+)$/i;

export function extractSheetHeaders(rawInput: string): ExtractedSheetHeaders {
  if (!rawInput) return { meta: {}, cleanLyricsText: '' };

  const lines = rawInput.split(/\r?\n/);
  const meta: Partial<ToadaDocument> = {};
  const remainingLines: string[] = [];
  let inHeaderZone = true;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inHeaderZone && remainingLines.length === 0) continue;
      remainingLines.push(line);
      continue;
    }

    const match = inHeaderZone ? trimmed.match(HEADER_REGEX) : null;
    if (match) {
      const key = match[1].toLowerCase();
      const val = match[2].trim();
      if (key === 'signature' || key === 'timesignature') meta.signature = val;
      else if (key === 'tempo' || key === 'bpm') meta.bpmDefaut = parseInt(val, 10) || undefined;
      else if (key.startsWith('tonalit') || key === 'tonality') meta.tonaliteDefaut = val;
      else if (key === 'titre' || key === 'title') meta.titre = val;
      else if (key === 'rythme' || key === 'rhythm') meta.rythme = val;
      else if (key.startsWith('na')) meta.nacao = val;
    } else {
      inHeaderZone = false;
      remainingLines.push(line);
    }
  }

  return { meta, cleanLyricsText: remainingLines.join('\n') };
}
