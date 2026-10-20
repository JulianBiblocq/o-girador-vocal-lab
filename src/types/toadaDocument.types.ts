/**
 * toadaDocument.types.ts
 * Contrat d'interface ToadaDocument d'organizador (< 60 lignes).
 * Supporte métadonnées, paroles riches et phonétiques, lexique, QCM et rawTxtCode.
 */
import type { VocalRole } from './toadaProject.types';

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
  notesLexique?: Array<{ mot: string; explication: string }>;
  questionsQcm?: Array<{ question: string; options: string[]; correctIndex: number; extraitTexte?: string }>;
  tonaliteDefaut?: string;
  bpmDefaut?: number;
  repertoireId?: string;
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
}

export interface ParsedToadaSheetResult {
  docMeta?: Partial<ToadaDocument>;
  segments: ParsedLyricsSegment[];
}
