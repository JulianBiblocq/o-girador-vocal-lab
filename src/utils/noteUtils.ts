/**
 * noteUtils.ts
 * Utilitaires purs de conversion MIDI, nom de note, fréquence et tessiture.
 */

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

const NOTE_NAME_MAP: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

export function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi);
  const note = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${note}${octave}`;
}

export function noteNameToMidi(note: string): number {
  if (note === '───') return -1;
  const match = note.trim().match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) return 60; // C4 par défaut
  const name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const octave = parseInt(match[2], 10);
  const semitone = NOTE_NAME_MAP[name] ?? 0;
  return (octave + 1) * 12 + semitone;
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function frequencyToMidiFloat(freq: number): number {
  if (freq <= 0) return 0;
  return 69 + 12 * (Math.log(freq / 440) / Math.LN2);
}

export function centsDiff(midiFloat: number, targetMidi: number): number {
  return Math.abs(midiFloat - targetMidi) * 100;
}

export function calculateTessitura(midiNumbers: number[]): { minMidi: number; maxMidi: number } {
  const valid = midiNumbers.filter((m) => m >= 24 && m <= 96);
  if (valid.length === 0) return { minMidi: 48, maxMidi: 72 }; // C3..C5 par défaut (2 octaves)
  let min = Math.min(...valid) - 2;
  let max = Math.max(...valid) + 2;
  if (max - min < 12) {
    const pad = Math.ceil((12 - (max - min)) / 2);
    min = Math.max(24, min - pad);
    max = Math.min(96, max + pad);
  }
  return { minMidi: min, maxMidi: max };
}
