/**
 * slicerAlignmentHelper.ts
 * Helper pur de génération et calquage des tranches sur les motifs Organizador et pauses Bateria (< 140 lignes).
 */
import type { VocalPatternItem, VocalRole, ToadaArrangementSlot } from '../types/toadaProject.types';
import type { SliceSegment } from '../types/slicerSegments.types';

export function calculateSliceMetricT1Sec(
  startSec: number, bpm: number, gridOffsetSec = 0.8, hasAnacrusis = false, anacrusisBeats = 2, existingMetricT1Sec?: number
): number {
  const beatDur = 60 / (bpm || 88), measureDur = beatDur * 4;
  const anacDur = hasAnacrusis && anacrusisBeats > 0 ? anacrusisBeats * beatDur : 0;
  if (typeof existingMetricT1Sec === 'number' && existingMetricT1Sec >= 0) {
    if (startSec >= existingMetricT1Sec - anacDur - 0.45 * measureDur && startSec <= existingMetricT1Sec + 0.65 * measureDur) return existingMetricT1Sec;
  }
  const estT1 = startSec + anacDur;
  return Math.max(0, Math.round((estT1 - gridOffsetSec) / measureDur) * measureDur + gridOffsetSec);
}

export function splitSliceSegment(
  seg: SliceSegment, cutSec: number, bpm: number, gridOffsetSec = 0.8
): [SliceSegment, SliceSegment] {
  const beatDur = 60 / (bpm || 88), measureDur = beatDur * 4;
  const cut = Math.round(Math.max(seg.startSec + 0.2, Math.min(seg.endSec - 0.2, cutSec)) * 100) / 100;
  const s1T1 = seg.metricT1Sec ?? calculateSliceMetricT1Sec(seg.startSec, bpm, gridOffsetSec, seg.hasAnacrusis, seg.anacrusisBeats);
  const s1M = Math.min(4, Math.max(1, Math.round((cut - s1T1) / measureDur) || 1)) as 1 | 2 | 3 | 4;
  const s2T1 = calculateSliceMetricT1Sec(cut, bpm, gridOffsetSec, false, 0);
  const s2M = Math.min(4, Math.max(1, Math.round((seg.endSec - s2T1 - 0.1) / measureDur) || 1)) as 1 | 2 | 3 | 4;
  const s2HasAna = cut < s2T1 - 0.15;
  const s2AnaBeats = s2HasAna ? Math.min(4, Math.max(1, Math.round((s2T1 - cut) / beatDur))) : 0;
  return [
    { ...seg, id: `${seg.id}-a`, endSec: cut, metricT1Sec: s1T1, measuresCount: s1M },
    { ...seg, id: `seg-${Date.now()}-b`, startSec: cut, metricT1Sec: s2T1, measuresCount: s2M, hasAnacrusis: s2HasAna, anacrusisBeats: s2AnaBeats, targetPatternId: 'new' },
  ];
}

export function mergeAdjacentSliceSegments(
  segA: SliceSegment, segB: SliceSegment, bpm: number, gridOffsetSec = 0.8
): SliceSegment {
  const beatDur = 60 / (bpm || 88), measureDur = beatDur * 4;
  const startSec = Math.min(segA.startSec, segB.startSec), endSec = Math.max(segA.endSec, segB.endSec);
  const metricT1Sec = segA.metricT1Sec ?? calculateSliceMetricT1Sec(startSec, bpm, gridOffsetSec, segA.hasAnacrusis, segA.anacrusisBeats);
  const measuresCount = Math.min(4, Math.max(1, Math.round((endSec - metricT1Sec - 0.15) / measureDur) || 1)) as 1 | 2 | 3 | 4;
  return { ...segA, startSec, endSec, metricT1Sec, measuresCount };
}

