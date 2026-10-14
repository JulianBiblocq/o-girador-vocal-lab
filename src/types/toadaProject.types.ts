/**
 * toadaProject.types.ts
 * Modele de donnees de la Toada complete :
 * Multi-patterns (Puxador / Coro), Matrice de Declinaisons Audio & Frise Conducteur.
 */
import type { TimeSignatureString, VocalStepData, PitchCurvePoint, VocalPackExport } from './vocalPack.types';

export type VocalRole = 'puxador' | 'coro';

export interface VocalAudioVariantCoverage {
  minBpmRatio: number;
  maxBpmRatio: number;
  minSemitones: number;
  maxSemitones: number;
}

export interface VocalAudioVariant {
  variantKey: string;
  speedRatio: number;
  pitchShiftSemitones: number;
  coverage: VocalAudioVariantCoverage;
  recordingResult: { pcm: Float32Array; sampleRate: number } | null;
  trimStartSec: number;
  trimEndSec: number;
  lowCutEnabled: boolean;
}

export interface VocalPatternItem {
  id: string;
  name: string;
  role: VocalRole;
  measuresCount: 1 | 2 | 3 | 4;
  variants: Record<string, VocalAudioVariant>;
  activeVariantKey: string;
  recordingResult: { pcm: Float32Array; sampleRate: number } | null;
  trimStartSec: number;
  trimEndSec: number;
  lowCutEnabled: boolean;
  anacrusisSteps: VocalStepData[];
  mainSteps: VocalStepData[];
  pitchCurve: PitchCurvePoint[];
  pack?: VocalPackExport | null;
}

export interface ToadaArrangementSlot {
  slotId: string;
  puxadorPatternId: string | null;
  coroPatternId: string | null;
}

export interface ToadaProject {
  id: string;
  title: string;
  bpm: number;
  timeSignature: TimeSignatureString;
  patterns: VocalPatternItem[];
  slots: ToadaArrangementSlot[];
  activePatternId: string;
}

export function computeVariantCoverage(speedRatio: number, pitchShiftSemitones: number): VocalAudioVariantCoverage {
  let minBpmRatio = 0.87; let maxBpmRatio = 1.15;
  if (speedRatio <= 0.60) { minBpmRatio = 0.45; maxBpmRatio = 0.60; }
  else if (speedRatio <= 0.80) { minBpmRatio = 0.60; maxBpmRatio = 0.87; }

  let minSemitones = -4; let maxSemitones = 4;
  if (pitchShiftSemitones <= -6) { minSemitones = -12; maxSemitones = -5; }
  else if (pitchShiftSemitones >= 6) { minSemitones = 5; maxSemitones = 12; }

  return { minBpmRatio, maxBpmRatio, minSemitones, maxSemitones };
}

export function makeVariantKey(speedRatio: number, pitchShiftSemitones: number): string {
  const spd = Math.round(speedRatio * 100);
  const pit = pitchShiftSemitones >= 0 ? `+${pitchShiftSemitones}` : `${pitchShiftSemitones}`;
  return `spd${spd}_pit${pit}`;
}

export function createDefaultVariant(speedRatio: number, pitchShiftSemitones: number): VocalAudioVariant {
  return {
    variantKey: makeVariantKey(speedRatio, pitchShiftSemitones),
    speedRatio,
    pitchShiftSemitones,
    coverage: computeVariantCoverage(speedRatio, pitchShiftSemitones),
    recordingResult: null,
    trimStartSec: 0,
    trimEndSec: 0,
    lowCutEnabled: true,
  };
}

export function createDefaultVocalPattern(
  role: VocalRole = 'puxador',
  name = 'Appel 1',
  measuresCount: 1 | 2 | 3 | 4 = 2
): VocalPatternItem {
  const v1 = createDefaultVariant(1.0, 0);
  const v2 = createDefaultVariant(0.74, 0);
  const v3 = createDefaultVariant(1.0, -8);
  const v4 = createDefaultVariant(0.74, -8);
  const variants: Record<string, VocalAudioVariant> = {
    [v1.variantKey]: v1, [v2.variantKey]: v2, [v3.variantKey]: v3, [v4.variantKey]: v4,
  };
  return {
    id: `pat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name, role, measuresCount, variants, activeVariantKey: v1.variantKey,
    recordingResult: null, trimStartSec: 0, trimEndSec: 0, lowCutEnabled: true,
    anacrusisSteps: [], mainSteps: [], pitchCurve: [], pack: null,
  };
}

export function createDefaultToadaProject(): ToadaProject {
  const p1 = createDefaultVocalPattern('puxador', 'Appel 1', 2);
  const p2 = createDefaultVocalPattern('coro', 'Reponse Choeur', 2);
  return {
    id: 'toada-default', title: 'Toada Sem Titulo', bpm: 100, timeSignature: '4/4',
    patterns: [p1, p2],
    slots: [
      { slotId: 'slot-1', puxadorPatternId: p1.id, coroPatternId: null },
      { slotId: 'slot-2', puxadorPatternId: null, coroPatternId: p2.id },
    ],
    activePatternId: p1.id,
  };
}
