/**
 * toadaSheetParser.ts
 * Parser universel des fiches ToadaDocument d'organizador (.json & texte/HTML) (< 135 lignes).
 * Gère le gras commutable (boldRole), les lignes mixtes et l'alignement phonétique.
 */
import type { VocalRole } from '../types/toadaProject.types';
import type { ToadaDocument, ParsedLyricsSegment, ParsedToadaSheetResult } from '../types/toadaDocument.types';
import { splitHtmlOrTextIntoRawLines, parseRichLineIntoSegments } from './htmlLyricsHelper';

export function parseStructuredArrayLyrics(origList: any[], phonList?: any[]): ParsedLyricsSegment[] {
  const segments: ParsedLyricsSegment[] = [];
  origList.forEach((item, idx) => {
    const phonItem = phonList?.[idx];
    const isMixed = item.isMixed || (item.puxador && (item.coro || item.choeur));
    if (isMixed) {
      if (item.puxador?.trim()) {
        segments.push({ role: 'puxador', text: item.puxador.trim(), phoneticText: phonItem?.puxador?.trim() });
      }
      const coroTxt = (item.coro || item.choeur)?.trim();
      if (coroTxt) {
        segments.push({ role: 'coro', text: coroTxt, phoneticText: (phonItem?.coro || phonItem?.choeur)?.trim() });
      }
    } else if (item.puxador?.trim()) {
      segments.push({ role: 'puxador', text: item.puxador.trim(), phoneticText: phonItem?.puxador?.trim() });
    } else if ((item.coro || item.choeur)?.trim()) {
      segments.push({ role: 'coro', text: (item.coro || item.choeur).trim(), phoneticText: (phonItem?.coro || phonItem?.choeur)?.trim() });
    }
  });
  return segments;
}

export function parseRichTextLyricsAndPhonetics(rawOriginal: string, rawPhonetic?: string, boldRole: VocalRole = 'coro'): ParsedLyricsSegment[] {
  const origLines = splitHtmlOrTextIntoRawLines(rawOriginal);
  const phonLines = rawPhonetic ? splitHtmlOrTextIntoRawLines(rawPhonetic) : [];
  const segments: ParsedLyricsSegment[] = [];

  origLines.forEach((line, idx) => {
    const rawSegs = parseRichLineIntoSegments(line, boldRole);
    const phonLine = phonLines[idx];
    const phonSegs = phonLine ? parseRichLineIntoSegments(phonLine, boldRole) : [];

    rawSegs.forEach((seg, sIdx) => {
      // Find matching phonetic segment by index or by role
      const matchedPhon = phonSegs[sIdx] ?? phonSegs.find((p) => p.role === seg.role) ?? (phonSegs.length === 1 ? phonSegs[0] : undefined);
      segments.push({
        role: seg.role,
        text: seg.text,
        phoneticText: matchedPhon?.text,
      });
    });
  });
  return segments;
}

export function parseToadaDocument(doc: ToadaDocument, boldRole: VocalRole = 'coro'): ParsedToadaSheetResult {
  const docMeta: Partial<ToadaDocument> = {
    id: doc.id,
    titre: doc.titre,
    nacao: doc.nacao,
    rythme: doc.rythme,
    annee: doc.annee,
    traduction: doc.traduction,
    anecdote: doc.anecdote,
    notesLexique: doc.notesLexique,
    questionsQcm: doc.questionsQcm,
    bpmDefaut: doc.bpmDefaut,
    tonaliteDefaut: doc.tonaliteDefaut,
  };

  let segments: ParsedLyricsSegment[] = [];
  if (Array.isArray(doc.parolesOriginales)) {
    segments = parseStructuredArrayLyrics(doc.parolesOriginales, Array.isArray(doc.parolesPhonetiques) ? doc.parolesPhonetiques : undefined);
  } else if (typeof doc.parolesOriginales === 'string') {
    const phonStr = typeof doc.parolesPhonetiques === 'string' ? doc.parolesPhonetiques : undefined;
    segments = parseRichTextLyricsAndPhonetics(doc.parolesOriginales, phonStr, boldRole);
  }

  return { docMeta, segments };
}

export interface ParseSheetOutput {
  isJsonArray: boolean;
  docs: ToadaDocument[];
  parsed: ParsedToadaSheetResult;
}

export function parseToadaJsonOrText(input: string, boldRole: VocalRole = 'coro'): ParseSheetOutput {
  const trimmed = input.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const data = JSON.parse(trimmed);
      if (Array.isArray(data) && data.length > 0) {
        const docs = data as ToadaDocument[];
        return { isJsonArray: true, docs, parsed: parseToadaDocument(docs[0], boldRole) };
      }
      if (data && typeof data === 'object' && (data.titre || data.parolesOriginales)) {
        const doc = data as ToadaDocument;
        return { isJsonArray: false, docs: [doc], parsed: parseToadaDocument(doc, boldRole) };
      }
    } catch {
      // Fallback to text parsing
    }
  }
  return {
    isJsonArray: false,
    docs: [],
    parsed: { segments: parseRichTextLyricsAndPhonetics(trimmed, undefined, boldRole) },
  };
}
