/**
 * lexicon.types.ts
 * Types de base pour le référentiel lexical d'Organizador & Cantador (< 45 lignes).
 */
import type { SoundCardId } from '../../data/portugueseSoundCards';
import type { LexiconCategory } from '../../types/toadaLexicon.types';

export interface LexiconItem {
  id: string;
  category: LexiconCategory;
  br: string;
  fr: string;
  phonetique?: string;
  conseilDiction?: string;
  soundCardId?: SoundCardId;
  quizQuestion?: string;
  quizOptions?: string[];
  quizCorrectIndex?: number;
}
