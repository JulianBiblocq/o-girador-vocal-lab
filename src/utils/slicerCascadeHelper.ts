/**
 * slicerCascadeHelper.ts
 * Opérations en cascade pour le Banc de Découpe (Slicer) : insertion/déplacement de pauses [PAUSE XM],
 * insertion de tranches et décalage en mesures (-1M / +1M) sans perte des assignations targetPatternId (< 130 lignes).
 */
import type { SliceSegment } from '../types/slicerSegments.types';

export function getMeasureDurationSec(bpm: number): number {
  return (60 / (bpm > 0 ? bpm : 88)) * 4;
}

export function shiftSegmentTime(seg: SliceSegment, deltaSec: number): SliceSegment {
  const dur = Math.max(0.2, seg.endSec - seg.startSec);
  const newStart = Math.max(0, Math.round((seg.startSec + deltaSec) * 100) / 100);
  const actualDelta = newStart - seg.startSec;
  const newEnd = Math.round((newStart + dur) * 100) / 100;
  const newT1 = seg.metricT1Sec !== undefined ? Math.max(0, Math.round((seg.metricT1Sec + actualDelta) * 100) / 100) : undefined;
  return { ...seg, startSec: newStart, endSec: newEnd, metricT1Sec: newT1 };
}

export function shiftSliceAndFollowingByMeasures(segments: SliceSegment[], startIndex: number, deltaMeasures: number, bpm: number): SliceSegment[] {
  if (startIndex < 0 || startIndex >= segments.length || deltaMeasures === 0) return segments;
  const deltaSec = deltaMeasures * getMeasureDurationSec(bpm);
  return segments.map((s, idx) => (idx >= startIndex ? shiftSegmentTime(s, deltaSec) : s));
}

function resolveInsertionT1(segments: SliceSegment[], clampedIdx: number, measureDur: number, gridOffsetSec: number): number {
  if (clampedIdx < segments.length) return segments[clampedIdx].metricT1Sec ?? segments[clampedIdx].startSec;
  if (segments.length > 0) {
    const last = segments[segments.length - 1];
    return (last.metricT1Sec ?? last.startSec) + (last.measuresCount ?? 2) * measureDur;
  }
  return gridOffsetSec;
}

export function insertPauseInSlices(
  segments: SliceSegment[], insertAtIndex: number, pauseMeasures: 1 | 2 | 3 | 4 = 1, bpm: number = 88, gridOffsetSec: number = 0
): SliceSegment[] {
  const clampedIdx = Math.max(0, Math.min(segments.length, insertAtIndex));
  const measureDur = getMeasureDurationSec(bpm), pauseDur = pauseMeasures * measureDur;
  const pauseT1 = resolveInsertionT1(segments, clampedIdx, measureDur, gridOffsetSec);
  const pauseSeg: SliceSegment = {
    id: `seg_pause_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    startSec: Math.round(pauseT1 * 100) / 100,
    endSec: Math.round((pauseT1 + pauseDur) * 100) / 100,
    metricT1Sec: Math.round(pauseT1 * 100) / 100,
    targetPatternId: 'ignore', name: `[PAUSE ${pauseMeasures}M]`,
    measuresCount: pauseMeasures, hasAnacrusis: false, anacrusisBeats: 0, hasTailBeat: false, isPause: true,
  };
  return [...segments.slice(0, clampedIdx), pauseSeg, ...segments.slice(clampedIdx).map((s) => shiftSegmentTime(s, pauseDur))];
}

export function insertVocalSliceAt(
  segments: SliceSegment[], insertAtIndex: number, measuresCount: 1 | 2 | 3 | 4 = 2, bpm: number = 88, gridOffsetSec: number = 0
): SliceSegment[] {
  const clampedIdx = Math.max(0, Math.min(segments.length, insertAtIndex));
  const beatDur = 60 / (bpm > 0 ? bpm : 88), measureDur = beatDur * 4, shiftDur = measuresCount * measureDur;
  const sliceT1 = resolveInsertionT1(segments, clampedIdx, measureDur, gridOffsetSec);
  const startSec = Math.max(0, Math.round((sliceT1 - 2 * beatDur) * 100) / 100);
  const endSec = Math.round((sliceT1 + shiftDur + beatDur) * 100) / 100;
  const newSlice: SliceSegment = {
    id: `seg_ins_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    startSec, endSec, metricT1Sec: Math.round(sliceT1 * 100) / 100,
    targetPatternId: 'new', measuresCount, hasAnacrusis: true, anacrusisBeats: 2, hasTailBeat: true, isPause: false,
  };
  return [...segments.slice(0, clampedIdx), newSlice, ...segments.slice(clampedIdx).map((s) => shiftSegmentTime(s, shiftDur))];
}

