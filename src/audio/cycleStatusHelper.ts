/**
 * cycleStatusHelper.ts
 * Calcul de la phase (M-2 Décompte, M-1 Anacrouse, M1..MN Chant) et de la progression.
 */

export interface CycleStatus {
  phase: 'idle' | 'countdown' | 'anacrusis' | 'singing' | 'completed';
  currentMeasure: number; // -2: countdown, -1: anacrusis, >=0: singing
  currentBeat: number;
  beatsPerMeasure: number;
  beatIndexInCycle: number;
  beatProgress: number;
  elapsedSec: number;
  totalDurationSec: number;
}

export function computeCycleStatus(params: {
  isRunning: boolean;
  ctx: AudioContext | null;
  startTime: number;
  totalDurationSec: number;
  beatDurationSec: number;
  beatsPerMeasure: number;
  measuresCount: number;
  totalBeats: number;
}): CycleStatus {
  const { isRunning, ctx, startTime, totalDurationSec, beatDurationSec, beatsPerMeasure, measuresCount, totalBeats } = params;

  if (!isRunning || !ctx) {
    return {
      phase: 'idle', currentMeasure: -2, currentBeat: 0,
      beatsPerMeasure, beatIndexInCycle: 0, beatProgress: 0, elapsedSec: 0, totalDurationSec
    };
  }

  const elapsed = ctx.currentTime - startTime;
  if (elapsed < 0) {
    return {
      phase: 'countdown', currentMeasure: -2, currentBeat: 0,
      beatsPerMeasure, beatIndexInCycle: 0, beatProgress: 0, elapsedSec: 0, totalDurationSec
    };
  }

  if (elapsed >= totalDurationSec) {
    return {
      phase: 'completed', currentMeasure: measuresCount - 1,
      currentBeat: beatsPerMeasure - 1, beatsPerMeasure,
      beatIndexInCycle: totalBeats - 1, beatProgress: 1,
      elapsedSec: totalDurationSec, totalDurationSec
    };
  }

  const totalBeatFraction = elapsed / beatDurationSec;
  const beatIndexInCycle = Math.floor(totalBeatFraction);
  const beatProgress = totalBeatFraction - beatIndexInCycle;

  let phase: 'countdown' | 'anacrusis' | 'singing' = 'countdown';
  let currentMeasure = -2;
  let currentBeat = beatIndexInCycle;

  if (beatIndexInCycle < beatsPerMeasure) {
    phase = 'countdown';
    currentMeasure = -2;
    currentBeat = beatIndexInCycle;
  } else if (beatIndexInCycle < 2 * beatsPerMeasure) {
    phase = 'anacrusis';
    currentMeasure = -1;
    currentBeat = beatIndexInCycle - beatsPerMeasure;
  } else {
    phase = 'singing';
    const singingBeatIdx = beatIndexInCycle - 2 * beatsPerMeasure;
    currentMeasure = Math.floor(singingBeatIdx / beatsPerMeasure);
    currentBeat = singingBeatIdx % beatsPerMeasure;
  }

  return {
    phase, currentMeasure, currentBeat, beatsPerMeasure,
    beatIndexInCycle, beatProgress, elapsedSec: elapsed, totalDurationSec
  };
}
