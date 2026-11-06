/**
 * slicerAlignmentHelper.ts
 * Calquage des tranches sur les motifs Organizador, gestion des trous Puxador/Coro (with_gaps vs chained)
 * et auto-calage T1 par corrélation croisée (< 138 lignes).
 */
import type { VocalPatternItem, VocalRole, ToadaArrangementSlot } from '../types/toadaProject.types';
import type { TimeAnchor } from '../types/toadaDocument.types';
import type { SliceSegment } from '../types/slicerSegments.types';
import { resolveFreshTimeAnchors } from './timeAnchorParser';
import { computePatternVocalOffsetsBeats } from './subbeatAnchorHelper';
import { findOptimalAcousticCutSec, findOptimalMasterGridOffsetSec } from './slicerBoundaryOptimizer';

export { findOptimalAcousticCutSec, findOptimalMasterGridOffsetSec };
export type SlicerGapMode = 'with_gaps' | 'chained';

function windowRms(pcm: Float32Array, sampleRate: number, t0: number, t1: number): number {
  const i0 = Math.max(0, Math.floor(t0 * sampleRate)), i1 = Math.min(pcm.length, Math.ceil(t1 * sampleRate));
  if (i1 <= i0) return 0;
  let sumSq = 0; for (let i = i0; i < i1; i++) sumSq += pcm[i] * pcm[i];
  return Math.sqrt(sumSq / (i1 - i0));
}

export function alignT1ByAnchorCrossCorrelation(
  pcm: Float32Array | null | undefined, sampleRate: number, nominalT1Sec: number, bpm: number,
  timeAnchors: TimeAnchor[] | undefined, hasAnacrusis: boolean, beatsPerMeasure = 4, maxShiftSec = 0.35
): number {
  if (!pcm || pcm.length === 0 || sampleRate <= 0 || !timeAnchors || timeAnchors.length === 0) return nominalT1Sec;
  const sung = timeAnchors.filter((a) => !a.isRest && !a.isInitialRest && !a.isSustainedHold && (a.syllables?.length ?? 0) > 0);
  if (sung.length === 0) return nominalT1Sec;
  const beatDur = 60 / (bpm || 88), pulses: Array<{ relSec: number; weight: number; durSec: number }> = [];
  for (const a of sung) {
    const relBeat = (hasAnacrusis ? a.measureOffset - 1 : a.measureOffset) * beatsPerMeasure + (a.beat - 1);
    const subdivs = a.syllableSubdivs?.length ? a.syllableSubdivs : [a.hasLeadingRest ? 1 : 0];
    for (const s of subdivs) pulses.push({ relSec: (relBeat + s / 4) * beatDur, weight: relBeat === 0 && s === 0 ? 1.8 : (s === 0 ? 1.25 : 0.9), durSec: Math.max(0.06, beatDur * 0.22) });
  }
  if (pulses.length === 0) return nominalT1Sec;
  let bestDelta = 0, bestScore = -Infinity;
  for (let dt = -maxShiftSec; dt <= maxShiftSec + 1e-6; dt += 0.01) {
    const candT1 = nominalT1Sec + dt; if (candT1 < 0) continue;
    let corr = 0;
    for (const p of pulses) {
      const t = candT1 + p.relSec, eCur = windowRms(pcm, sampleRate, t, t + p.durSec), ePre = windowRms(pcm, sampleRate, Math.max(0, t - 0.07), t);
      corr += p.weight * (Math.max(0, eCur - 0.55 * ePre) + 0.45 * eCur);
    }
    const score = corr * (1 - 0.08 * ((dt / Math.max(0.01, maxShiftSec)) ** 2));
    if (score > bestScore) { bestScore = score; bestDelta = dt; }
  }
  return Math.max(0, Math.round((nominalT1Sec + bestDelta) * 1000) / 1000);
}

export function calculateSliceMetricT1Sec(
  startSec: number, bpm: number, gridOffsetSec = 0.8, hasAnacrusis = false, anacrusisBeats = 2,
  existingMetricT1Sec?: number, firstVocalOffsetBeats?: number
): number {
  const beatDur = 60 / (bpm || 88), measureDur = beatDur * 4, anacDur = hasAnacrusis && anacrusisBeats > 0 ? anacrusisBeats * beatDur : 0;
  const postT1VocalDur = typeof firstVocalOffsetBeats === 'number' && firstVocalOffsetBeats > 0 ? firstVocalOffsetBeats * beatDur : 0;
  if (typeof existingMetricT1Sec === 'number' && existingMetricT1Sec >= 0 && startSec >= existingMetricT1Sec - anacDur - 0.45 * measureDur && startSec <= existingMetricT1Sec + postT1VocalDur + 0.65 * measureDur) {
    return existingMetricT1Sec;
  }
  const refT1Sec = postT1VocalDur > 0 ? startSec - postT1VocalDur : startSec + anacDur;
  return Math.max(0, Math.round((refT1Sec - gridOffsetSec) / measureDur) * measureDur + gridOffsetSec);
}

