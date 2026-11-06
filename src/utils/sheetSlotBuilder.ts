/**
 * sheetSlotBuilder.ts
 * Construction des motifs (VocalPatternItem) et de la Frise Conducteur (slots) avec superposition
 * automatique des phrases Tutti / Ensemble (K >= 2 lignes Puxador + Coro identiques ou ***...***) (< 130 lignes).
 */
import type { VocalPatternItem, ToadaArrangementSlot, VocalRole } from '../types/toadaProject.types';
import type { ParsedLyricsSegment } from '../types/toadaDocument.types';
import { createDefaultVocalPattern } from '../types/toadaProject.types';
import { createHarmonyGridFromChords } from './chordGridHelper';

export function extractCleanFirstWord(text: string): string {
  if (!text) return 'Phrase';
  const m = text.replace(/<[^>]*>/g, '').trim().match(/^[\s"'«“„–—\-_([{\\/*]*([\p{L}\p{M}\d]+)/u);
  return m?.[1] ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : (text.trim().split(/\s+/)[0] || 'Phrase');
}

export function buildPatternNameFromFirstWord(text: string, existingNames: string[]): string {
  const base = extractCleanFirstWord(text);
  let idx = 2, name = base;
  while (existingNames.includes(name)) name = `${base} (${idx++})`;
  return name;
}

export function normalizeLyricsForComparison(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>|\[[^\]]*\]|\(\s*[1-4]\s*m(?:esures?)?\s*\)|\(\s*(?:avec\s+ana|sans\s+ana|no\s+ana|ana|anacrouse)\s*\)|[*_]/gi, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLowerCase();
}

export function initPatternFromSegment(
  role: VocalRole, seg: ParsedLyricsSegment, bpm: number, existingNames: string[],
  measuresCount: 1 | 2 | 3 | 4 = 1, defaultAna = false, cardIndex = 0
): VocalPatternItem {
  const effBpm = seg.sectionBpm ?? bpm;
  const pat = createDefaultVocalPattern(role, buildPatternNameFromFirstWord(seg.text, existingNames), measuresCount, effBpm);
  pat.cardIndex = seg.cardIndex ?? cardIndex;
  pat.rawLineCode = seg.rawLineCode;
  pat.baseBpm = effBpm; pat.bpm = effBpm;
  pat.assignedLyricsText = seg.text; pat.assignedPhoneticText = seg.phoneticText;
  pat.hasAnacrusis = seg.hasAnacrusis ?? defaultAna;
  pat.anacrusisBeats = seg.anacrusisBeats ?? (pat.hasAnacrusis ? 2 : undefined);
  pat.timeAnchors = seg.timeAnchors; pat.exitBeat = seg.exitBeat;
  if (seg.chords?.length) pat.harmonyGrid = createHarmonyGridFromChords(seg.chords, measuresCount);
  return pat;
}

function isPlainRoleSegment(seg: ParsedLyricsSegment | undefined, expectedRole?: VocalRole): boolean {
  if (!seg || seg.isSilenceSlot || seg.isSimultaneousTutti || seg.isMixedPair || seg.isLinkedMeasure) return false;
  return expectedRole ? seg.role === expectedRole : true;
}

export function findSimultaneousBlockLength(segments: ParsedLyricsSegment[], startIdx: number): number {
  const first = segments[startIdx];
  if (!isPlainRoleSegment(first)) return 0;
  const roleA = first.role, roleB: VocalRole = roleA === 'puxador' ? 'coro' : 'puxador';
  let maxRunA = 0;
  while (isPlainRoleSegment(segments[startIdx + maxRunA], roleA)) maxRunA++;
  const maxK = Math.min(maxRunA, Math.floor((segments.length - startIdx) / 2));

  for (let k = maxK; k >= 2; k--) {
    let allMatch = true;
    for (let m = 0; m < k; m++) {
      const segA = segments[startIdx + m], segB = segments[startIdx + k + m];
      if (!isPlainRoleSegment(segA, roleA) || !isPlainRoleSegment(segB, roleB)) { allMatch = false; break; }
      const normA = normalizeLyricsForComparison(segA.text), normB = normalizeLyricsForComparison(segB.text);
      if (!normA || normA !== normB) { allMatch = false; break; }
    }
    if (allMatch) return k;
  }
  return 0;
}

export function buildPatternsAndSlotsFromSegments(
  segments: ParsedLyricsSegment[], targetBpm: number, defaultHasAnacrusis = false
): { patterns: VocalPatternItem[]; slots: ToadaArrangementSlot[] } {
  const newPatterns: VocalPatternItem[] = [], newSlots: ToadaArrangementSlot[] = [];
  const namesOf = (r: VocalRole, extra: VocalPatternItem[] = []) => [...newPatterns, ...extra].filter((p) => p.role === r).map((p) => p.name);
  let i = 0;
  while (i < segments.length) {
    const seg = segments[i], nextSeg = segments[i + 1];
    if (seg.isSilenceSlot) {
      newSlots.push({ slotId: `slot-${newSlots.length + 1}`, puxadorPatternId: null, coroPatternId: null, advanceMeasures: Math.max(1, Math.min(8, seg.silenceMeasures ?? seg.measuresCount ?? 1)) });
      i++; continue;
    }
    if (seg.isMixedPair && nextSeg && nextSeg.isMixedPair && seg.role !== nextSeg.role) {
      const puxSeg = seg.role === 'puxador' ? seg : nextSeg, coroSeg = seg.role === 'coro' ? seg : nextSeg;
      const patPux = initPatternFromSegment('puxador', puxSeg, targetBpm, namesOf('puxador'), 1, false, newPatterns.length);
      const patCoro = initPatternFromSegment('coro', coroSeg, targetBpm, namesOf('coro'), 1, false, newPatterns.length + 1);
      newPatterns.push(patPux, patCoro);
      newSlots.push({ slotId: `slot-${newSlots.length + 1}`, puxadorPatternId: patPux.id, coroPatternId: patCoro.id });
      i += 2; continue;
    }
    const simK = findSimultaneousBlockLength(segments, i);
    if (simK >= 2) {
      const blockPux: VocalPatternItem[] = [], blockCoro: VocalPatternItem[] = [];
      for (let m = 0; m < simK; m++) {
        const sA = segments[i + m], sB = segments[i + simK + m];
        const puxSeg = sA.role === 'puxador' ? sA : sB, coroSeg = sA.role === 'coro' ? sA : sB;
        blockPux.push(initPatternFromSegment('puxador', puxSeg, targetBpm, namesOf('puxador', blockPux), (puxSeg.measuresCount ?? 1) as 1 | 2 | 3 | 4, defaultHasAnacrusis, puxSeg.cardIndex ?? (i + m)));
        blockCoro.push(initPatternFromSegment('coro', coroSeg, targetBpm, namesOf('coro', blockCoro), (coroSeg.measuresCount ?? 1) as 1 | 2 | 3 | 4, defaultHasAnacrusis, coroSeg.cardIndex ?? (i + simK + m)));
      }
      newPatterns.push(...blockPux, ...blockCoro);
      for (let m = 0; m < simK; m++) newSlots.push({ slotId: `slot-${newSlots.length + 1}`, puxadorPatternId: blockPux[m].id, coroPatternId: blockCoro[m].id });
      i += 2 * simK; continue;
    }
    let measuresCount: 1 | 2 | 3 | 4 = (seg.measuresCount ?? 1) as 1 | 2 | 3 | 4, lookAhead = i + 1;
    while (lookAhead < segments.length && segments[lookAhead].isLinkedMeasure && measuresCount < 4) { measuresCount = (measuresCount + 1) as 1 | 2 | 3 | 4; lookAhead++; }
    if (seg.isSimultaneousTutti) {
      const patPux = initPatternFromSegment('puxador', seg, targetBpm, namesOf('puxador'), measuresCount, defaultHasAnacrusis, seg.cardIndex ?? newSlots.length);
      const patCoro = initPatternFromSegment('coro', seg, targetBpm, namesOf('coro'), measuresCount, defaultHasAnacrusis, seg.cardIndex ?? newSlots.length);
      newPatterns.push(patPux, patCoro);
      newSlots.push({ slotId: `slot-${newSlots.length + 1}`, puxadorPatternId: patPux.id, coroPatternId: patCoro.id });
    } else {
      const pat = initPatternFromSegment(seg.role, seg, targetBpm, namesOf(seg.role), measuresCount, defaultHasAnacrusis, seg.cardIndex ?? newSlots.length);
      newPatterns.push(pat);
      newSlots.push({ slotId: `slot-${newSlots.length + 1}`, puxadorPatternId: seg.role === 'puxador' ? pat.id : null, coroPatternId: seg.role === 'coro' ? pat.id : null });
    }
    i = lookAhead;
  }
  const patMap = new Map(newPatterns.map((p) => [p.id, p]));
  for (let s = 0; s < newSlots.length - 1; s++) {
    const curPat = patMap.get(newSlots[s].puxadorPatternId || newSlots[s].coroPatternId || ''), nextPat = patMap.get(newSlots[s + 1].puxadorPatternId || newSlots[s + 1].coroPatternId || '');
    const nextAttackBeat = nextPat?.timeAnchors?.find((a) => !a.isRest)?.beat;
    if (curPat?.exitBeat === 1 && curPat?.measuresCount === 2 && nextAttackBeat !== undefined && nextAttackBeat > 1) newSlots[s].advanceMeasures = 1;
    else if (curPat?.measuresCount === 1) newSlots[s].advanceMeasures = 1;
  }
  return { patterns: newPatterns, slots: newSlots };
}
