/**
 * vocalDspProtocol.types.ts
 * Protocole typé strict des messages Main Thread <-> Web Worker DSP dédié de Cantador (< 120 lignes).
 * Couvre les 4 familles : EXTRACT_MELODIC_DATA, REANALYZE_ALIGNED_SYLLABLES, RENDER_CORRECTED_OR_SHIFTED_VOICE, ENCODE_WAV.
 */
import type { PitchCurvePoint, VocalStepData, MelodyneRegion } from '../types/vocalPack.types';
import type { TessituraRange } from '../types/tessitura.types';
import type { EffectiveVocalBounds } from '../utils/ambitusStorage';
import type { ScaleType } from '../audio/scaleQuantizer';
import type { ExtractMelodicParams, ExtractMelodicResult } from '../audio/melodicExtractionHelper';

export type VocalDspTaskType =
  | 'EXTRACT_MELODIC_DATA'
  | 'REANALYZE_ALIGNED_SYLLABLES'
  | 'RENDER_CORRECTED_OR_SHIFTED_VOICE'
  | 'ENCODE_WAV';

export type ExtractMelodicTaskPayload = ExtractMelodicParams;
export type ExtractMelodicTaskResult = ExtractMelodicResult;

export interface ReanalyzeSyllablesBatchItem {
  id: string;
  steps: VocalStepData[];
  pitchCurve?: PitchCurvePoint[];
  extractCurveFromPcm?: boolean;
  pcm?: Float32Array | null;
  sampleRate?: number;
  totalDurationSec?: number;
  tessitura?: TessituraRange;
  vocalBounds?: Partial<EffectiveVocalBounds>;
  gridStartSec?: number;
  stepDurationSec?: number;
  beatDurationSec?: number;
  tonic?: string;
  scaleType?: ScaleType;
  allowedPitchClasses?: number[] | null;
  referenceMidiNotes?: number[] | null;
}

export interface ReanalyzeSyllablesTaskPayload {
  items: ReanalyzeSyllablesBatchItem[];
}

export interface ReanalyzeSyllablesItemResult {
  id: string;
  steps: VocalStepData[];
  pitchCurve: PitchCurvePoint[];
}

export interface ReanalyzeSyllablesTaskResult {
  items: ReanalyzeSyllablesItemResult[];
}

export type VoiceRenderMode = 'melodyne' | 'formant_shift' | 'melodyne_and_shift';

export interface RenderVoiceTaskPayload {
  mode: VoiceRenderMode;
  pcm: Float32Array;
  sampleRate: number;
  totalDurationSec?: number;
  rawPitchCurve?: PitchCurvePoint[];
  allSteps?: VocalStepData[];
  regions?: MelodyneRegion[];
  tGridStart?: number;
  gridDur?: number;
  shiftSemitones?: number;
}

export interface RenderVoiceTaskResult {
  processedPCM: Float32Array;
  correctedCurve?: PitchCurvePoint[];
}

export interface EncodeWavCleanPaddingOptions {
  totalDurationSec: number;
  trimStartSec: number;
  trimEndSec: number;
  latencyOffsetMs?: number;
  lowCutEnabled?: boolean;
  normalizeRMS?: boolean;
  enableTonePolish?: boolean;
  rawT1OffsetSec?: number;
  cleanT1OffsetSec?: number;
}

export interface EncodeWavTaskPayload {
  pcm: Float32Array;
  sampleRate: number;
  targetSampleRate?: number;
  cleanPadding?: EncodeWavCleanPaddingOptions;
}

export interface EncodeWavTaskResult {
  wavArrayBuffer: ArrayBuffer;
  sampleRate: number;
  durationSec: number;
}

export interface VocalDspPayloadMap {
  EXTRACT_MELODIC_DATA: ExtractMelodicTaskPayload;
  REANALYZE_ALIGNED_SYLLABLES: ReanalyzeSyllablesTaskPayload;
  RENDER_CORRECTED_OR_SHIFTED_VOICE: RenderVoiceTaskPayload;
  ENCODE_WAV: EncodeWavTaskPayload;
}

export interface VocalDspResultMap {
  EXTRACT_MELODIC_DATA: ExtractMelodicTaskResult;
  REANALYZE_ALIGNED_SYLLABLES: ReanalyzeSyllablesTaskResult;
  RENDER_CORRECTED_OR_SHIFTED_VOICE: RenderVoiceTaskResult;
  ENCODE_WAV: EncodeWavTaskResult;
}

export interface VocalDspWorkerRequest<T extends VocalDspTaskType = VocalDspTaskType> {
  requestId: string;
  taskType: T;
  payload: VocalDspPayloadMap[T];
}

export type VocalDspWorkerResponse<T extends VocalDspTaskType = VocalDspTaskType> =
  | { requestId: string; taskType: T; ok: true; result: VocalDspResultMap[T] }
  | { requestId: string; taskType: T; ok: false; error: string };

export interface VocalDspCancelledError {
  cancelled: true;
  requestId: string;
  dedupeKey?: string;
}

export function isVocalDspCancelled(err: unknown): err is VocalDspCancelledError {
  return Boolean(err && typeof err === 'object' && (err as VocalDspCancelledError).cancelled === true);
}
