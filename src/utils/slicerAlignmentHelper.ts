/**
 * slicerAlignmentHelper.ts
 * Helper pur de génération et calquage des tranches sur les motifs Organizador (< 60 lignes).
 */
import type { VocalPatternItem, VocalRole } from '../types/toadaProject.types';
import type { SliceSegment } from '../types/slicerSegments.types';

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

  let prevBodyEnd = gridOffsetSec;
  return targetList.map((pat, idx) => {
    const hasAna = pat.hasAnacrusis !== false;
    const anacBeats = pat.anacrusisBeats ?? (hasAna ? 2 : 0);
    const anacDur = hasAna ? anacBeats * beatDur : 0;
    const mCount = pat.measuresCount ?? 1;

    let t1 = prevBodyEnd;
    if (idx === 0) {
      const d0 = detected[0];
      const estT1 = d0 ? d0.startSec + anacDur * 0.5 : gridOffsetSec;
      t1 = Math.round((estT1 - gridOffsetSec) / measureDur) * measureDur + gridOffsetSec;
    } else {
      // Chercher une île vocale éloignée après un silence franc (> 1.8s)
      const nextDet = detected.find((d) => d.startSec > prevBodyEnd + 1.8);
      if (nextDet) {
        const estT1 = nextDet.startSec + anacDur * 0.5;
        const snapM = Math.round((estT1 - gridOffsetSec) / measureDur) * measureDur + gridOffsetSec;
        t1 = Math.max(prevBodyEnd, snapM);
      }
    }
    t1 = Math.max(anacDur, t1);
    prevBodyEnd = t1 + mCount * measureDur;

    return {
      id: `seg-org-${pat.id}-${idx}`,
      startSec: Math.round((t1 - anacDur) * 100) / 100,
      endSec: Math.round((t1 + mCount * measureDur + beatDur) * 100) / 100,
      targetPatternId: pat.id,
      measuresCount: mCount,
      hasAnacrusis: hasAna,
      anacrusisBeats: anacBeats,
      hasTailBeat: true,
    };
  });
}
