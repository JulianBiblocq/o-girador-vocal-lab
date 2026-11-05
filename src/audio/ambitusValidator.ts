/**
 * ambitusValidator.ts
 * Validation acoustique Haute Précision de l'ambitus : octave stricte (sans mod 12),
 * tenue continue >= 1.2s, jitter phonatoire < 35 cents et anti-affaissement (< 125 lignes).
 */
import type { AmbitusStepResult, AmbitusValidationStatus } from '../types/vocalProfile.types';
import { midiToNoteName } from '../utils/noteUtils';

export interface ValidationSample {
  timeSec: number;
  pitchMidi: number;
  rms: number;
}

export const AMBITUS_HOLD_SEC = 1.6;
export const MIN_STABLE_HOLD_SEC = 1.2;
export const MIN_PROJECTION_RMS = 0.012;
export const AMBITUS_MIN_RMS = MIN_PROJECTION_RMS;
export const MAX_SAGGING_CENTS = 50;
export const MAX_JITTER_CENTS = 35;
export const PITCH_TOLERANCE_SEMITONES = 0.85;
export const MAX_CONTINUITY_GAP_SEC = 0.35;

export interface AmbitusDetailedFeedback {
  isSolid: boolean;
  status: AmbitusValidationStatus;
  messageKey: string;
  avgDiffCents: number;
  durationSec: number;
  avgRms: number;
}

export function validateAmbitusNote(
  targetMidi: number,
  samples: ValidationSample[],
  targetHoldSec = AMBITUS_HOLD_SEC,
  minProjectionRms = MIN_PROJECTION_RMS
): AmbitusStepResult {
  const noteName = midiToNoteName(targetMidi);
  const voiced = samples.filter((s) => s.pitchMidi > 0 && s.rms >= minProjectionRms * 0.35);

  if (voiced.length < 4) {
    return {
      note: noteName, midi: targetMidi, heldDurationSec: 0, avgRms: 0,
      isSolid: false, status: 'failed_low_power', messageKey: 'ambitusCoachingNeedPower',
    };
  }

  const firstTime = voiced[0].timeSec;
  const lastTime = voiced[voiced.length - 1].timeSec;
  const durationSec = lastTime - firstTime;
  const avgRms = voiced.reduce((acc, s) => acc + s.rms, 0) / voiced.length;

  if (avgRms < minProjectionRms) {
    return {
      note: noteName, midi: targetMidi, heldDurationSec: durationSec, avgRms,
      isSolid: false, status: 'failed_low_power', messageKey: 'ambitusCoachingNeedPower',
    };
  }

  let maxGapSec = 0;
  for (let i = 1; i < voiced.length; i++) {
    const gap = voiced[i].timeSec - voiced[i - 1].timeSec;
    if (gap > maxGapSec) maxGapSec = gap;
  }

  const requiredHoldSec = Math.min(MIN_STABLE_HOLD_SEC, targetHoldSec * 0.75);
  if (durationSec < requiredHoldSec || maxGapSec > MAX_CONTINUITY_GAP_SEC) {
    return {
      note: noteName, midi: targetMidi, heldDurationSec: durationSec, avgRms,
      isSolid: false, status: 'failed_pitch', messageKey: 'ambitusCoachingTooShort',
    };
  }

  // 1. Justesse stricte dans l'octave cible (SANS repliement mod 12 !)
  const avgDiff = voiced.reduce((acc, s) => acc + (s.pitchMidi - targetMidi), 0) / voiced.length;
  if (avgDiff < -PITCH_TOLERANCE_SEMITONES) {
    return {
      note: noteName, midi: targetMidi, heldDurationSec: durationSec, avgRms,
      isSolid: false, status: 'failed_pitch', messageKey: 'ambitusCoachingTooLow',
    };
  }
  if (avgDiff > PITCH_TOLERANCE_SEMITONES) {
    return {
      note: noteName, midi: targetMidi, heldDurationSec: durationSec, avgRms,
      isSolid: false, status: 'failed_pitch', messageKey: 'ambitusCoachingTooHigh',
    };
  }

  // 2. Stabilité phonatoire : jitter (écart-type de la hauteur) < 35 cents
  const meanPitch = voiced.reduce((acc, s) => acc + s.pitchMidi, 0) / voiced.length;
  const varianceCents = voiced.reduce((acc, s) => acc + Math.pow((s.pitchMidi - meanPitch) * 100, 2), 0) / voiced.length;
  const jitterCents = Math.sqrt(varianceCents);
  if (jitterCents > MAX_JITTER_CENTS) {
    return {
      note: noteName, midi: targetMidi, heldDurationSec: durationSec, avgRms,
      isSolid: false, status: 'failed_sagging', messageKey: 'ambitusCoachingSagging',
    };
  }

  // 3. Stabilité jusqu'à la fin du souffle : pas d'affaissement > 50 cents sur les 500 dernières ms
  const tailBoundary = lastTime - 0.5;
  const coreWindow = voiced.filter((s) => s.timeSec <= tailBoundary);
  const finalWindow = voiced.filter((s) => s.timeSec > tailBoundary);

  if (coreWindow.length > 0 && finalWindow.length > 0) {
    const avgCorePitch = coreWindow.reduce((a, s) => a + s.pitchMidi, 0) / coreWindow.length;
    const avgFinalPitch = finalWindow.reduce((a, s) => a + s.pitchMidi, 0) / finalWindow.length;
    const dropCents = (avgCorePitch - avgFinalPitch) * 100;

    if (dropCents > MAX_SAGGING_CENTS) {
      return {
        note: noteName, midi: targetMidi, heldDurationSec: durationSec, avgRms,
        isSolid: false, status: 'failed_sagging', messageKey: 'ambitusCoachingSagging',
      };
    }
  }

  return {
    note: noteName, midi: targetMidi, heldDurationSec: durationSec, avgRms,
    isSolid: true, status: 'solid', messageKey: 'ambitusNoteSolidSuccess',
  };
}
