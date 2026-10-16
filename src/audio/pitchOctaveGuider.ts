/**
 * pitchOctaveGuider.ts
 * Aiguillage d'octave non-destructif de la courbe de pitch (±12 demi-tons stricts).
 * Préserve 100 % des centièmes de demi-ton, de la justesse relative et du vibrato (< 95 lignes).
 */
import type { PitchCurvePoint, VocalStepData } from '../types/vocalPack.types';
import { requantizeStepsInTimeRange } from './pitchToStepsQuantizer';

/**
 * Décale l'octave de la courbe verte sur une plage temporelle donnée [startSec, endSec]
 * ou sur toute la phrase si startSec === 0 et endSec === totalDurationSec.
 */
export function shiftPitchCurveOctaveInRange(
  curve: PitchCurvePoint[],
  startSec: number,
  endSec: number,
  octaveDelta: -1 | 1
): PitchCurvePoint[] {
  if (!curve || curve.length === 0) return [];
  const shift = octaveDelta * 12.0;

  return curve.map((pt) => {
    if (pt.timeSec >= startSec - 0.005 && pt.timeSec <= endSec + 0.005 && pt.midiFloat >= 24) {
      const newMidi = Math.max(24, Math.min(96, pt.midiFloat + shift));
      return { ...pt, midiFloat: Math.round(newMidi * 100) / 100 };
    }
    return pt;
  });
}

/**
 * Aimant d'octave : replie automatiquement vers les briques MIDI existantes
 * les segments de courbe verte qui ont décroché d'une octave (harmonique +1 ou sous-harmonique -1).
 */
export function alignPitchCurveOctaveToBricks(
  curve: PitchCurvePoint[],
  steps: VocalStepData[],
  stepDurationSec: number,
  _anacrusisStepsCount = 0
): PitchCurvePoint[] {
  if (!curve || curve.length === 0 || !steps || steps.length === 0 || stepDurationSec <= 0) {
    return curve;
  }

  const searchWindowSteps = Math.max(1, Math.round(0.080 / stepDurationSec));

  return curve.map((pt) => {
    if (pt.midiFloat < 24) return pt;

    const centerIdx = Math.floor(pt.timeSec / stepDurationSec);
    let targetMidi = 0;

    // 1. Recherche du pas exact
    if (steps[centerIdx]?.active && steps[centerIdx].midiNumber > 0) {
      targetMidi = steps[centerIdx].midiNumber;
    } else {
      // 2. Recherche de la brique active la plus proche à ±80 ms
      for (let dist = 1; dist <= searchWindowSteps; dist++) {
        const left = centerIdx - dist, right = centerIdx + dist;
        if (left >= 0 && steps[left]?.active && steps[left].midiNumber > 0) {
          targetMidi = steps[left].midiNumber;
          break;
        }
        if (right < steps.length && steps[right]?.active && steps[right].midiNumber > 0) {
          targetMidi = steps[right].midiNumber;
          break;
        }
      }
    }

    if (targetMidi <= 0) return pt;

    const delta = pt.midiFloat - targetMidi;
    let newMidi = pt.midiFloat;

    // Saut d'harmonique (+1 octave comme A#4 au lieu de A#3)
    if (delta >= 8.5 && delta <= 15.5) {
      newMidi = pt.midiFloat - 12.0;
    }
    // Saut de sous-harmonique (-1 octave)
    else if (delta <= -8.5 && delta >= -15.5) {
      newMidi = pt.midiFloat + 12.0;
    }

    return { ...pt, midiFloat: Math.round(newMidi * 100) / 100 };
  });
}

/**
 * Applique le décalage d'octave sur la courbe et requantifie les briques associées.
 */
export function applyOctaveShiftToMelodia(
  rawCurve: PitchCurvePoint[],
  allSteps: VocalStepData[],
  region: { startSec: number; endSec: number } | null,
  totalDurationSec: number,
  delta: -1 | 1,
  hasAnac: boolean,
  beatsPerMeasure: number,
  beatResolution = 4
): { newCurve: PitchCurvePoint[]; newSteps: VocalStepData[] } {
  const sStart = region ? region.startSec : 0, sEnd = region ? region.endSec : totalDurationSec;
  const newCurve = shiftPitchCurveOctaveInRange(rawCurve, sStart, sEnd, delta);
  const stepDur = totalDurationSec / (allSteps.length || 1), anacCount = hasAnac ? beatsPerMeasure * beatResolution : 0;
  const newSteps = requantizeStepsInTimeRange(newCurve, allSteps, sStart, sEnd, stepDur, anacCount);
  return { newCurve, newSteps };
}
