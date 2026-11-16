/**
 * forcedMelodyAlignerFallback.ts
 * Formatage pur du Code Papier (C, D, F# en octave 4 implicite ; A3, G3, C5 hors octave 4) sans dépendance audio (< 20 lignes).
 */
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function formatPaperNoteCode(midi: number): string {
  if (!Number.isFinite(midi) || midi <= 0) return '';
  const r = Math.round(midi), pc = NAMES[((r % 12) + 12) % 12], oct = Math.floor(r / 12) - 1;
  return oct === 4 ? pc : `${pc}${oct}`;
}
