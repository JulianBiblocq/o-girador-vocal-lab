/**
 * index.ts
 * Catalogue unifié du lexique bilingue PT-FR et diction phonétique (< 60 lignes).
 */
import type { LexiconItem } from './lexicon.types';
import { MARACATU_YORUBA_LEXICON } from './maracatuYorubaLexicon';
import { NORDESTE_RITMO_LEXICON } from './nordesteRitmoLexicon';
import { INSTRUMENTS_VOZ_LEXICON } from './instrumentsVozLexicon';
import { TECHNICAL_VOCAL_LEXICON } from './technicalVocalLexicon';

export * from './lexicon.types';
export { MARACATU_YORUBA_LEXICON } from './maracatuYorubaLexicon';
export { NORDESTE_RITMO_LEXICON } from './nordesteRitmoLexicon';
export { INSTRUMENTS_VOZ_LEXICON } from './instrumentsVozLexicon';
export { TECHNICAL_VOCAL_LEXICON } from './technicalVocalLexicon';

export const ORGANIZADOR_VOCAL_LEXICON: LexiconItem[] = [
  ...MARACATU_YORUBA_LEXICON,
  ...NORDESTE_RITMO_LEXICON,
  ...INSTRUMENTS_VOZ_LEXICON,
  ...TECHNICAL_VOCAL_LEXICON,
];

export function findLexiconItemById(id: string): LexiconItem | undefined {
  return ORGANIZADOR_VOCAL_LEXICON.find((item) => item.id.toLowerCase() === id.toLowerCase());
}

export function searchLexiconByTerm(term: string): LexiconItem | undefined {
  const clean = term.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ORGANIZADOR_VOCAL_LEXICON.find((item) => {
    const itemClean = item.br.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return itemClean === clean || itemClean.includes(clean);
  });
}
