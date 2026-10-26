/**
 * toadaDocument.types.ts
 * Contrat d'interface ToadaDocument d'organizador (< 60 lignes).
 * Supporte métadonnées, paroles riches et phonétiques, lexique, QCM et rawTxtCode.
 */
import type { VocalRole } from './toadaProject.types';
import type { ToadaLexiconEntry, ToadaQuizItem } from './toadaLexicon.types';
import type { PatternHarmonyGrid } from './harmony.types';

export * from './toadaLexicon.types';

export interface ToadaDocument {
  id: string;
  titre: string;
  type: 'song';
  categoryId?: string;
  categorie?: string;
  groupId?: string;
  nacao?: string;
  rythme?: string;
  annee?: number;
  lienSequenceurId?: string;
  audioUrl?: string;
  fileUrl?: string;
  parolesOriginales: string | Array<{ puxador?: string; coro?: string; choeur?: string; isMixed?: boolean }>;
  parolesPhonetiques?: string | Array<{ puxador?: string; coro?: string; choeur?: string; isMixed?: boolean }>;
  rawTxtCode?: string;
  structuredMeasures?: any[];
  signature?: string;
  timeSignature?: string;
  cantadorToadaId?: string;
  traduction?: string;
  anecdote?: string;
  notesLexique?: ToadaLexiconEntry[];
  questionsQcm?: ToadaQuizItem[];
  tonaliteDefaut?: string;
  bpmDefaut?: number;
  repertoireId?: string;
  harmonyGrid?: PatternHarmonyGrid;
  globalHarmonyGrid?: PatternHarmonyGrid;
}

export interface TimeAnchor {
  beat: number; // 1..12
  measureOffset: number;
  isRest: boolean;
  isInitialRest?: boolean;
  isSustainedHold?: boolean;
  charOffset?: number;
  textSlice?: string;
  syllables?: string[];
}

export interface ParsedLyricsSegment {
  role: VocalRole;
  text: string;
  phoneticText?: string;
  measuresCount?: 1 | 2 | 3 | 4;
  hasAnacrusis?: boolean;
  isLinkedMeasure?: boolean;
  isMixedPair?: boolean;
  chords?: string[];
  sectionBpm?: number;
  sectionName?: string;
  timeAnchors?: TimeAnchor[];
  exitBeat?: number;
}

export interface ParsedToadaSheetResult {
  docMeta?: Partial<ToadaDocument>;
  segments: ParsedLyricsSegment[];
}
