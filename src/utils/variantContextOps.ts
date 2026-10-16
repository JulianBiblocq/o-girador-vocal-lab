/**
 * variantContextOps.ts
 * Logique pure des variantes audio d'un projet Toada (< 50 lignes).
 */
import type { ToadaProject, VocalAudioVariant } from '../types/toadaProject.types';
import { createDefaultVariant } from '../types/toadaProject.types';
import { propagateSourceUpdatesToLinkedPatterns } from './patternMirrorHelper';

export function applySetActiveVariantKey(project: ToadaProject, patternId: string, variantKey: string): ToadaProject {
  return {
    ...project,
    patterns: project.patterns.map((p) => {
      if (p.id !== patternId) return p;
      const v = p.variants[variantKey];
      return {
        ...p, activeVariantKey: variantKey, recordingResult: v?.recordingResult ?? null,
        trimStartSec: v?.trimStartSec ?? 0, trimEndSec: v?.trimEndSec ?? 0, lowCutEnabled: v?.lowCutEnabled ?? true,
      };
    }),
  };
}

export function applyUpdateVariant(
  project: ToadaProject, patternId: string, variantKey: string, partial: Partial<VocalAudioVariant>
): ToadaProject {
  const updated = project.patterns.map((p) => {
    if (p.id !== patternId) return p;
    const oldV = p.variants[variantKey] ?? createDefaultVariant(1.0, 0);
    const updatedV: VocalAudioVariant = { ...oldV, ...partial };
    const isCurrent = p.activeVariantKey === variantKey;
    return {
      ...p, variants: { ...p.variants, [variantKey]: updatedV },
      recordingResult: isCurrent ? (updatedV.recordingResult ?? null) : p.recordingResult,
      trimStartSec: isCurrent ? updatedV.trimStartSec : p.trimStartSec, trimEndSec: isCurrent ? updatedV.trimEndSec : p.trimEndSec,
    };
  });
  return { ...project, patterns: propagateSourceUpdatesToLinkedPatterns(updated, patternId) };
}

export function applyEnsureVariantExists(
  project: ToadaProject, patternId: string, speedRatio: number, pitchShiftSemitones: number
): { updatedProject: ToadaProject; variantKey: string } {
  const v = createDefaultVariant(speedRatio, pitchShiftSemitones);
  const updatedProject: ToadaProject = {
    ...project,
    patterns: project.patterns.map((p) => (p.id !== patternId || p.variants[v.variantKey] ? p : { ...p, variants: { ...p.variants, [v.variantKey]: v } })),
  };
  return { updatedProject, variantKey: v.variantKey };
}
