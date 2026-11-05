/**
 * slicerSegments.types.ts
 * Contrats de données pour la découpe multi-tranches et métriques musicales (< 55 lignes).
 */
import type { VocalRole } from './toadaProject.types';

export interface SliceSegment {
  id: string;
  startSec: number;
  endSec: number;
  metricT1Sec?: number;
  targetPatternId: string; // patternId | 'ignore' | 'new'
  role?: VocalRole;
  name?: string;
  measuresCount?: 1 | 2 | 3 | 4;
  hasAnacrusis?: boolean;
  anacrusisBeats?: number;
  hasTailBeat?: boolean;
}

export type PreAssignMode = 'puxador' | 'coro' | 'all';

export interface BatchAssignProgress {
  current: number;
  total: number;
  patternName: string;
}

export function estimateSegmentMetrics(durSec: number): { measuresCount: 1 | 2 | 3 | 4; hasAnacrusis: boolean; hasTailBeat: boolean } {
  let measuresCount: 1 | 2 | 3 | 4 = 2;
  if (durSec < 3.8) measuresCount = 1;
  else if (durSec < 6.8) measuresCount = 2;
  else if (durSec < 9.5) measuresCount = 3;
  else measuresCount = 4;

  return {
    measuresCount,
    hasAnacrusis: true,
    hasTailBeat: true,
  };
}
