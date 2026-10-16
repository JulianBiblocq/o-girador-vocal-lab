/**
 * toadaSheetParser.ts
 * Parser universel des fiches ToadaDocument d'organizador (.json & texte/HTML) (< 125 lignes).
 * Gère le gras commutable (boldRole), directives en ligne ((1m), (sans ana)...) et phonétique.
 */
import type { VocalRole } from '../types/toadaProject.types';
import type { ToadaDocument, ParsedLyricsSegment, ParsedToadaSheetResult } from '../types/toadaDocument.types';
import { splitHtmlOrTextIntoRawLines, parseRichLineIntoSegments } from './htmlLyricsHelper';
import { extractInlineLineDirectives } from './sheetDirectiveHelper';

export function parseStructuredArrayLyrics(origList: any[], phonList?: any[]): ParsedLyricsSegment[] {
  const segments: ParsedLyricsSegment[] = [];
  origList.forEach((item, idx) => {
    const phonItem = phonList?.[idx];
    const isMixed = item.isMixed || (item.puxador && (item.coro || item.choeur));
    const addSeg = (role: VocalRole, rawText?: string, rawPhon?: string) => {
      if (!rawText?.trim()) return;
      const dir = extractInlineLineDirectives(rawText.trim());
      segments.push({
        role,
        text: dir.cleanText || rawText.trim(),
        phoneticText: rawPhon?.trim(),
        measuresCount: dir.measuresCount,
        hasAnacrusis: dir.hasAnacrusis,
      });
    };

    if (isMixed) {
      addSeg('puxador', item.puxador, phonItem?.puxador);
      addSeg('coro', item.coro || item.choeur, phonItem?.coro || phonItem?.choeur);
    } else if (item.puxador?.trim()) {
      addSeg('puxador', item.puxador, phonItem?.puxador);
    } else if ((item.coro || item.choeur)?.trim()) {
      addSeg('coro', item.coro || item.choeur, phonItem?.coro || phonItem?.choeur);
    }
  });
  return segments;
}

export function parseRichTextLyricsAndPhonetics(rawOriginal: string, rawPhonetic?: string, boldRole: VocalRole = 'puxador'): ParsedLyricsSegment[] {
  const origLines = splitHtmlOrTextIntoRawLines(rawOriginal);
  const phonLines = rawPhonetic ? splitHtmlOrTextIntoRawLines(rawPhonetic) : [];
  const segments: ParsedLyricsSegment[] = [];

  origLines.forEach((line, idx) => {
    const rawSegs = parseRichLineIntoSegments(line, boldRole);
    const phonLine = phonLines[idx];
    const phonSegs = phonLine ? parseRichLineIntoSegments(phonLine, boldRole) : [];

    rawSegs.forEach((seg, sIdx) => {
      const matchedPhon = phonSegs[sIdx] ?? phonSegs.find((p) => p.role === seg.role) ?? (phonSegs.length === 1 ? phonSegs[0] : undefined);
      const dir = extractInlineLineDirectives(seg.text);
      segments.push({
        role: seg.role,
        text: dir.cleanText || seg.text,
        phoneticText: matchedPhon?.text,
        measuresCount: dir.measuresCount,
        hasAnacrusis: dir.hasAnacrusis,
      });
    });
  });
  return segments;
}

export function parseToadaDocument(doc: ToadaDocument, boldRole: VocalRole = 'puxador'): ParsedToadaSheetResult {
  const docMeta: Partial<ToadaDocument> = {
    id: doc.id, titre: doc.titre, nacao: doc.nacao, rythme: doc.rythme, annee: doc.annee,
    traduction: doc.traduction, anecdote: doc.anecdote, notesLexique: doc.notesLexique,
    questionsQcm: doc.questionsQcm, bpmDefaut: doc.bpmDefaut, tonaliteDefaut: doc.tonaliteDefaut,
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

export function parseToadaJsonOrText(input: string, boldRole: VocalRole = 'puxador'): ParseSheetOutput {
  const trimmed = input.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const data = JSON.parse(trimmed);
      if (Array.isArray(data) && data.length > 0) {
        return { isJsonArray: true, docs: data, parsed: parseToadaDocument(data[0], boldRole) };
      }
      if (data && typeof data === 'object' && (data.titre || data.parolesOriginales)) {
        return { isJsonArray: false, docs: [data], parsed: parseToadaDocument(data, boldRole) };
      }
    } catch {
      // Fallback text
    }
  }
  return {
    isJsonArray: false, docs: [],
    parsed: { segments: parseRichTextLyricsAndPhonetics(trimmed, undefined, boldRole) },
  };
}
