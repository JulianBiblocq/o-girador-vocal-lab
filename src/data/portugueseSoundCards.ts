/**
 * portugueseSoundCards.ts
 * Les 6 Cartes Sonores du Portugais Chanté (Nordeste & Yoruba), détection lexicale dans la Toada
 * et normalisation phonétique naturelle (sans majuscules toniques artificielles).
 * Strictement < 140 lignes.
 */

import type { TranslationKey } from '../i18n/i18n.types';

export type SoundCardId =
  | 'ao_am'
  | 'nh_lh'
  | 'x_ch'
  | 'final_o_e'
  | 'r_rr'
  | 'open_closed_e_o';

export interface PortugueseSoundCardDef {
  id: SoundCardId;
  symbol: string;
  titleKey: TranslationKey;
  ruleKey: TranslationKey;
  examples: string[];
  speechSample: string;
}

export const PORTUGUESE_SOUND_CARDS: PortugueseSoundCardDef[] = [
  {
    id: 'ao_am',
    symbol: 'ão / -am',
    titleKey: 'card1Title',
    ruleKey: 'card1Rule',
    examples: ['Nação', 'Chegaram'],
    speechSample: 'Nação, Chegaram',
  },
  {
    id: 'nh_lh',
    symbol: 'nh / lh',
    titleKey: 'card2Title',
    ruleKey: 'card2Rule',
    examples: ['Rainha', 'Palha'],
    speechSample: 'Rainha, Palha',
  },
  {
    id: 'x_ch',
    symbol: 'x ➔ CH',
    titleKey: 'card3Title',
    ruleKey: 'card3Rule',
    examples: ['Xangô', 'Oxum', 'Puxador'],
    speechSample: 'Xangô, Oxum, Puxador',
  },
  {
    id: 'final_o_e',
    symbol: '-o / -e',
    titleKey: 'card4Title',
    ruleKey: 'card4Rule',
    examples: ['Coro ➔ Cô-rou', 'Baque ➔ Ba-qui'],
    speechSample: 'Coro, Baque',
  },
  {
    id: 'r_rr',
    symbol: 'r vs rr',
    titleKey: 'card5Title',
    ruleKey: 'card5Rule',
    examples: ['Virada', 'Rei', 'Terra'],
    speechSample: 'Virada, Rei, Terra',
  },
  {
    id: 'open_closed_e_o',
    symbol: 'é/ó vs ê/ô',
    titleKey: 'card6Title',
    ruleKey: 'card6Rule',
    examples: ['Fé', 'Nagô'],
    speechSample: 'Fé, Nagô',
  },
];

export function wordMatchesSoundCard(rawToken: string, cardId: SoundCardId | null): boolean {
  if (!cardId) return false;
  const clean = rawToken.replace(/^[^a-zA-ZÀ-ÿ]+|[^a-zA-ZÀ-ÿ]+$/g, '').toLowerCase();
  if (!clean) return false;

  switch (cardId) {
    case 'ao_am':
      return /ão|ãos|ões|ãe|am$/i.test(clean);
    case 'nh_lh':
      return /nh|lh/i.test(clean);
    case 'x_ch':
      return /x/i.test(clean);
    case 'final_o_e':
      return clean.length >= 2 && /[oe]s?$/i.test(clean);
    case 'r_rr':
      return /r/i.test(clean);
    case 'open_closed_e_o':
      return /[éóêô]/i.test(clean);
    default:
      return false;
  }
}

export function countMatchingWordsInLines(lines: string[], cardId: SoundCardId | null): number {
  if (!cardId) return 0;
  let count = 0;
  for (const line of lines) {
    const tokens = line.split(/\s+/);
    for (const tok of tokens) {
      if (wordMatchesSoundCard(tok, cardId)) count++;
    }
  }
  return count;
}

/**
 * Supprime les majuscules toniques artificielles au milieu des mots (ex: "che-GA-ram" -> "che-ga-ram")
 * pour conserver une lecture phonétique naturelle et fluide.
 */
export function formatNaturalPhoneticLine(rawPhonetic: string): string {
  if (!rawPhonetic) return '';
  return rawPhonetic
    .split(/\s+/)
    .map((word, wIdx) => {
      const lower = word.toLowerCase();
      if (wIdx === 0 && lower.length > 0) {
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      }
      return lower;
    })
    .join(' ');
}
