/**
 * variantConfigTypes.ts
 * Types et utilitaires de calcul pour les paliers de hauteur et vitesse symetriques.
 */
import { getTransposedNoteDisplay } from '../../utils/musicalMath';

export const DEFAULT_REF_SEMITONES = 0;
export const DEFAULT_LOW_SEMITONES = -4; // -2 tons
export const DEFAULT_HIGH_SEMITONES = 4; // +2 tons

export const DEFAULT_SPEED_1_PCT = 100;
export const DEFAULT_SPEED_2_PCT = 75;
export const DEFAULT_SPEED_3_PCT = 115;

export function formatPitchTierLabel(
  referencePitch: string,
  offsetSemitones: number,
  locale: 'fr' | 'br'
): { noteName: string; toneStr: string; fullLabel: string } {
  const noteDisplay = getTransposedNoteDisplay(referencePitch, offsetSemitones, locale);
  const tones = Math.abs(offsetSemitones) / 2;
  const sign = offsetSemitones > 0 ? '+' : (offsetSemitones < 0 ? '-' : '');
  const toneStr = offsetSemitones === 0 ? '0 ton' : `${sign}${tones} t (${sign}${offsetSemitones} dt)`;
  const fullLabel = offsetSemitones === 0 ? `0 t • ${noteDisplay.solfege}` : `${sign}${tones} t ➔ ${noteDisplay.solfege}`;
  return { noteName: noteDisplay.noteCode, toneStr, fullLabel };
}
