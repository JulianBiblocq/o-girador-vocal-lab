/**
 * toadaSheetParser.ts
 * Parser universel des fiches Toada (.txt, .json et HTML) (< 125 lignes).
 * Gère les retours visuels (lignes indentées), les mesures mixtes (Puxador + Coro),
 * les liaisons (/), anacrouses (+) et sections.
 */
import type { VocalRole } from '../types/toadaProject.types';
import type { ToadaDocument, ParsedLyricsSegment, ParsedToadaSheetResult } from '../types/toadaDocument.types';
import { splitHtmlOrTextIntoRawLines, parseRichLineIntoSegments } from './htmlLyricsHelper';
import { extractInlineLineDirectives } from './sheetDirectiveHelper';
import { extractSheetHeaders } from './sheetHeaderParser';
import { preprocessTwoLineLyrics } from './timeAnchorParser';

export function parseRichTextLyricsAndPhonetics(rawOriginal: string, rawPhonetic?: string, boldRole: VocalRole = 'puxador'): ParsedLyricsSegment[] {
  const { cleanLyricsText } = extractSheetHeaders(rawOriginal);
  const preprocessedLyrics = preprocessTwoLineLyrics(cleanLyricsText);
  const lines = preprocessedLyrics.split(/\r?\n/);
  const mergedLines: string[] = [];
  for (const line of lines) {
    if (/^\s+/.test(line) && mergedLines.length > 0) {
      mergedLines[mergedLines.length - 1] += ' ' + line.trim();
    } else if (line.trim().length > 0) {
      mergedLines.push(line);
    }
  }

  const normalizedInput = mergedLines.join('\n');
  const origLines = splitHtmlOrTextIntoRawLines(normalizedInput);
  const phonLines = rawPhonetic ? splitHtmlOrTextIntoRawLines(rawPhonetic) : [];
  const segments: ParsedLyricsSegment[] = [];
  let currentSectionName: string | undefined;
  let currentSectionBpm: number | undefined;

  origLines.forEach((rawL, idx) => {
    let line = rawL.trim();
    let hasLineAnacrusis = false;
    let isLineLinked = false;

    if (line.startsWith('+')) {
      hasLineAnacrusis = true;
      line = line.replace(/^\+\s*/, '');
    } else if (line.startsWith('/')) {
      isLineLinked = true;
      line = line.replace(/^\/\s*/, '');
    }

    const rawSegs = parseRichLineIntoSegments(line, boldRole);
    const phonLine = phonLines[idx];
    const phonSegs = phonLine ? parseRichLineIntoSegments(phonLine, boldRole) : [];
    const isMixedLine = rawSegs.length > 1;

    rawSegs.forEach((seg, sIdx) => {
      const matchedPhon = phonSegs[sIdx] ?? phonSegs.find((p) => p.role === seg.role);
      const dir = extractInlineLineDirectives(seg.text);

      if (dir.sectionName) {
        currentSectionName = dir.sectionName;
        currentSectionBpm = dir.sectionBpm;
      }
      if (!dir.cleanText) return;

      segments.push({
        role: seg.role,
        text: dir.cleanText || seg.text,
        phoneticText: matchedPhon?.text,
        measuresCount: dir.measuresCount,
        hasAnacrusis: dir.hasAnacrusis ?? (sIdx === 0 ? hasLineAnacrusis : false),
        isLinkedMeasure: dir.isLinkedMeasure ?? (sIdx === 0 ? isLineLinked : false),
        isMixedPair: isMixedLine && (sIdx === 0 || sIdx === 1),
        chords: dir.chords,
        sectionName: currentSectionName,
        sectionBpm: currentSectionBpm,
        timeAnchors: dir.timeAnchors,
        exitBeat: dir.exitBeat,
      });
    });
  });
  return segments;
}

export function parseToadaDocument(doc: ToadaDocument, boldRole: VocalRole = 'puxador'): ParsedToadaSheetResult {
  const sourceLyrics = doc.rawTxtCode || (typeof doc.parolesOriginales === 'string' ? doc.parolesOriginales : '');
  const { meta: hMeta } = extractSheetHeaders(sourceLyrics);

  const docMeta: Partial<ToadaDocument> = {
    id: doc.id,
    titre: doc.titre || hMeta.titre,
    nacao: doc.nacao || hMeta.nacao,
    rythme: doc.rythme || hMeta.rythme,
    annee: doc.annee,
    traduction: doc.traduction,
    anecdote: doc.anecdote,
    notesLexique: doc.notesLexique,
    questionsQcm: doc.questionsQcm,
    bpmDefaut: doc.bpmDefaut || hMeta.bpmDefaut,
    tonaliteDefaut: doc.tonaliteDefaut || hMeta.tonaliteDefaut,
    rawTxtCode: doc.rawTxtCode,
    signature: doc.signature || doc.timeSignature || hMeta.signature,
  };

  const phonStr = typeof doc.parolesPhonetiques === 'string' ? doc.parolesPhonetiques : undefined;
  const segments = parseRichTextLyricsAndPhonetics(sourceLyrics, phonStr, boldRole);

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
      if (data && typeof data === 'object' && (data.titre || data.parolesOriginales || data.rawTxtCode)) {
        return { isJsonArray: false, docs: [data], parsed: parseToadaDocument(data, boldRole) };
      }
    } catch {}
  }
  return {
    isJsonArray: false, docs: [],
    parsed: { segments: parseRichTextLyricsAndPhonetics(trimmed, undefined, boldRole) },
  };
}