export function splitSliceSegment(seg: SliceSegment, cutSec: number, bpm: number, gridOffsetSec = 0.8): [SliceSegment, SliceSegment] {
  const beatDur = 60 / (bpm || 88), measureDur = beatDur * 4, cut = Math.round(Math.max(seg.startSec + 0.2, Math.min(seg.endSec - 0.2, cutSec)) * 100) / 100;
  const s1T1 = seg.metricT1Sec ?? calculateSliceMetricT1Sec(seg.startSec, bpm, gridOffsetSec, seg.hasAnacrusis, seg.anacrusisBeats);
  const s1M = Math.min(4, Math.max(1, Math.round((cut - s1T1) / measureDur) || 1)) as 1 | 2 | 3 | 4;
  const s2T1 = calculateSliceMetricT1Sec(cut, bpm, gridOffsetSec, false, 0);
  const s2M = Math.min(4, Math.max(1, Math.round((seg.endSec - s2T1 - 0.1) / measureDur) || 1)) as 1 | 2 | 3 | 4;
  const s2HasAna = cut < s2T1 - 0.15, s2AnaBeats = s2HasAna ? Math.min(4, Math.max(1, Math.round((s2T1 - cut) / beatDur))) : 0;
  return [
    { ...seg, id: `${seg.id}-a`, endSec: cut, metricT1Sec: s1T1, measuresCount: s1M },
    { ...seg, id: `seg-${Date.now()}-b`, startSec: cut, metricT1Sec: s2T1, measuresCount: s2M, hasAnacrusis: s2HasAna, anacrusisBeats: s2AnaBeats, targetPatternId: 'new' },
  ];
}

export function mergeAdjacentSliceSegments(segA: SliceSegment, segB: SliceSegment, bpm: number, gridOffsetSec = 0.8): SliceSegment {
  const beatDur = 60 / (bpm || 88), measureDur = beatDur * 4, startSec = Math.min(segA.startSec, segB.startSec), endSec = Math.max(segA.endSec, segB.endSec);
  const metricT1Sec = segA.metricT1Sec ?? calculateSliceMetricT1Sec(startSec, bpm, gridOffsetSec, segA.hasAnacrusis, segA.anacrusisBeats);
  const measuresCount = Math.min(4, Math.max(1, Math.round((endSec - metricT1Sec - 0.15) / measureDur) || 1)) as 1 | 2 | 3 | 4;
  return { ...segA, startSec, endSec, metricT1Sec, measuresCount };
}

function computeGapMeasuresInSlots(slots: ToadaArrangementSlot[] | undefined, allPatterns: VocalPatternItem[], prevPatId: string | null, curPatId: string): number {
  if (!slots || slots.length === 0) return 0;
  const i1 = prevPatId ? slots.findIndex((s) => s.puxadorPatternId === prevPatId || s.coroPatternId === prevPatId) : -1;
  const i2 = slots.findIndex((s, idx) => idx > i1 && (s.puxadorPatternId === curPatId || s.coroPatternId === curPatId));
  if (i2 < 0) return 0;
  let gapM = 0;
  for (let k = i1 + 1; k < i2; k++) {
    const pux = slots[k].puxadorPatternId ? allPatterns.find((p) => p.id === slots[k].puxadorPatternId) : undefined;
    const cor = slots[k].coroPatternId ? allPatterns.find((p) => p.id === slots[k].coroPatternId) : undefined;
    gapM += Math.max(pux?.measuresCount ?? 0, cor?.measuresCount ?? 0, Math.max(1, Math.min(8, slots[k].advanceMeasures ?? 1)));
  }
  return gapM;
}

