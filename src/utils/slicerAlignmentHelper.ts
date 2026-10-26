/**
 * slicerAlignmentHelper.ts
 * Helper pur de génération et calquage des tranches sur les motifs Organizador (< 60 lignes).
 */
import type { VocalPatternItem, VocalRole } from '../types/toadaProject.types';
import type { SliceSegment } from '../types/slicerSegments.types';

export function calculateSliceMetricT1Sec(
  startSec: number,
  bpm: number,
  gridOffsetSec = 0.8,
  hasAnacrusis = false,
  anacrusisBeats = 2
): number {
  const beatDur = 60 / (bpm || 88);
  const measureDur = beatDur * 4;
  if (hasAnacrusis && anacrusisBeats > 0) {
    const estT1 = startSec + anacrusisBeats * beatDur;
    return Math.max(0, Math.round((estT1 - gridOffsetSec) / measureDur) * measureDur + gridOffsetSec);
  }
  const mIndex = Math.floor((startSec - gridOffsetSec + 0.15) / measureDur);
  return Math.max(0, gridOffsetSec + mIndex * measureDur);
}

export function buildOrganizadorSlices(
  patterns: VocalPatternItem[],
  defaultRole: VocalRole,
  bpm: number,
  detected: SliceSegment[],
  gridOffsetSec = 0.8
): SliceSegment[] {
  const beatDur = 60 / (bpm || 88);
  const measureDur = beatDur * 4;
  const targetRole = defaultRole === 'coro' ? 'coro' : 'puxador';
  const rolePats = patterns.filter((p) => p.role === targetRole);
  const targetList = rolePats.length > 0 ? rolePats : patterns;
  if (targetList.length === 0) return [];

  // 1. Calcul du T1 métrique de chaque bloc sur la grille de mesures
  const metaList: Array<{ pat: VocalPatternItem; t1: number; mCount: number; hasAna: boolean; anacDur: number; isIslandStart: boolean }> = [];
  let prevT1 = gridOffsetSec;
  let prevMCount = targetList[0]?.measuresCount ?? 1;

  targetList.forEach((pat, idx) => {
    const hasAna = pat.hasAnacrusis !== false;
    const anacBeats = pat.anacrusisBeats ?? (hasAna ? 2 : 0);
    const anacDur = hasAna ? anacBeats * beatDur : 0;
    const mCount = pat.measuresCount ?? 1;

    let t1 = prevT1 + (idx === 0 ? 0 : prevMCount * measureDur);
    let isIslandStart = idx === 0;

    if (idx === 0) {
      const d0 = detected[0];
      const estT1 = d0 ? d0.startSec + anacDur * 0.5 : gridOffsetSec;
      t1 = Math.max(anacDur, Math.round((estT1 - gridOffsetSec) / measureDur) * measureDur + gridOffsetSec);
    } else {
      const prevBodyEnd = prevT1 + prevMCount * measureDur;
      // Détection d'un saut franc (> 1.8s de silence) vers une nouvelle île vocale
      const nextDet = detected.find((d) => d.startSec > prevBodyEnd + 1.8);
      if (nextDet) {
        const estT1 = nextDet.startSec + anacDur * 0.5;
        const snapM = Math.round((estT1 - gridOffsetSec) / measureDur) * measureDur + gridOffsetSec;
        if (snapM > prevBodyEnd + measureDur) {
          t1 = snapM;
          isIslandStart = true;
        }
      }
    }

    metaList.push({ pat, t1, mCount, hasAna, anacDur, isIslandStart });
    prevT1 = t1;
    prevMCount = mCount;
  });

  // 2. Définition des bornes [startSec, endSec] avec points de coupe liés (zéro-trou)
  const segments: SliceSegment[] = [];
  for (let i = 0; i < metaList.length; i++) {
    const cur = metaList[i];
    const next = metaList[i + 1];
    const isNextConsecutive = Boolean(next && !next.isIslandStart);

    // Début : si premier bloc d'île, départ à T1 - anacDur. Sinon soudé sur la fin du précédent.
    const startSec = (i === 0 || cur.isIslandStart)
      ? Math.max(0, Math.round((cur.t1 - cur.anacDur) * 100) / 100)
      : segments[i - 1].endSec;

    // Fin : si le bloc suivant est consécutif, point de coupe lié juste après son T1 (tenue)
    let endSec: number;
    if (isNextConsecutive && next) {
      endSec = Math.round((next.t1 + 0.15) * 100) / 100;
    } else {
      endSec = Math.round((cur.t1 + cur.mCount * measureDur + beatDur * 0.75) * 100) / 100;
    }

    segments.push({
      id: `seg-org-${cur.pat.id}-${i}`,
      startSec,
      endSec,
      metricT1Sec: cur.t1,
      targetPatternId: cur.pat.id,
      role: cur.pat.role,
      name: cur.pat.name,
      measuresCount: cur.mCount as 1 | 2 | 3 | 4,
      hasAnacrusis: cur.hasAna,
      anacrusisBeats: cur.pat.anacrusisBeats ?? (cur.hasAna ? 2 : 0),
      hasTailBeat: true,
    });
  }

  return segments;
}
