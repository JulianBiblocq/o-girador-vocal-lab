/**
 * melodyneRegionInteractions.ts
 * Logique d'interaction pour les zones Melodyne [ In ── Out ] :
 * Détection de clic sur les poignées IN/OUT, création, redimensionnement et suppression (< 110 lignes).
 */
import type { MelodyneRegion } from '../../types/vocalPack.types';

export type RegionHandleType = 'in' | 'out' | 'body';

export interface RegionHitResult {
  regionId: string;
  handle: RegionHandleType;
}

export function findRegionHandleAt(
  x: number,
  width: number,
  totalDurationSec: number,
  regions: MelodyneRegion[],
  handleTolerancePx = 8
): RegionHitResult | null {
  if (!regions || regions.length === 0 || totalDurationSec <= 0 || width <= 0) return null;

  // Priorité aux poignées IN et OUT des régions
  for (let i = regions.length - 1; i >= 0; i--) {
    const r = regions[i];
    const xIn = (r.startSec / totalDurationSec) * width;
    const xOut = (r.endSec / totalDurationSec) * width;

    if (Math.abs(x - xIn) <= handleTolerancePx) return { regionId: r.id, handle: 'in' };
    if (Math.abs(x - xOut) <= handleTolerancePx) return { regionId: r.id, handle: 'out' };
    if (x >= xIn && x <= xOut) return { regionId: r.id, handle: 'body' };
  }
  return null;
}

export function createNewMelodyneRegion(
  startSec: number,
  endSec: number,
  totalDurationSec: number,
  initialPitchCenter = 50,
  initialFlatten = 50
): MelodyneRegion {
  const safeStart = Math.max(0, Math.min(startSec, endSec));
  const safeEnd = Math.min(totalDurationSec, Math.max(startSec, endSec));
  const minDur = 0.05;
  const clampedEnd = Math.max(safeStart + minDur, safeEnd);

  return {
    id: `mrg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    startSec: Math.round(safeStart * 1000) / 1000,
    endSec: Math.round(clampedEnd * 1000) / 1000,
    pitchCenterPct: initialPitchCenter,
    flattenPct: initialFlatten,
  };
}

export function updateRegionBounds(
  regions: MelodyneRegion[],
  regionId: string,
  newStartSec: number,
  newEndSec: number,
  totalDurationSec: number
): MelodyneRegion[] {
  return regions.map((r) => {
    if (r.id !== regionId) return r;
    const safeStart = Math.max(0, Math.min(totalDurationSec - 0.05, newStartSec));
    const safeEnd = Math.min(totalDurationSec, Math.max(safeStart + 0.05, newEndSec));
    return {
      ...r,
      startSec: Math.round(safeStart * 1000) / 1000,
      endSec: Math.round(safeEnd * 1000) / 1000,
    };
  });
}

export function deleteMelodyneRegion(
  regions: MelodyneRegion[],
  regionId: string
): MelodyneRegion[] {
  return regions.filter((r) => r.id !== regionId);
}
