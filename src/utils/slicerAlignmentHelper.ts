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
  const beatDur = 60 / (bpm || 55);
  const measureDur = beatDur * 4;
  const targetRole = defaultRole === 'coro' ? 'coro' : 'puxador';
  const rolePats = patterns.filter((p) => p.role === targetRole);
  const targetList = rolePats.length > 0 ? rolePats : patterns;

  return targetList.map((pat, idx) => {
    const hasAna = pat.hasAnacrusis !== false;
    const anacDur = hasAna ? measureDur : 0;
    const mCount = pat.measuresCount ?? 2;
    const det = detected[idx];

    let t1 = gridOffsetSec + idx * (mCount + 2) * measureDur;
    if (det) {
      const estT1 = hasAna ? det.startSec + measureDur * 0.75 : det.startSec;
      t1 = Math.round((estT1 - gridOffsetSec) / measureDur) * measureDur + gridOffsetSec;
    }
    t1 = Math.max(anacDur, t1);

    return {
      id: `seg-org-${pat.id}-${idx}`,
      startSec: Math.round((t1 - anacDur) * 100) / 100,
      endSec: Math.round((t1 + mCount * measureDur + beatDur) * 100) / 100,
      targetPatternId: pat.id,
      measuresCount: mCount,
      hasAnacrusis: hasAna,
      hasTailBeat: true,
    };
  });
}
