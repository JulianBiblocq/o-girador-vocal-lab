/**
 * takeRecoveryTypes.ts
 * Types partagés de la récupération des prises Cloud (/toada_packs + Storage vocalRecordings/) (< 60 lignes).
 */
import type { VocalRole } from '../types/toadaProject.types';

export type RecoverySource = 'pack' | 'orphan';
export type RecoveryConfidence = 'high' | 'suggest';
export type RecoveryWarning = 'title-mismatch' | 'transposed' | 'duration-far' | 'duration-off' | 't1-off' | 'trim-start' | 'reused';
export type RecoveryReason = 'patternId' | 'role+lyrics+card' | 'role+lyrics' | 'role+lyrics(repeat)' | 'duration';

export interface RecoveryTake {
  key: string; source: RecoverySource; storagePath: string; url?: string; sizeKb: number; updated?: string;
  durationSec: number; durationExact: boolean; batchKey: string; batchLabel: string;
  patternId?: string; role?: VocalRole; lyrics?: string; cardIndex?: number; hasTailBeat?: boolean;
  t1OffsetSec?: number; trimStartSec?: number; trimEndSec?: number; recordedBpm?: number; transpositionSemitones?: number;
}

export interface RecoveryPackInfo { id: string; title: string; documentId?: string; transpositionSemitones: number; }

export interface RecoveryInventory { pack: RecoveryPackInfo | null; packTakes: RecoveryTake[]; orphanTakes: RecoveryTake[]; }

export interface TimingChecks { expectedSec: number; deltaPct: number; normalizedT1: number; trimStartSec: number; }

export interface RecoveryProposal {
  patternId: string; take: RecoveryTake; confidence: RecoveryConfidence; reason: RecoveryReason;
  warnings: RecoveryWarning[]; checks: TimingChecks;
}

export interface MatcherPattern {
  id: string; role: VocalRole; name?: string; assignedLyricsText?: string; cardIndex?: number; measuresCount: number;
  hasTailBeat?: boolean; exitBeat?: number; hasAnacrusis?: boolean; anacrusisBeats?: number;
}

export interface MatcherContext { patterns: MatcherPattern[]; bpm: number; beatsPerMeasure: number; projectTitle: string; projectDocumentId?: string; }