export function updatePauseMeasuresWithCascade(segments: SliceSegment[], pauseIndex: number, newMeasures: 1 | 2 | 3 | 4, bpm: number): SliceSegment[] {
  const target = segments[pauseIndex];
  if (!target) return segments;
  const deltaMeasures = newMeasures - (target.measuresCount ?? 1);
  if (deltaMeasures === 0) return segments;
  const deltaSec = deltaMeasures * getMeasureDurationSec(bpm);
  return segments.map((s, idx) => {
    if (idx === pauseIndex) {
      return { ...s, measuresCount: newMeasures, name: s.isPause ? `[PAUSE ${newMeasures}M]` : s.name, endSec: Math.round((s.endSec + deltaSec) * 100) / 100 };
    }
    return idx > pauseIndex ? shiftSegmentTime(s, deltaSec) : s;
  });
}

export function deleteSliceWithCascade(segments: SliceSegment[], deleteIndex: number, bpm: number, shouldCascade: boolean = true): SliceSegment[] {
  const target = segments[deleteIndex];
  if (!target) return segments;
  if (!target.isPause && !shouldCascade) return segments.filter((_, idx) => idx !== deleteIndex);
  const deltaSec = -((target.measuresCount ?? 1) * getMeasureDurationSec(bpm));
  return segments.filter((_, idx) => idx !== deleteIndex).map((s, idx) => (idx >= deleteIndex ? shiftSegmentTime(s, deltaSec) : s));
}

export function reorderSlicesWithCascade(segments: SliceSegment[], fromIndex: number, toIndex: number, bpm: number): SliceSegment[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= segments.length || toIndex >= segments.length || fromIndex === toIndex) return segments;
  const measureDur = getMeasureDurationSec(bpm), moved = segments[fromIndex], movedSpanSec = (moved.measuresCount ?? 2) * measureDur;
  if (toIndex < fromIndex) {
    const anchorT1 = segments[toIndex].metricT1Sec ?? segments[toIndex].startSec, movedOldT1 = moved.metricT1Sec ?? moved.startSec;
    const shiftedMoved = shiftSegmentTime(moved, anchorT1 - movedOldT1), res: SliceSegment[] = [];
    for (let i = 0; i < segments.length; i++) {
      if (i === toIndex) res.push(shiftedMoved);
      if (i !== fromIndex) res.push(i >= toIndex && i < fromIndex ? shiftSegmentTime(segments[i], movedSpanSec) : segments[i]);
    }
    return res;
  }
  const jumpedMeasures = segments.slice(fromIndex + 1, toIndex + 1).reduce((acc, s) => acc + (s.measuresCount ?? 2), 0);
  const shiftedMoved = shiftSegmentTime(moved, jumpedMeasures * measureDur), res: SliceSegment[] = [];
  for (let i = 0; i < segments.length; i++) {
    if (i !== fromIndex) res.push(i > fromIndex && i <= toIndex ? shiftSegmentTime(segments[i], -movedSpanSec) : segments[i]);
    if (i === toIndex) res.push(shiftedMoved);
  }
  return res;
}
