/**
 * tessitura.types.ts
 * Types, presets de tessiture vocale et fonctions de repliement harmonique (< 70 lignes).
 */
import { midiToFrequency } from '../utils/noteUtils';

export type TessituraPresetId = 'grave' | 'medium' | 'aigu' | 'libre' | 'custom';

export interface TessituraRange {
  presetId: TessituraPresetId;
  minPitchMidi: number; // Plancher (MIDI Float, ex: 38 = D2)
  maxPitchMidi: number; // Plafond (MIDI Float, ex: 79 = G5)
}

export const TESSITURA_PRESETS: Record<TessituraPresetId, TessituraRange> = {
  grave: { presetId: 'grave', minPitchMidi: 38, maxPitchMidi: 65 },  // D2 à F4 (Voix Grave)
  medium: { presetId: 'medium', minPitchMidi: 45, maxPitchMidi: 72 }, // A2 à C5 (Voix Médium)
  aigu: { presetId: 'aigu', minPitchMidi: 48, maxPitchMidi: 79 },   // C3 à G5 (Voix Aiguë)
  libre: { presetId: 'libre', minPitchMidi: 36, maxPitchMidi: 84 },  // C2 à C6 (Libre)
  custom: { presetId: 'custom', minPitchMidi: 40, maxPitchMidi: 76 },
};

export const DEFAULT_TESSITURA: TessituraRange = TESSITURA_PRESETS.medium;

export function getTessituraBoundsHz(range: TessituraRange): { minHz: number; maxHz: number } {
  return {
    minHz: Math.round(midiToFrequency(range.minPitchMidi) * 10) / 10,
    maxHz: Math.round(midiToFrequency(range.maxPitchMidi) * 10) / 10,
  };
}

export function isPitchInTessitura(midi: number, range: TessituraRange): boolean {
  return midi >= range.minPitchMidi && midi <= range.maxPitchMidi;
}

export function foldPitchToTessitura(
  midiFloat: number,
  range: TessituraRange
): { midiFloat: number; folded: boolean; octaveShift: number } {
  if (isPitchInTessitura(midiFloat, range)) {
    return { midiFloat, folded: false, octaveShift: 0 };
  }

  // Repliement octave basse (+12 ST)
  if (midiFloat < range.minPitchMidi && isPitchInTessitura(midiFloat + 12, range)) {
    return { midiFloat: midiFloat + 12, folded: true, octaveShift: 1 };
  }

  // Repliement octave haute (-12 ST)
  if (midiFloat > range.maxPitchMidi && isPitchInTessitura(midiFloat - 12, range)) {
    return { midiFloat: midiFloat - 12, folded: true, octaveShift: -1 };
  }

  // Double octave basse (+24 ST) pour bruits sous-harmoniques extrêmes
  if (midiFloat < range.minPitchMidi && isPitchInTessitura(midiFloat + 24, range)) {
    return { midiFloat: midiFloat + 24, folded: true, octaveShift: 2 };
  }

  return { midiFloat, folded: false, octaveShift: 0 };
}
