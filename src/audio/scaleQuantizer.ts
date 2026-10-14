/**
 * scaleQuantizer.ts
 * Quantification par gamme / mode musical et rabattement de hauteur MIDI.
 */
import type { VocalStepData } from '../types/vocalPack.types';
import { midiToNoteName, NOTE_NAMES } from '../utils/noteUtils';

export type ScaleType =
  | 'chromatic'
  | 'major'
  | 'natural_minor'
  | 'mixolydian'
  | 'dorian'
  | 'pentatonic_minor'
  | 'pentatonic_major';

export interface ScaleDefinition {
  label: string;
  intervals: number[]; // Demi-tons par rapport à la tonique (0..11)
}

export const SCALE_DEFINITIONS: Record<ScaleType, ScaleDefinition> = {
  chromatic: { label: 'Chromatique (Libre)', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  major: { label: 'Majeur', intervals: [0, 2, 4, 5, 7, 9, 11] },
  natural_minor: { label: 'Mineur Naturel', intervals: [0, 2, 3, 5, 7, 8, 10] },
  mixolydian: { label: 'Mixolydien / Nordeste (7e min)', intervals: [0, 2, 4, 5, 7, 9, 10] },
  dorian: { label: 'Dorien', intervals: [0, 2, 3, 5, 7, 9, 10] },
  pentatonic_minor: { label: 'Pentatonique Mineure', intervals: [0, 3, 5, 7, 10] },
  pentatonic_major: { label: 'Pentatonique Majeure', intervals: [0, 2, 4, 7, 9] },
};

export function getTonicSemitone(tonic: string): number {
  const clean = tonic.replace(/\d+$/, '').trim().toUpperCase();
  const idx = (NOTE_NAMES as readonly string[]).indexOf(clean);
  return idx >= 0 ? idx : 0;
}

export function snapMidiToScale(midi: number, tonic: string, scaleType: ScaleType): number {
  if (scaleType === 'chromatic') return Math.round(midi);
  const def = SCALE_DEFINITIONS[scaleType];
  if (!def) return Math.round(midi);

  const rounded = Math.round(midi);
  const tonicSemitone = getTonicSemitone(tonic);
  const noteSemitone = ((rounded % 12) + 12) % 12;

  // Intervalle relatif à la tonique
  const relativeInterval = (noteSemitone - tonicSemitone + 12) % 12;

  let bestDiff = 999;
  let bestTargetInterval = def.intervals[0];

  for (const interval of def.intervals) {
    const diff = Math.min(
      Math.abs(relativeInterval - interval),
      12 - Math.abs(relativeInterval - interval)
    );
    if (diff < bestDiff) {
      bestDiff = diff;
      bestTargetInterval = interval;
    }
  }

  // Calcul du nouveau demi-ton absolu
  const targetSemitone = (tonicSemitone + bestTargetInterval) % 12;
  let diffSemitones = targetSemitone - noteSemitone;
  if (diffSemitones > 6) diffSemitones -= 12;
  if (diffSemitones < -6) diffSemitones += 12;

  return rounded + diffSemitones;
}

export function applyScaleToSteps(steps: VocalStepData[], tonic: string, scaleType: ScaleType): VocalStepData[] {
  if (scaleType === 'chromatic') return steps;

  return steps.map((st, idx, arr) => {
    if (!st.active || st.midiNumber <= 0) return st;
    if (st.note === '───') {
      const snappedPrev = snapMidiToScale(arr[idx - 1]?.midiNumber ?? st.midiNumber, tonic, scaleType);
      return { ...st, midiNumber: snappedPrev };
    }
    const snapped = snapMidiToScale(st.midiNumber, tonic, scaleType);
    return { ...st, midiNumber: snapped, note: midiToNoteName(snapped) };
  });
}
