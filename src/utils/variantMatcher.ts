/**
 * variantMatcher.ts
 * Paliers conseilles et algorithme de selection anti-distortion
 * pour minimiser l etirement temporel et frequentiel du GrainPlayer.
 */
import type { VocalPatternItem, VocalAudioVariant } from '../types/toadaProject.types';

export interface VariantTierOption {
  speedRatio: number;
  pitchShiftSemitones: number;
  isRecommended: boolean;
  isOptionalTier3: boolean;
}

export const RECOMMENDED_SPEEDS = [1.0, 0.74] as const;
export const OPTIONAL_SPEED_55 = 0.55;

export const RECOMMENDED_PITCHES = [0, -8] as const;
export const OPTIONAL_PITCH_HIGH = 8;

export function getVariantTiers(includeExtraSpeed = false, includeExtraPitch = false): VariantTierOption[] {
  const speeds: number[] = [...RECOMMENDED_SPEEDS];
  if (includeExtraSpeed) speeds.push(OPTIONAL_SPEED_55);

  const pitches: number[] = [...RECOMMENDED_PITCHES];
  if (includeExtraPitch) pitches.push(OPTIONAL_PITCH_HIGH);

  const list: VariantTierOption[] = [];
  for (const s of speeds) {
    for (const p of pitches) {
      const isOptional = s === OPTIONAL_SPEED_55 || p === OPTIONAL_PITCH_HIGH;
      list.push({
        speedRatio: s,
        pitchShiftSemitones: p,
        isRecommended: !isOptional,
        isOptionalTier3: isOptional,
      });
    }
  }
  return list;
}

export function computeVariantDistance(
  targetSpeedRatio: number,
  targetSemitones: number,
  variantSpeedRatio: number,
  variantSemitones: number
): number {
  const speedDiff = Math.abs(targetSpeedRatio - variantSpeedRatio);
  const pitchDiff = Math.abs(targetSemitones - variantSemitones) / 12;
  return speedDiff * 2.0 + pitchDiff;
}

export function findBestAudioVariant(
  pattern: VocalPatternItem,
  targetBpm: number,
  nominalBpm: number,
  targetTransposeSemitones = 0
): VocalAudioVariant | null {
  const allVariants = Object.values(pattern.variants);
  const recorded = allVariants.filter((v) => v.recordingResult !== null);
  if (recorded.length === 0) {
    return pattern.variants[pattern.activeVariantKey] ?? allVariants[0] ?? null;
  }

  const targetRatio = nominalBpm > 0 ? targetBpm / nominalBpm : 1.0;
  let bestVariant = recorded[0];
  let bestDistance = computeVariantDistance(
    targetRatio,
    targetTransposeSemitones,
    bestVariant.speedRatio,
    bestVariant.pitchShiftSemitones
  );

  for (let i = 1; i < recorded.length; i++) {
    const v = recorded[i];
    const dist = computeVariantDistance(targetRatio, targetTransposeSemitones, v.speedRatio, v.pitchShiftSemitones);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestVariant = v;
    }
  }

  return bestVariant;
}
