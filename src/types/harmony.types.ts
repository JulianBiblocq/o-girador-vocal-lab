/**
 * harmony.types.ts
 * Modèle de données pour la Grille Harmonique et l'Accompagnement MIDI Multi-Univers (< 80 lignes).
 */

export type CanonicalUniverseId = 'maracatu' | 'batucada' | 'sambareggae' | 'samba' | 'capoeira';
export type HarmonyProfileId = CanonicalUniverseId | 'forro';

export function normalizeHarmonyUniverseId(raw?: string | null): HarmonyProfileId {
  const key = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (key === 'samba_reggae' || key === 'sambareggae') return 'sambareggae';
  if (key === 'batucada') return 'batucada';
  if (key === 'samba') return 'samba';
  if (key === 'capoeira') return 'capoeira';
  if (key === 'forro') return 'forro';
  return 'maracatu';
}

export interface ChordDefinition {
  symbol: string;
  root: string;
  bass?: string;
  quality: string;
  pitchClasses: number[];
  rootMidi: number;
  bassMidi: number;
  voicingMidi: number[];
}

export interface PatternMeasureChordGrid {
  measureIndex: number;
  /**
   * Accords associés aux temps (0 = Temps 1, 1 = Temps 2, etc.)
   */
  chordsByBeat: Record<number, string>;
}

export interface PatternHarmonyGrid {
  measures: PatternMeasureChordGrid[];
}

export interface HarmonyConfig {
  enabled: boolean;
  profile: HarmonyProfileId;
  volume: number;
  muteBass?: boolean;
}

export const DEFAULT_HARMONY_CONFIG: HarmonyConfig = {
  enabled: false,
  profile: 'maracatu',
  volume: 0.65,
  muteBass: false,
};
