/**
 * scoreTheoryHelper.ts
 * Utilitaires purs de théorie musicale pour la Partition 2 Portées, Tablature 4 Étages et MusicXML 4.0 :
 * Armures (-7..+7), orthographe diatonique, choix intelligent Sol / Sol 8vb, accords et 3 notations (< 125 lignes).
 */
export type ClefModeOption = 'auto' | 'treble' | 'treble_8vb';
export type ResolvedStaffClef = 'treble' | 'treble_8vb';
export type TabPitchNotation = 'letters' | 'solfege' | 'degrees';

export interface ParsedKeySignature {
  rootPc: number; rootStep: string; rootAlter: number;
  mode: 'major' | 'minor'; fifths: number; label: string;
}

export interface SpelledPitch {
  midi: number; step: string; alter: number; octave: number;
  accidental: '' | '#' | 'b' | 'n'; staffPosFromBottomLine: number;
}

const NOTE_PCS: Record<string, { pc: number; step: string; alter: number }> = {
  C: { pc: 0, step: 'C', alter: 0 }, 'C#': { pc: 1, step: 'C', alter: 1 }, DB: { pc: 1, step: 'D', alter: -1 },
  D: { pc: 2, step: 'D', alter: 0 }, 'D#': { pc: 3, step: 'D', alter: 1 }, EB: { pc: 3, step: 'E', alter: -1 },
  E: { pc: 4, step: 'E', alter: 0 }, F: { pc: 5, step: 'F', alter: 0 }, 'F#': { pc: 6, step: 'F', alter: 1 },
  GB: { pc: 6, step: 'G', alter: -1 }, G: { pc: 7, step: 'G', alter: 0 }, 'G#': { pc: 8, step: 'G', alter: 1 },
  AB: { pc: 8, step: 'A', alter: -1 }, A: { pc: 9, step: 'A', alter: 0 }, 'A#': { pc: 10, step: 'A', alter: 1 },
  BB: { pc: 10, step: 'B', alter: -1 }, B: { pc: 11, step: 'B', alter: 0 },
};

const SOLFEGE_TO_LETTER: Record<string, string> = {
  DO: 'C', 'DÓ': 'C', RE: 'D', 'RÉ': 'D', MI: 'E', FA: 'F', 'FÁ': 'F', SOL: 'G', LA: 'A', 'LÁ': 'A', SI: 'B',
};

