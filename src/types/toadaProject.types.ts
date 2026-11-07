/**
 * toadaProject.types.ts
 * Modèle de données de la Toada : Multi-patterns, Déclinaisons Audio, Tessiture & Frise Conducteur (< 115 lignes).
 */
import type { TimeSignatureString, VocalStepData, PitchCurvePoint, VocalPackExport, MelodyneRegion } from './vocalPack.types';
import type { ToadaDocument, TimeAnchor } from './toadaDocument.types';
import type { TessituraRange } from './tessitura.types';
import type { PatternHarmonyGrid, HarmonyConfig } from './harmony.types';
import type { PatternStepStatus } from './project.types';

export type { PatternStepStatus };
export * from './tessitura.types';
export * from './harmony.types';
export {
  DEFAULT_TOADA_BPM,
  computeVariantCoverage,
  makeVariantKey,
  createDefaultVariant,
  createDefaultVocalPattern,
  createDefaultToadaProject,
} from '../utils/toadaProjectDefaults';

export type VocalRole = 'puxador' | 'coro';
export type SequenciadorExportMode = 'rhythm_only' | 'full_notes';

export interface VocalAudioVariantCoverage {
  minBpmRatio: number;
  maxBpmRatio: number;
  minSemitones: number;
  maxSemitones: number;
}

export interface AudioRecordingResult {
  pcm: Float32Array;
  sampleRate: number;
  t1OffsetSec?: number;
  recordedBpm?: number;
}

export interface VocalAudioVariant {
  variantKey: string;
  speedRatio: number;
  pitchShiftSemitones: number;
  coverage: VocalAudioVariantCoverage;
  recordingResult: AudioRecordingResult | null;
  trimStartSec: number;
  trimEndSec: number;
  t1OffsetSec?: number;
  lowCutEnabled: boolean;
  enableTonePolish?: boolean;
}

export interface VocalPatternItem {
  id: string;
  cardIndex?: number;
  rawLineCode?: string;
  name: string;
  role: VocalRole;
  measuresCount: 1 | 2 | 3 | 4;
  linkedSourcePatternId?: string | null;
  baseBpm?: number;
  bpm?: number;
  referencePitch?: string;
  pitchCorrectionAmount?: number;
  rawAudioSamples?: Float32Array | null;
  correctedAudioSamples?: Float32Array | null;
  rawPitchCurve?: PitchCurvePoint[];
  tessitura?: TessituraRange;
  variants: Record<string, VocalAudioVariant>;
  activeVariantKey: string;
  recordingResult: AudioRecordingResult | null;
  trimStartSec: number; trimEndSec: number; t1OffsetSec?: number; lowCutEnabled: boolean; enableTonePolish?: boolean;
  anacrusisSteps: VocalStepData[]; mainSteps: VocalStepData[]; pitchCurve: PitchCurvePoint[];
  pack?: VocalPackExport | null; midiLocked?: boolean; isMidiInitialized?: boolean; hasAnacrusis?: boolean;
  hasCanonicalAlignment?: boolean;
  anacrusisBeats?: number;
  melodyneRegions?: MelodyneRegion[]; assignedLyricsText?: string; assignedPhoneticText?: string;
  variantPitchesConfig?: VariantPitchesConfig; variantSpeedsConfig?: VariantSpeedsConfig;
  harmonyGrid?: PatternHarmonyGrid;
  timeAnchors?: TimeAnchor[]; exitBeat?: number; hasTailBeat?: boolean;
  troupeTransposedPCM?: Float32Array | null;
  troupeTransposedSemitones?: number;
  foldNotesView?: boolean;
  stepStatus?: Partial<PatternStepStatus>;
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
  advanceMeasures?: number;
}

export interface ToadaProject {
  id: string;
  title: string;
  source?: 'organizador' | 'local';
  bpm: number;
  timeSignature: TimeSignatureString;
  patterns: VocalPatternItem[];
  slots: ToadaArrangementSlot[];
  activePatternId: string;
  toadaMeta?: Partial<ToadaDocument>;
  sheetLines?: Array<{ role: VocalRole; text: string; phoneticText?: string; [key: string]: any }>;
  harmonyConfig?: HarmonyConfig;
  globalHarmonyGrid?: PatternHarmonyGrid;
  sungScaleRoot?: string;
  sungScaleMode?: string;
  transpositionSemitones?: number;
  troupeScaleRoot?: string;
  previewListenTarget?: 'sung' | 'troupe';
  sequenciadorExportMode?: SequenciadorExportMode;
  organizadorSyncedAt?: number;
  sequenciadorSyncedAt?: number;
  sequenciadorLastExportMode?: SequenciadorExportMode;
}
