/**
 * slicerSegments.types.ts
 * Contrats de données pour la découpe multi-tranches et l'assignation aux blocs (< 45 lignes).
 */
import type { VocalRole } from './toadaProject.types';

export interface SliceSegment {
  id: string;
  startSec: number;
  endSec: number;
  targetPatternId: string; // patternId | 'ignore' | 'new'
  role?: VocalRole;
  name?: string;
}

export type PreAssignMode = 'puxador' | 'coro' | 'all';

export interface BatchAssignProgress {
  current: number;
  total: number;
  patternName: string;
}
