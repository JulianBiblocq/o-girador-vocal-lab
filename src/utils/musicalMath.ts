/**
 * musicalMath.ts
 * Utilitaires de conversion de notes et metrique rythmique.
 */
import type { TimeSignatureString } from '../types/vocalPack.types';

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

const SEMITONE_TO_NOTE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function noteToMidi(note: string): number {
  const match = note.trim().match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) return 60;
  const name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const oct = parseInt(match[2], 10);
  return (oct + 1) * 12 + (NOTE_TO_SEMITONE[name] ?? 0);
}

export function midiToNote(midi: number): string {
  const clamped = Math.max(12, Math.min(127, Math.round(midi)));
  const semitone = clamped % 12;
  const oct = Math.floor(clamped / 12) - 1;
  return `${SEMITONE_TO_NOTE[semitone]}${oct}`;
}

export function transposePitchNote(note: string, semitones: number): string {
  if (semitones === 0) return note;
  return midiToNote(noteToMidi(note) + semitones);
}

export function noteToFrequency(note: string): number {
  const midi = noteToMidi(note);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function getBeatsPerMeasure(timeSignature: TimeSignatureString): number {
  switch (timeSignature) {
    case '2/4': return 2;
    case '3/4': return 3;
    case '6/8': return 2;
    case '12/8': return 4;
    case '4/4':
    default:
      return 4;
  }
}
