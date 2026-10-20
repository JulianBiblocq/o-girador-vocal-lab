/**
 * chordParser.ts
 * Analyse syntaxique des accords musicaux, transposition et voicings (< 130 lignes).
 */
import type { ChordDefinition, PatternHarmonyGrid } from '../types/harmony.types';

const NOTE_TO_PC: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

const PC_TO_NOTE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const CHORD_REGEX = /^\s*([A-G][b#]?)(maj7|7M|M7|m7b5|m7|m6|dim|aug|sus4|7sus4|add9|m|6|7|9)?(?:\/([A-G][b#]?))?\s*$/i;
export const INLINE_CHORD_REGEX = /\[([A-G][b#]?(?:maj7|7M|M7|m7b5|m7|m6|dim|aug|sus4|7sus4|add9|m|6|7|9)?(?:\/[A-G][b#]?)?)\]/g;

export function isChordSymbol(token: string): boolean {
  if (!token) return false;
  const clean = token.replace(/^\[|\]$/g, '').trim();
  return CHORD_REGEX.test(clean);
}

export function parseChordSymbol(symbol: string, transposeSemitones = 0): ChordDefinition | null {
  if (!symbol) return null;
  const clean = symbol.replace(/^\[|\]$/g, '').trim();
  const match = clean.match(CHORD_REGEX);
  if (!match) return null;

  const rawRoot = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
  const rawQuality = match[2] || '';
  const rawBass = match[3] ? (match[3].charAt(0).toUpperCase() + match[3].slice(1).toLowerCase()) : undefined;

  const rootBasePc = NOTE_TO_PC[rawRoot];
  if (rootBasePc === undefined) return null;

  const rootPc = ((rootBasePc + transposeSemitones) % 12 + 12) % 12;
  const transposedRoot = PC_TO_NOTE[rootPc];

  let bassPc = rootPc;
  let transposedBass: string | undefined;
  if (rawBass && NOTE_TO_PC[rawBass] !== undefined) {
    bassPc = ((NOTE_TO_PC[rawBass] + transposeSemitones) % 12 + 12) % 12;
    transposedBass = PC_TO_NOTE[bassPc];
  }

  const q = rawQuality.toLowerCase();
  let intervals = [0, 4, 7]; // Majeur par défaut
  if (q === 'm') intervals = [0, 3, 7];
  else if (q === '7') intervals = [0, 4, 7, 10];
  else if (q === 'm7') intervals = [0, 3, 7, 10];
  else if (q === 'maj7' || q === '7m' || q === 'm7') intervals = [0, 4, 7, 11];
  else if (q === '6') intervals = [0, 4, 7, 9];
  else if (q === 'm6') intervals = [0, 3, 7, 9];
  else if (q === 'dim') intervals = [0, 3, 6, 9];
  else if (q === 'm7b5') intervals = [0, 3, 6, 10];
  else if (q === 'aug') intervals = [0, 4, 8];
  else if (q === 'sus4') intervals = [0, 5, 7];
  else if (q === '7sus4') intervals = [0, 5, 7, 10];
  else if (q === '9') intervals = [0, 4, 7, 10, 14];

  const pitchClasses = Array.from(new Set(intervals.map((iv) => ((rootPc + iv) % 12 + 12) % 12)));
  const rootMidi = 48 + rootPc; // Registre C3..B3
  const bassMidi = 36 + bassPc; // Registre C2..B2 (basse ronde)
  const voicingMidi = intervals.map((iv) => rootMidi + iv);

  const displaySymbol = transposedBass ? `${transposedRoot}${rawQuality}/${transposedBass}` : `${transposedRoot}${rawQuality}`;

  return {
    symbol: displaySymbol,
    root: transposedRoot,
    bass: transposedBass,
    quality: rawQuality,
    pitchClasses,
    rootMidi,
    bassMidi,
    voicingMidi,
  };
}

export function extractChordsFromTextLine(line: string): Array<{ chord: string; index: number }> {
  const result: Array<{ chord: string; index: number }> = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(INLINE_CHORD_REGEX.source, 'g');
  while ((match = regex.exec(line)) !== null) {
    if (isChordSymbol(match[1])) {
      result.push({ chord: match[1], index: match.index });
    }
  }
  return result;
}

export function getChordAtTime(
  grid: PatternHarmonyGrid | undefined,
  timeSec: number,
  beatsPerMeasure: number,
  beatDurationSec: number,
  hasAnacrusis = true,
  pitchShiftSemitones = 0
): ChordDefinition | null {
  if (!grid || !grid.measures || grid.measures.length === 0) return null;
  const measureDurationSec = beatsPerMeasure * beatDurationSec;
  const t1OffsetSec = hasAnacrusis ? measureDurationSec : 0;

  let mIdx = 0;
  let bIdx = 0;
  if (timeSec < t1OffsetSec) {
    // Dans l'anacrouse M-1, utiliser la première mesure disponible
    mIdx = 0;
    bIdx = Math.max(0, Math.floor(timeSec / beatDurationSec));
  } else {
    const relSec = Math.max(0, timeSec - t1OffsetSec);
    mIdx = Math.min(grid.measures.length - 1, Math.floor(relSec / measureDurationSec));
    bIdx = Math.min(beatsPerMeasure - 1, Math.floor((relSec % measureDurationSec) / beatDurationSec));
  }

  const measure = grid.measures[mIdx] || grid.measures[0];
  if (!measure || !measure.chordsByBeat) return null;

  // Chercher l'accord sur ce temps ou le plus récent précédent
  let foundSymbol: string | undefined = measure.chordsByBeat[bIdx];
  if (!foundSymbol) {
    for (let b = bIdx - 1; b >= 0; b--) {
      if (measure.chordsByBeat[b]) { foundSymbol = measure.chordsByBeat[b]; break; }
    }
  }
  if (!foundSymbol) {
    foundSymbol = Object.values(measure.chordsByBeat)[0];
  }

  return foundSymbol ? parseChordSymbol(foundSymbol, pitchShiftSemitones) : null;
}
