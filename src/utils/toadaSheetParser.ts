/**
 * toadaSheetParser.ts
 * Parser universel des fiches Toada (.txt, .json et HTML) (< 140 lignes).
 * Gère le format structuré d'Organizador (#1..#N), les retours visuels, les mesures mixtes et les liaisons (/).
 */
import type { VocalRole } from '../types/toadaProject.types';
import type { ToadaDocument, ParsedLyricsSegment, ParsedToadaSheetResult } from '../types/toadaDocument.types';
import { splitHtmlOrTextIntoRawLines, parseRichLineIntoSegments } from './htmlLyricsHelper';
import { extractSheetHeaders } from './sheetHeaderParser';
import { preprocessTwoLineLyrics } from './timeAnchorParser';
import { isOrganizadorStructureText, parseOrganizadorToadaSegments, extractInlineLineDirectives } from './toadaCardParser';
import { getBeatsPerMeasure } from './musicalMath';

export function parseRichTextLyricsAndPhonetics(
  rawOriginal: string, rawPhonetic?: string, boldRole: VocalRole = 'puxador', signature = '4/4'
): ParsedLyricsSegment[] {
  const { meta: hMeta, cleanLyricsText } = extractSheetHeaders(rawOriginal);
  const beatsPerMeasure = getBeatsPerMeasure((hMeta.signature || signature) as any);
  if (isOrganizadorStructureText(cleanLyricsText)) {
    return parseOrganizadorToadaSegments(cleanLyricsText, rawPhonetic, boldRole, beatsPerMeasure);
  }

  const preprocessedLyrics = preprocessTwoLineLyrics(cleanLyricsText);
  const lines = preprocessedLyrics.split(/\r?\n/);
  const mergedLines: string[] = [];
  for (const line of lines) {
    if (/^\s+/.test(line) && mergedLines.length > 0) {
      mergedLines[mergedLines.length - 1] += ' ' + line.trim();
    } else {
      mergedLines.push(line.trim());
    }
  }

  const normalizedInput = mergedLines.join('\n');
  const origLines = splitHtmlOrTextIntoRawLines(normalizedInput);
  const phonLines = rawPhonetic ? splitHtmlOrTextIntoRawLines(rawPhonetic) : [];
  const segments: ParsedLyricsSegment[] = [];
  let currentSectionName: string | undefined;
  let currentSectionBpm: number | undefined;
  let cardIndex = 0;

  origLines.forEach((rawL, idx) => {
    const rawLineCode = rawL.trim();
    let line = rawLineCode;
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
      const dir = extractInlineLineDirectives(seg.text, beatsPerMeasure);

      if (dir.sectionName) { currentSectionName = dir.sectionName; currentSectionBpm = dir.sectionBpm; }
      if (!dir.cleanText) return;

      segments.push({
        cardIndex: cardIndex++,
        rawLineCode: isMixedLine ? undefined : rawLineCode,
        lineSignature: dir.lineSignature,
        role: seg.role,
        text: dir.cleanText || seg.text,
        phoneticText: (phonSegs[sIdx] ?? phonSegs.find((p) => p.role === seg.role))?.text,
        measuresCount: dir.measuresCount,
        hasAnacrusis: dir.hasAnacrusis ?? (sIdx === 0 ? hasLineAnacrusis : false),
        anacrusisBeats: dir.anacrusisBeats,
        isLinkedMeasure: dir.isLinkedMeasure ?? (sIdx === 0 ? isLineLinked : false),
        isMixedPair: isMixedLine && (sIdx === 0 || sIdx === 1),
        isSimultaneousTutti: seg.isSimultaneousTutti,
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
  const rawBpm = doc.bpmDefaut ?? hMeta.bpmDefaut ?? (doc as any).bpm ?? (doc as any).tempo;
  const resolvedBpm = rawBpm !== undefined && Number(rawBpm) > 0 ? Number(rawBpm) : undefined;
  const resolvedSig = doc.signature || doc.timeSignature || hMeta.signature || '4/4';

  const docMeta: Partial<ToadaDocument> = {
    ...doc,
    id: doc.id,
    titre: doc.titre || hMeta.titre,
    nacao: doc.nacao || hMeta.nacao,
    rythme: doc.rythme || hMeta.rythme,
    bpmDefaut: resolvedBpm,
    tonaliteDefaut: doc.tonaliteDefaut || hMeta.tonaliteDefaut,
    signature: resolvedSig,
    globalHarmonyGrid: doc.globalHarmonyGrid || doc.harmonyGrid,
  };

  const phonStr = typeof doc.parolesPhonetiques === 'string' ? doc.parolesPhonetiques : undefined;
  const segments = parseRichTextLyricsAndPhonetics(sourceLyrics, phonStr, boldRole, resolvedSig);

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
  const { meta: hMeta } = extractSheetHeaders(trimmed);
  return {
    isJsonArray: false, docs: [],
    parsed: { docMeta: hMeta, segments: parseRichTextLyricsAndPhonetics(trimmed, undefined, boldRole, hMeta.signature) },
  };
}
