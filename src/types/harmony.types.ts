/**
 * harmony.types.ts
 * Modèle de données pour la Grille Harmonique et l'Accompagnement MIDI Multi-Univers (< 80 lignes).
 */

export type HarmonyProfileId = 'maracatu' | 'capoeira' | 'samba' | 'forro';

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
