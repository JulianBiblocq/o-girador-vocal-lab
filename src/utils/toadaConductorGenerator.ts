/**
 * toadaConductorGenerator.ts
 * Génération automatique des patterns, nommage au 1er mot, frise conducteur et options par défaut (< 100 lignes).
 */
import type { ToadaProject, VocalPatternItem, ToadaArrangementSlot } from '../types/toadaProject.types';
import type { ParsedToadaSheetResult, ParsedLyricsSegment } from '../types/toadaDocument.types';
import { createDefaultVocalPattern } from '../types/toadaProject.types';
import { createMirroredPattern } from './patternMirrorHelper';

export interface ToadaSheetGenOptions {
  bpm?: number;
  defaultMeasuresCount?: 1 | 2 | 3 | 4;
  defaultHasAnacrusis?: boolean;
}

export function extractCleanFirstWord(text: string): string {
  if (!text) return 'Phrase';
  const clean = text.replace(/<[^>]*>/g, '').trim();
  const match = clean.match(/^[\s"'«“„–—\-_([{\\/*]*([\p{L}\p{M}\d]+)/u);
  if (!match || !match[1]) {
    const fallback = clean.split(/\s+/)[0] || 'Phrase';
    return fallback.charAt(0).toUpperCase() + fallback.slice(1);
  }
  const word = match[1];
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function buildPatternNameFromFirstWord(text: string, existingNamesInSameRole: string[]): string {
  const baseWord = extractCleanFirstWord(text);
  if (!existingNamesInSameRole.includes(baseWord)) return baseWord;
  let idx = 2;
  while (existingNamesInSameRole.includes(`${baseWord} (${idx})`)) idx++;
  return `${baseWord} (${idx})`;
}

export function generateToadaFromSheet(
  project: ToadaProject,
  parsed: ParsedToadaSheetResult,
  options?: ToadaSheetGenOptions
): ToadaProject {
  const newPatterns: VocalPatternItem[] = [];
  const newSlots: ToadaArrangementSlot[] = [];
  const map = new Map<string, string>();
  let prevSeg: ParsedLyricsSegment | null = null;
  const targetBpm = options?.bpm ?? parsed.docMeta?.bpmDefaut ?? project.bpm ?? 55;

  for (let i = 0; i < parsed.segments.length; i++) {
    const seg = parsed.segments[i];
    const normLyrics = seg.text.trim().toLowerCase().replace(/\s+/g, ' ');
    const key = `${seg.role}:${normLyrics}`;
    let patId = map.get(key);

    if (!patId) {
      const isMirror = seg.role === 'coro' && prevSeg?.role === 'puxador' && prevSeg.text.toLowerCase().trim() === seg.text.toLowerCase().trim();
      const prevPat = isMirror && prevSeg ? newPatterns.find((p) => p.assignedLyricsText === prevSeg?.text && p.role === 'puxador') : null;
      const namesInRole = newPatterns.filter((p) => p.role === seg.role).map((p) => p.name);
      const patName = buildPatternNameFromFirstWord(seg.text, namesInRole);

      const segMeasures = seg.measuresCount ?? options?.defaultMeasuresCount ?? 2;
      const segAnacrusis = seg.hasAnacrusis ?? options?.defaultHasAnacrusis ?? true;

      const pat = prevPat
        ? createMirroredPattern(prevPat, 'coro')
        : createDefaultVocalPattern(seg.role, patName, segMeasures, targetBpm);

      pat.name = patName;
      pat.measuresCount = segMeasures;
      pat.hasAnacrusis = segAnacrusis;
      pat.baseBpm = targetBpm;
      pat.assignedLyricsText = seg.text;
      pat.assignedPhoneticText = seg.phoneticText;
      newPatterns.push(pat);
      patId = pat.id;
      map.set(key, patId);
    }

    newSlots.push({
      slotId: `slot-${newSlots.length + 1}`,
      puxadorPatternId: seg.role === 'puxador' ? patId : null,
      coroPatternId: seg.role === 'coro' ? patId : null,
    });
    prevSeg = seg;
  }

  return {
    ...project,
    title: parsed.docMeta?.titre || project.title,
    bpm: targetBpm,
    patterns: newPatterns.length > 0 ? newPatterns : project.patterns,
    slots: newSlots.length > 0 ? newSlots : project.slots,
    activePatternId: newPatterns[0]?.id || project.activePatternId,
    toadaMeta: parsed.docMeta ? { ...project.toadaMeta, ...parsed.docMeta } : project.toadaMeta,
    sheetLines: parsed.segments.map((s) => ({ role: s.role, text: s.text, phoneticText: s.phoneticText })),
  };
}
