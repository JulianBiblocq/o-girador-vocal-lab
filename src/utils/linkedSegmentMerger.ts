/**
 * linkedSegmentMerger.ts
 * Fusion complète des lignes liées par préfixe `/` (y compris en gras) dans Cantador :
 * concatène fidèlement texte, phonétique, accords (grille multi-mesures) et `timeAnchors`
 * avec décalage exact `measureOffset` (< 145 lignes).
 */
import type { ParsedLyricsSegment, TimeAnchor } from '../types/toadaDocument.types';
import type { PatternHarmonyGrid } from '../types/harmony.types';
import { createHarmonyGridFromChords } from './chordGridHelper';

export interface MergedLinkedSegment extends ParsedLyricsSegment {
  mergedHarmonyGrid?: PatternHarmonyGrid;
}

function joinLinkedTexts(parts: string[]): string {
  let out = '';
  for (const raw of parts) {
    const t = (raw || '').trim();
    if (!t) continue;
    if (!out) out = t;
    else if (out.endsWith('-')) out = `${out.slice(0, -1)}${t}`;
    else out = `${out} ${t}`;
  }
  return out.replace(/\s{2,}/g, ' ').trim();
}

export function mergeBaseWithLinkedSegments(
  base: ParsedLyricsSegment,
  linkedList: ParsedLyricsSegment[]
): { merged: MergedLinkedSegment; measuresCount: 1 | 2 | 3 | 4 } {
  const baseMeasures = Math.max(1, base.measuresCount ?? 1);
  if (linkedList.length === 0) {
    return {
      merged: { ...base },
      measuresCount: Math.min(4, baseMeasures) as 1 | 2 | 3 | 4,
    };
  }

  const texts = [base.text];
  const phonetics = [base.phoneticText || ''];
  const rawCodes = [base.rawLineCode || ''];
  const allChords: string[] = [...(base.chords || [])];
  const mergedAnchors: TimeAnchor[] = (base.timeAnchors || []).map((a) => ({ ...a }));
  const harmonyMeasures: Array<{ measureIndex: number; chordsByBeat: Record<number, string> }> = [];

  const pushSegHarmony = (chords: string[] | undefined, startMeasureIdx: number, mCount: number) => {
    const subGrid = chords?.length ? createHarmonyGridFromChords(chords, mCount) : undefined;
    for (let m = 0; m < mCount; m++) {
      harmonyMeasures.push({
        measureIndex: startMeasureIdx + m,
        chordsByBeat: { ...(subGrid?.measures?.[m]?.chordsByBeat || {}) },
      });
    }
  };

  pushSegHarmony(base.chords, 0, baseMeasures);
  let totalMeasures = baseMeasures;
  let anchorMeasureOffsetBase = (base.hasAnacrusis ? 1 : 0) + baseMeasures;
  let exitBeat = base.exitBeat;

  for (const lnk of linkedList) {
    const lnkM = Math.max(1, lnk.measuresCount ?? 1);
    texts.push(lnk.text);
    if (lnk.phoneticText) phonetics.push(lnk.phoneticText);
    if (lnk.rawLineCode) rawCodes.push(lnk.rawLineCode);
    if (lnk.chords?.length) allChords.push(...lnk.chords);
    pushSegHarmony(lnk.chords, totalMeasures, lnkM);

    const lnkAnaShift = lnk.hasAnacrusis ? -1 : 0;
    for (const a of lnk.timeAnchors || []) {
      const shiftedOffset = Math.max(0, anchorMeasureOffsetBase + (a.measureOffset ?? 0) + lnkAnaShift);
      mergedAnchors.push({
        ...a,
        measureOffset: shiftedOffset,
        isInitialRest: false,
      });
    }
    exitBeat = lnk.exitBeat;
    totalMeasures += lnkM;
    anchorMeasureOffsetBase += lnkM;
  }

  const clampedMeasures = Math.min(4, Math.max(1, totalMeasures)) as 1 | 2 | 3 | 4;
  const mergedPhonetic = phonetics.map((p) => p.trim()).filter(Boolean).join(' ') || undefined;
  const mergedRawCode = rawCodes.filter(Boolean).join('\n') || base.rawLineCode;
  const hasAnyChords = allChords.length > 0;

  return {
    measuresCount: clampedMeasures,
    merged: {
      ...base,
      rawLineCode: mergedRawCode,
      text: joinLinkedTexts(texts),
      phoneticText: mergedPhonetic,
      measuresCount: clampedMeasures,
      chords: hasAnyChords ? allChords : undefined,
      mergedHarmonyGrid: hasAnyChords ? { measures: harmonyMeasures.slice(0, clampedMeasures) } : undefined,
      timeAnchors: mergedAnchors.length > 0 ? mergedAnchors : undefined,
      exitBeat,
    },
  };
}

export function collapseLinkedSegments(segments: ParsedLyricsSegment[]): MergedLinkedSegment[] {
  const out: MergedLinkedSegment[] = [];
  let i = 0;
  while (i < segments.length) {
    const cur = segments[i];
    if (cur.isSilenceSlot) {
      out.push({ ...cur });
      i++;
      continue;
    }
    let accMeasures = Math.max(1, cur.measuresCount ?? 1);
    const linked: ParsedLyricsSegment[] = [];
    let j = i + 1;
    while (j < segments.length && segments[j].isLinkedMeasure && !segments[j].isSilenceSlot && accMeasures < 4) {
      const nextM = Math.max(1, segments[j].measuresCount ?? 1);
      if (accMeasures + nextM > 4) break;
      linked.push(segments[j]);
      accMeasures += nextM;
      j++;
    }
    out.push(mergeBaseWithLinkedSegments(cur, linked).merged);
    i = j;
  }
  return out;
}
