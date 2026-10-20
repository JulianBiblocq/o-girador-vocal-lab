/**
 * chordGridHelper.ts
 * Utilitaires purs et immutables pour la gestion de la grille harmonique (< 110 lignes).
 */
import type { PatternHarmonyGrid, PatternMeasureChordGrid } from '../types/harmony.types';

export function createEmptyHarmonyGrid(measuresCount = 2): PatternHarmonyGrid {
  const count = Math.max(1, Math.min(4, measuresCount));
  const measures: PatternMeasureChordGrid[] = [];
  for (let m = 0; m < count; m++) {
    measures.push({ measureIndex: m, chordsByBeat: {} });
  }
  return { measures };
}

export function createHarmonyGridFromChords(chords: string[], measuresCount = 2): PatternHarmonyGrid {
  const grid = createEmptyHarmonyGrid(measuresCount);
  if (!chords || chords.length === 0) return grid;

  if (chords.length === 1) {
    grid.measures[0].chordsByBeat[0] = chords[0];
  } else if (chords.length === 2 && grid.measures.length >= 2) {
    grid.measures[0].chordsByBeat[0] = chords[0];
    grid.measures[1].chordsByBeat[0] = chords[1];
  } else if (chords.length === 2 && grid.measures.length === 1) {
    grid.measures[0].chordsByBeat[0] = chords[0];
    grid.measures[0].chordsByBeat[2] = chords[1];
  } else {
    // Répartition séquentielle
    chords.forEach((ch, idx) => {
      const mIdx = Math.floor(idx / 2) % grid.measures.length;
      const bIdx = (idx % 2) * 2;
      grid.measures[mIdx].chordsByBeat[bIdx] = ch;
    });
  }

  return grid;
}

export function setChordAtBeat(
  currentGrid: PatternHarmonyGrid | undefined,
  measureIndex: number,
  beatIndex: number,
  chord: string | null,
  measuresCount = 2
): PatternHarmonyGrid {
  const base = currentGrid && currentGrid.measures.length > 0 ? currentGrid : createEmptyHarmonyGrid(measuresCount);
  const nextMeasures = base.measures.map((m) => {
    if (m.measureIndex !== measureIndex) return m;
    const nextChords = { ...m.chordsByBeat };
    if (!chord || chord.trim() === '') {
      delete nextChords[beatIndex];
    } else {
      nextChords[beatIndex] = chord.trim().replace(/^\[|\]$/g, '');
    }
    return { ...m, chordsByBeat: nextChords };
  });

  return { measures: nextMeasures };
}

export function formatMeasureChordsString(measure?: PatternMeasureChordGrid): string {
  if (!measure || !measure.chordsByBeat) return '';
  const entries = Object.entries(measure.chordsByBeat)
    .sort(([b1], [b2]) => parseInt(b1, 10) - parseInt(b2, 10));
  if (entries.length === 0) return '';
  return entries.map(([, ch]) => `[${ch}]`).join(' ');
}

export function injectChordsIntoText(text: string, chords?: string[]): string {
  if (!chords || chords.length === 0) return text;
  const prefix = chords.map((c) => `[${c}]`).join(' ');
  return `${prefix} ${text}`.trim();
}
