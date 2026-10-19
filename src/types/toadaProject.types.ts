/**
 * toadaProject.types.ts
 * Modèle de données de la Toada : Multi-patterns, Déclinaisons Audio, Tessiture & Frise Conducteur (< 90 lignes).
 */
import type { TimeSignatureString, VocalStepData, PitchCurvePoint, VocalPackExport, MelodyneRegion } from './vocalPack.types';
import type { ToadaDocument } from './toadaDocument.types';
import type { TessituraRange } from './tessitura.types';

export * from './tessitura.types';
export {
  computeVariantCoverage,
  makeVariantKey,
  createDefaultVariant,
  createDefaultVocalPattern,
  createDefaultToadaProject,
} from '../utils/toadaProjectDefaults';

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
  enableTonePolish?: boolean;
}

export interface VocalPatternItem {
  id: string;
  name: string;
  role: VocalRole;
  measuresCount: 1 | 2 | 3 | 4;
  linkedSourcePatternId?: string | null;
  baseBpm?: number;
  referencePitch?: string;
  pitchCorrectionAmount?: number;
  rawAudioSamples?: Float32Array | null;
  correctedAudioSamples?: Float32Array | null;
  rawPitchCurve?: PitchCurvePoint[];
  tessitura?: TessituraRange;
  variants: Record<string, VocalAudioVariant>;
  activeVariantKey: string;
  recordingResult: { pcm: Float32Array; sampleRate: number } | null;
  trimStartSec: number; trimEndSec: number; lowCutEnabled: boolean; enableTonePolish?: boolean;
  anacrusisSteps: VocalStepData[]; mainSteps: VocalStepData[]; pitchCurve: PitchCurvePoint[];
  pack?: VocalPackExport | null; midiLocked?: boolean; isMidiInitialized?: boolean; hasAnacrusis?: boolean;
  melodyneRegions?: MelodyneRegion[]; assignedLyricsText?: string; assignedPhoneticText?: string;
  variantPitchesConfig?: VariantPitchesConfig; variantSpeedsConfig?: VariantSpeedsConfig;
}

export interface VariantPitchesConfig {
  refSemitones: number; lowSemitones: number; highSemitones: number; enableHigh: boolean;
}

export interface VariantSpeedsConfig {
  speed1Pct: number; speed2Pct: number; speed3Pct: number; enableSpeed3: boolean;
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
  toadaMeta?: Partial<ToadaDocument>;
  sheetLines?: Array<{ role: VocalRole; text: string; phoneticText?: string; [key: string]: any }>;
}