export function buildOrganizadorSlices(
  patterns: VocalPatternItem[], defaultRole: VocalRole, bpm: number, detected: SliceSegment[],
  gridOffsetSec = 0.8, slots?: ToadaArrangementSlot[], pcm?: Float32Array | null, sampleRate = 44100, gapMode: SlicerGapMode = 'with_gaps'
): SliceSegment[] {
  const beatDur = 60 / (bpm || 88), measureDur = beatDur * 4;
  const rolePats = patterns.filter((p) => p.role === (defaultRole === 'coro' ? 'coro' : 'puxador')), targetList = rolePats.length > 0 ? rolePats : patterns;
  if (targetList.length === 0) return [];
  const metaList: Array<{ pat: VocalPatternItem; t1: number; mCount: number; hasAna: boolean; anacDur: number; isIslandStart: boolean; pauseMeasures: number; pauseStartT1: number; firstVocalOffsetBeats: number; hasBoundaryExitAnchor: boolean }> = [];
  let prevT1 = gridOffsetSec, prevMCount = 0;

  targetList.forEach((pat, idx) => {
    const anchors = resolveFreshTimeAnchors(pat.rawLineCode, pat.timeAnchors, 4, pat.hasAnacrusis === false, pat.assignedLyricsText);
    const isTheticByAnchors = Boolean(anchors && anchors.length > 0 && anchors[0].beat === 1 && anchors[0].measureOffset === 0);
    const hasAna = isTheticByAnchors ? false : pat.hasAnacrusis !== false, anacDur = hasAna ? (pat.anacrusisBeats ?? 2) * beatDur : 0, mCount = pat.measuresCount ?? 1;
    const { firstVocalOffsetBeats, hasBoundaryExitAnchor } = computePatternVocalOffsetsBeats(anchors, hasAna, 4, mCount);
    const pauseMeasures = gapMode === 'with_gaps' ? computeGapMeasuresInSlots(slots, patterns, idx > 0 ? targetList[idx - 1].id : null, pat.id) : 0;
    const pauseStartT1 = idx === 0 ? gridOffsetSec : prevT1 + prevMCount * measureDur;
    let t1 = pauseStartT1 + pauseMeasures * measureDur, isIslandStart = idx === 0 || pauseMeasures > 0;
    const detOffsetSec = firstVocalOffsetBeats > 0 ? -firstVocalOffsetBeats * beatDur : anacDur * 0.5;
    if (gapMode === 'chained' && detected[idx]) {
      const snapM = Math.max(anacDur, Math.round((detected[idx].startSec + detOffsetSec - gridOffsetSec) / measureDur) * measureDur + gridOffsetSec);
      if (idx === 0 || snapM >= prevT1 + prevMCount * measureDur) { t1 = snapM; isIslandStart = idx === 0 || snapM > prevT1 + prevMCount * measureDur; }
    } else if (idx === 0 && pauseMeasures === 0 && detected[0]) {
      t1 = Math.max(anacDur, Math.round((detected[0].startSec + detOffsetSec - gridOffsetSec) / measureDur) * measureDur + gridOffsetSec);
    }
    metaList.push({ pat, t1, mCount, hasAna, anacDur, isIslandStart, pauseMeasures, pauseStartT1, firstVocalOffsetBeats, hasBoundaryExitAnchor });
    prevT1 = t1; prevMCount = mCount;
  });

  const segments: SliceSegment[] = [];
  for (let i = 0; i < metaList.length; i++) {
    const cur = metaList[i], next = metaList[i + 1];
    if (cur.pauseMeasures > 0) {
      const pM = Math.max(1, Math.min(4, cur.pauseMeasures)) as 1 | 2 | 3 | 4;
      segments.push({ id: `seg-pause-org-${i}`, startSec: Math.round(cur.pauseStartT1 * 100) / 100, endSec: Math.round((cur.pauseStartT1 + cur.pauseMeasures * measureDur) * 100) / 100, metricT1Sec: Math.round(cur.pauseStartT1 * 100) / 100, targetPatternId: 'ignore', name: `[PAUSE ${cur.pauseMeasures}M]`, measuresCount: pM, hasAnacrusis: false, anacrusisBeats: 0, hasTailBeat: false, isPause: true });
    }
    const prevVocalSeg = segments.length > 0 ? segments[segments.length - 1] : null;
    const isolatedStartSec = cur.hasAna ? Math.max(0, Math.round((cur.t1 + (cur.firstVocalOffsetBeats - 0.25) * beatDur) * 100) / 100) : Math.max(0, Math.round(cur.t1 * 100) / 100);
    const startSec = (i === 0 || cur.isIslandStart || !prevVocalSeg || prevVocalSeg.isPause) ? isolatedStartSec : prevVocalSeg.endSec;
    const endSec = Boolean(next && !next.isIslandStart) && next
      ? findOptimalAcousticCutSec({ boundaryT1Sec: next.t1, beatDur, nextFirstVocalOffsetBeats: next.firstVocalOffsetBeats, curHasBoundaryExit: cur.hasBoundaryExitAnchor, pcm, sampleRate })
      : Math.round((cur.t1 + cur.mCount * measureDur + beatDur * 0.75) * 100) / 100;
    segments.push({ id: `seg-org-${cur.pat.id}-${i}`, startSec, endSec, metricT1Sec: cur.t1, targetPatternId: cur.pat.id, role: cur.pat.role, name: cur.pat.name, measuresCount: cur.mCount as 1 | 2 | 3 | 4, hasAnacrusis: cur.hasAna, anacrusisBeats: cur.pat.anacrusisBeats ?? (cur.hasAna ? 2 : 0), hasTailBeat: true });
  }
  return segments;
}
