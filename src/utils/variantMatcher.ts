/**
 * variantMatcher.ts
 * Aiguillage dynamique par plus proche voisin et minimisation de la distance de distorsion.
 */
import type { VocalPatternItem, VocalAudioVariant } from '../types/toadaProject.types';

export interface BestVariantMatch {
  variant: VocalAudioVariant;
  residualSemitones: number;
  residualRate: number;
  distance: number;
}

export function computeVariantDistance(
  targetBpm: number,
  targetSemitones: number,
  variantBpm: number,
  variantSemitones: number
): number {
  const deltaSemitones = Math.abs(targetSemitones - variantSemitones);
  const bpmRatioDiff = variantBpm > 0 ? Math.abs((targetBpm - variantBpm) / variantBpm) : 0;
  return deltaSemitones * 1.5 + bpmRatioDiff * 12;
}

export function selectBestAudioVariant(
  variants: Record<string, VocalAudioVariant> | VocalAudioVariant[],
  targetSpeedRatio = 1.0,
  targetTransposeSemitones = 0,
  baseBpm = 100
): BestVariantMatch | null {
  const variantList = Array.isArray(variants) ? variants : Object.values(variants);
  if (variantList.length === 0) return null;

  const recorded = variantList.filter((v) => v.recordingResult !== null && (v.recordingResult.pcm?.length ?? 0) > 0);
  const candidates = recorded.length > 0 ? recorded : variantList;
  const targetBpm = baseBpm * targetSpeedRatio;

  let bestCandidate = candidates[0];
  let bestDistance = Infinity;
  let bestResidualSemitones = 0;
  let bestResidualRate = 1.0;

  for (const v of candidates) {
    const variantBpm = baseBpm * (v.speedRatio || 1.0);
    const dist = computeVariantDistance(targetBpm, targetTransposeSemitones, variantBpm, v.pitchShiftSemitones);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestCandidate = v;
      bestResidualSemitones = targetTransposeSemitones - v.pitchShiftSemitones;
      bestResidualRate = variantBpm > 0 ? (targetBpm / variantBpm) : 1.0;
    }
  }

  return {
    variant: bestCandidate,
    residualSemitones: bestResidualSemitones,
    residualRate: bestResidualRate,
    distance: bestDistance,
  };
}

export function findBestAudioVariant(
  pattern: VocalPatternItem,
  targetBpm: number,
  nominalBpm: number,
  targetTransposeSemitones = 0
): VocalAudioVariant | null {
  const targetSpeedRatio = nominalBpm > 0 ? targetBpm / nominalBpm : 1.0;
  const match = selectBestAudioVariant(pattern.variants, targetSpeedRatio, targetTransposeSemitones, nominalBpm);
  return match?.variant ?? pattern.variants[pattern.activeVariantKey] ?? null;
}
