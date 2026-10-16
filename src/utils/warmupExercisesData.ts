/**
 * warmupExercisesData.ts
 * Définition des 4 jeux d'échauffement vocal Maracatu transposables.
 * Strictement < 150 lignes.
 */

import { midiToNoteName } from './noteUtils';

export interface WarmupExerciseDef {
  id: string;
  nameKey: string;
  descKey: string;
  intervals: number[]; // Décalages en demi-tons par rapport au centre
  durations: number[]; // Durée en temps (beats)
}

export const WARMUP_EXERCISES: WarmupExerciseDef[] = [
  {
    id: 'ancrage_baque',
    nameKey: 'warmupGame1Name',
    descKey: 'warmupGame1Desc',
    intervals: [0],
    durations: [4],
  },
  {
    id: 'marches_nordeste',
    nameKey: 'warmupGame2Name',
    descKey: 'warmupGame2Desc',
    intervals: [0, 2, 4, 5, 7, 5, 4, 2, 0],
    durations: [1, 1, 1, 1, 2, 1, 1, 1, 2],
  },
  {
    id: 'appel_loa',
    nameKey: 'warmupGame3Name',
    descKey: 'warmupGame3Desc',
    intervals: [0, 7, 5, 4, 2, 0],
    durations: [1.5, 2, 1, 1, 1, 2],
  },
  {
    id: 'echo_mestre',
    nameKey: 'warmupGame4Name',
    descKey: 'warmupGame4Desc',
    intervals: [0, 0, 4, 7, 4, 0],
    durations: [1, 1, 1, 1.5, 1, 2],
  },
];

export interface ExerciseStep {
  stepIndex: number;
  midiNumber: number;
  noteName: string;
  durationBeats: number;
}

export function buildExerciseSteps(
  exercise: WarmupExerciseDef,
  centerMidi = 60,
  transposeOffset = 0
): ExerciseStep[] {
  const baseMidi = centerMidi + transposeOffset;
  return exercise.intervals.map((semitones, idx) => {
    const midi = baseMidi + semitones;
    return {
      stepIndex: idx,
      midiNumber: midi,
      noteName: midiToNoteName(midi),
      durationBeats: exercise.durations[idx] ?? 1,
    };
  });
}