function computePauseMeasuresBetweenPatterns(
  slots: ToadaArrangementSlot[] | undefined, prevPatId: string, curPatId: string
): number {
  if (!slots || slots.length === 0) return 0;
  const i1 = slots.findIndex((s) => s.puxadorPatternId === prevPatId || s.coroPatternId === prevPatId);
  const i2 = slots.findIndex((s, idx) => idx > i1 && (s.puxadorPatternId === curPatId || s.coroPatternId === curPatId));
  if (i1 < 0 || i2 < 0) return 0;
  let pauseMeasures = 0;
  for (let k = i1 + 1; k < i2; k++) {
    if (!slots[k].puxadorPatternId && !slots[k].coroPatternId) {
      pauseMeasures += Math.max(1, Math.min(8, slots[k].advanceMeasures ?? 1));
    }
  }
  return pauseMeasures;
}

export function buildOrganizadorSlices(
  patterns: VocalPatternItem[],
  defaultRole: VocalRole,
  bpm: number,
  detected: SliceSegment[],
  gridOffsetSec = 0.8,
  slots?: ToadaArrangementSlot[]
): SliceSegment[] {
  const beatDur = 60 / (bpm || 88), measureDur = beatDur * 4;
  const targetRole = defaultRole === 'coro' ? 'coro' : 'puxador';
  const rolePats = patterns.filter((p) => p.role === targetRole);
  const targetList = rolePats.length > 0 ? rolePats : patterns;
  if (targetList.length === 0) return [];

  const metaList: Array<{ pat: VocalPatternItem; t1: number; mCount: number; hasAna: boolean; anacDur: number; isIslandStart: boolean }> = [];
  let prevT1 = gridOffsetSec, prevMCount = targetList[0]?.measuresCount ?? 1;

  targetList.forEach((pat, idx) => {
    const hasAna = pat.hasAnacrusis !== false;
    const anacBeats = pat.anacrusisBeats ?? (hasAna ? 2 : 0);
    const anacDur = hasAna ? anacBeats * beatDur : 0;
    const mCount = pat.measuresCount ?? 1;
    const pauseMeasures = idx > 0 ? computePauseMeasuresBetweenPatterns(slots, targetList[idx - 1].id, pat.id) : 0;

    let t1 = prevT1 + (idx === 0 ? 0 : (prevMCount + pauseMeasures) * measureDur);
    let isIslandStart = idx === 0 || pauseMeasures > 0;

    if (idx === 0) {
      const d0 = detected[0];
      const estT1 = d0 ? d0.startSec + anacDur * 0.5 : gridOffsetSec;
      t1 = Math.max(anacDur, Math.round((estT1 - gridOffsetSec) / measureDur) * measureDur + gridOffsetSec);
    } else if (pauseMeasures === 0) {
      const prevBodyEnd = prevT1 + prevMCount * measureDur;
      const nextDet = detected.find((d) => d.startSec > prevBodyEnd + 1.8);
      if (nextDet) {
        const estT1 = nextDet.startSec + anacDur * 0.5;
        const snapM = Math.round((estT1 - gridOffsetSec) / measureDur) * measureDur + gridOffsetSec;
        if (snapM > prevBodyEnd + measureDur) { t1 = snapM; isIslandStart = true; }
      }
    }

    metaList.push({ pat, t1, mCount, hasAna, anacDur, isIslandStart });
    prevT1 = t1; prevMCount = mCount;
  });

  const segments: SliceSegment[] = [];
  for (let i = 0; i < metaList.length; i++) {
    const cur = metaList[i], next = metaList[i + 1];
    const isNextConsecutive = Boolean(next && !next.isIslandStart);
    const startSec = (i === 0 || cur.isIslandStart)
      ? Math.max(0, Math.round((cur.t1 - cur.anacDur) * 100) / 100)
      : segments[i - 1].endSec;
    const endSec = isNextConsecutive && next
      ? Math.round((next.t1 + 0.15) * 100) / 100
      : Math.round((cur.t1 + cur.mCount * measureDur + beatDur * 0.75) * 100) / 100;

    segments.push({
      id: `seg-org-${cur.pat.id}-${i}`, startSec, endSec, metricT1Sec: cur.t1,
      targetPatternId: cur.pat.id, role: cur.pat.role, name: cur.pat.name,
      measuresCount: cur.mCount as 1 | 2 | 3 | 4, hasAnacrusis: cur.hasAna,
      anacrusisBeats: cur.pat.anacrusisBeats ?? (cur.hasAna ? 2 : 0), hasTailBeat: true,
    });
  }
  return segments;
}
