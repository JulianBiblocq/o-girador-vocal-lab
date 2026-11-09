/**
 * vocalPaperWorkshop.types.ts
 * Contrat de données de l'Atelier Papier du Chant (Impression A4 100 % N&B & Lecture Optique Multi-Photos) (< 115 lignes).
 * Séparation stricte : Patterns neutres (P1..Pn) sur les feuilles de motifs, attribution Pux/Cor sur la Feuille Séquence.
 */
import type { TimeSignatureString } from './vocalPack.types';
import type { ScaleType } from '../audio/scaleQuantizer';

export type VocalSheetType = 'sequence' | 'notes_1m' | 'notes_2m' | 'rhythm_only' | 'instructions';

export type VocalSheetOpticalCode =
  | 'CHANT-SEQ'
  | 'CHANT-NOTES'
  | 'CHANT-NOTES-1M'
  | 'CHANT-NOTES-2M'
  | 'CHANT-RYTHME'
  | 'CHANT-GUIDE';

export type KeyboardOctaveNote =
  | 'G#' | 'G' | 'F#' | 'F' | 'E' | 'D#' | 'Eb' | 'D' | 'C#' | 'C' | 'B' | 'A#' | 'Bb' | 'A';

export interface VocalPaperPrintOptions {
  sheetType: VocalSheetType;
  title?: string;
  bpm?: number;
  timeSignature?: TimeSignatureString;
  sungKey?: string;
  troupeKey?: string;
  scaleMode?: ScaleType;
  patternsCount?: number;
  startPatternNumber?: number;
  rhythmMeasuresPerLine?: 1 | 2;
  prefillFromProject?: boolean;
}

export interface ScannedVocalStepCell {
  stepIndex: number;
  durationSteps?: number;
  syllable?: string;
  isTie?: boolean;
  pitchKey?: KeyboardOctaveNote | string;
  octave?: number;
  octaveShift?: number;
  isTriplet?: boolean;
}

export interface ScannedVocalPatternBlock {
  code: string;
  name?: string;
  officialLyricsText?: string;
  sheetCode: VocalSheetOpticalCode;
  measuresCount?: 1 | 2 | 3 | 4;
  hasAnacrusis?: boolean;
  hasTailBeat?: boolean;
  rhythmOnlyMode: boolean;
  beatNumbers?: Array<number | string | null>;
  cells?: ScannedVocalStepCell[];
  anacrusisCells?: ScannedVocalStepCell[];
  mainCells: ScannedVocalStepCell[];
  tailCells?: ScannedVocalStepCell[];
}

export interface ScannedSequenceMeasureColumn {
  measureNumber: number;
  puxCode: string | null;
  corCode: string | null;
}

export interface VocalPaperBatchScanResult {
  title?: string;
  bpm?: number;
  timeSignature?: TimeSignatureString;
  sungKey?: string;
  troupeKey?: string;
  scaleMode?: ScaleType;
  sequenceColumns: ScannedSequenceMeasureColumn[];
  patterns: ScannedVocalPatternBlock[];
  detectedSheetCodes: VocalSheetOpticalCode[];
}

export interface VocalPaperPhotoQueueItem {
  id: string;
  fileName: string;
  rawDataUrl: string;
  processedDataUrl: string;
  detectedCornerCount: number;
  detectedOrientation: 'portrait' | 'landscape';
  status: 'ready' | 'scanning' | 'done' | 'error';
  detectedCode?: VocalSheetOpticalCode;
  errorMessage?: string;
}

export interface VocalPaperImportTargetConfig {
  title: string;
  bpm: number;
  timeSignature: TimeSignatureString;
  sungKey: string;
  troupeKey: string;
  scaleMode: ScaleType;
  organizadorDocId: string;
  createNewOrganizadorDoc: boolean;
  samambaiaPresetId: string;
  syncToOrganizador: boolean;
  syncToSequenciador: boolean;
}

