/**
 * toadaLexicon.types.ts
 * Contrats d'interfaces pour le dictionnaire bilingue PT-FR et les quiz Organizador (< 60 lignes).
 */
import type { SoundCardId } from '../data/portugueseSoundCards';

export type LexiconCategory = 'maracatu' | 'nordeste' | 'yoruba' | 'ritmo' | 'voz' | 'estudio' | 'autre';

export interface ToadaLexiconEntry {
  mot: string;              // Terme BR / Yoruba (ex: "Xangô")
  traductionFr: string;      // Traduction ou sens en français
  explication: string;       // Rétrocompatibilité Organizador ("Traduction — Phonétique / Conseil")
  phonetique?: string;       // Guide phonétique (ex: "Chan-gô")
  conseilDiction?: string;   // Conseil de diction (ex: "X se prononce 'ch'")
  soundCardId?: SoundCardId; // Carte sonore associée
  categorie?: LexiconCategory;
  isAutoDetected?: boolean;  // Vrai si issu de la détection automatique
}

export interface ToadaQuizItem {
  id?: string;
  question: string;         // Ex: "Que signifie le terme « Axé » dans cette Toada ?"
  options: string[];        // 4 options de réponse
  correctIndex: number;     // Index de la bonne réponse (0-3)
  termeBr: string;          // Terme BR testé
  traductionFr: string;     // Bonne traduction FR
  phonetique?: string;
  extraitTexte?: string;    // Ligne de la Toada où apparaît le mot
  type?: 'traduction_fr_br' | 'traduction_br_fr' | 'sens_culturel' | 'phonetique';
}