const MAJOR_FIFTHS_BY_PC: Record<number, number> = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6, 1: -5, 8: -4, 3: -3, 10: -2, 5: -1 };
const SHARP_SPELL: Array<[string, number]> = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
const FLAT_SPELL: Array<[string, number]> = [['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0]];
const STEP_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
const SOLFEGE_FR = ['Do', 'Do#', 'Ré', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
const SOLFEGE_BR = ['Dó', 'Dó#', 'Ré', 'Mib', 'Mi', 'Fá', 'Fá#', 'Sol', 'Láb', 'Lá', 'Sib', 'Si'];
const LETTERS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const DEGREES = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'];

export function parseScoreKeySignature(rawKey?: string | null): ParsedKeySignature {
  const clean = String(rawKey || 'C').trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  const isMinor = /\b(min|mineur|menor|aeolian|dorian)\b/i.test(clean) || /^[A-Ga-g][#b]?m$/.test(clean);
  const token = clean.split(/[\s(/]+/)[0].replace(/m$/i, '');
  const m = token.match(/^(Do|Dó|Re|Ré|Mi|Fa|Fá|Sol|La|Lá|Si|[A-Ga-g])([#b])?$/i);
  const baseRaw = m ? m[1].toUpperCase() : 'C', acc = m && m[2] ? m[2].toUpperCase() : '';
  const letter = SOLFEGE_TO_LETTER[baseRaw] || baseRaw;
  const info = NOTE_PCS[`${letter}${acc}`] || NOTE_PCS[letter] || NOTE_PCS.C;
  const relMajorPc = isMinor ? (info.pc + 3) % 12 : info.pc;
  const fifths = MAJOR_FIFTHS_BY_PC[relMajorPc] ?? 0;
  return { rootPc: info.pc, rootStep: info.step, rootAlter: info.alter, mode: isMinor ? 'minor' : 'major', fifths, label: clean || 'Do Majeur' };
}

export function resolveStaffClef(midiNotes: number[], mode: ClefModeOption = 'auto'): ResolvedStaffClef {
  if (mode === 'treble' || mode === 'treble_8vb') return mode;
  const valid = midiNotes.filter((m) => Number.isFinite(m) && m >= 24 && m <= 108).sort((a, b) => a - b);
  if (valid.length === 0) return 'treble';
  const median = valid[Math.floor(valid.length / 2)];
  return median < 58 ? 'treble_8vb' : 'treble';
}

export function getKeyAlterationMap(fifths: number): Record<string, number> {
  const map: Record<string, number> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  if (fifths > 0) for (let i = 0; i < Math.min(7, fifths); i++) map[SHARP_ORDER[i]] = 1;
  else if (fifths < 0) for (let i = 0; i < Math.min(7, -fifths); i++) map[FLAT_ORDER[i]] = -1;
  return map;
}

export function spellMidiPitch(midi: number, fifths = 0, clef: ResolvedStaffClef = 'treble'): SpelledPitch {
  const rounded = Math.max(24, Math.min(108, Math.round(midi)));
  const pc = ((rounded % 12) + 12) % 12, octave = Math.floor(rounded / 12) - 1;
  const [step, alter] = (fifths < 0 ? FLAT_SPELL : SHARP_SPELL)[pc];
  const keyMap = getKeyAlterationMap(fifths);
  const accidental: '' | '#' | 'b' | 'n' = alter === keyMap[step] ? '' : alter === 1 ? '#' : alter === -1 ? 'b' : 'n';
  const writtenOctave = clef === 'treble_8vb' ? octave + 1 : octave;
  // Ligne 1 (bas de portée Sol) = E4 (writtenOctave=4, step=E -> index 2 => 4*7 + 2 = 30)
  const staffPosFromBottomLine = writtenOctave * 7 + STEP_INDEX[step] - 30;
  return { midi: rounded, step, alter, octave, accidental, staffPosFromBottomLine };
}

export function formatTabPitchToken(midi: number, rootPc = 0, notation: TabPitchNotation = 'letters', lang: 'fr' | 'br' = 'fr'): string {
  if (!Number.isFinite(midi) || midi <= 0) return '0';
  const r = Math.round(midi), pc = ((r % 12) + 12) % 12, oct = Math.floor(r / 12) - 1;
  if (notation === 'degrees') {
    const rel = ((pc - rootPc) % 12 + 12) % 12;
    return `${DEGREES[rel]}${oct < 4 ? ',' : oct > 4 ? "'" : ''}`;
  }
  const names = notation === 'solfege' ? (lang === 'br' ? SOLFEGE_BR : SOLFEGE_FR) : LETTERS;
  return oct === 4 ? names[pc] : `${names[pc]}${oct}`;
}

export function parseChordSymbolForMusicXml(rawSymbol: string): {
  rootStep: string; rootAlter: number; kind: string; bassStep?: string; bassAlter?: number; display: string;
} | null {
  const clean = String(rawSymbol || '').trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  const m = clean.match(/^([A-G])([#b])?([^/]*)(?:\/([A-G])([#b])?)?$/i);
  if (!m) return null;
  const rootStep = m[1].toUpperCase(), rootAlter = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const qual = (m[3] || '').trim();
  const kind = /^(m7b5|ø)/i.test(qual) ? 'half-diminished'
    : /^dim/i.test(qual) ? 'diminished'
    : /^m(aj)?7/i.test(qual) && /maj/i.test(qual) ? 'major-seventh'
    : /^m7/i.test(qual) ? 'minor-seventh'
    : /^m(in)?$/i.test(qual) ? 'minor'
    : /^7/.test(qual) ? 'dominant'
    : /^maj7/i.test(qual) ? 'major-seventh'
    : /^sus4/i.test(qual) ? 'suspended-fourth' : 'major';
  const bassStep = m[4] ? m[4].toUpperCase() : undefined;
  const bassAlter = m[4] ? (m[5] === '#' ? 1 : m[5] === 'b' ? -1 : 0) : undefined;
  return { rootStep, rootAlter, kind, bassStep, bassAlter, display: clean };
}
