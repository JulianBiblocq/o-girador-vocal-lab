/**
 * ambitusValidator.ts
 * Validation acoustique Haute Précision de l'ambitus : filtre médian glissant 120 ms pondéré
 * anti-saut d'octave (H1/H2), tenue continue >= 1.2s, jitter < 35 cents (< 138 lignes).
 */
import type { AmbitusStepResult, AmbitusValidationStatus } from '../types/vocalProfile.types';
import { midiToNoteName } from '../utils/noteUtils';

export interface ValidationSample {
  timeSec: number; pitchMidi: number; rms: number; clarity?: number;
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
  isSolid: boolean; status: AmbitusValidationStatus; messageKey: string;
  avgDiffCents: number; durationSec: number; avgRms: number;
}

export function smoothAmbitusSamples(
  samples: ValidationSample[], targetMidi?: number, windowSec = 0.12
): ValidationSample[] {
  if (samples.length <= 2) return samples;
  const voicedPitches = samples.filter((s) => s.pitchMidi > 0).map((s) => s.pitchMidi).sort((a, b) => a - b);
  const globalMed = voicedPitches.length > 0 ? voicedPitches[Math.floor(voicedPitches.length / 2)] : (targetMidi ?? 60);
  const ref = targetMidi && Math.abs(globalMed - targetMidi) <= 2.5 ? targetMidi : globalMed;

  const despiked = samples.map((s) => {
    if (s.pitchMidi <= 0) return s;
    let p = s.pitchMidi;
    if (Math.abs(p - 12 - ref) <= 0.9 && Math.abs(p - ref) >= 10.5) p -= 12;
    else if (Math.abs(p + 12 - ref) <= 0.9 && Math.abs(p - ref) >= 10.5) p += 12;
    return { ...s, pitchMidi: p };
  });

  const halfWin = windowSec * 0.5;
  return despiked.map((s, idx) => {
    if (s.pitchMidi <= 0) return s;
    const neighbors: Array<{ pitch: number; w: number }> = [];
    for (let j = Math.max(0, idx - 8); j <= Math.min(despiked.length - 1, idx + 8); j++) {
      const n = despiked[j];
      if (n.pitchMidi > 0 && Math.abs(n.timeSec - s.timeSec) <= halfWin) {
        neighbors.push({ pitch: n.pitchMidi, w: Math.max(0.01, (n.clarity ?? 0.85) * n.rms) });
      }
    }
    if (neighbors.length <= 1) return s;
    neighbors.sort((a, b) => a.pitch - b.pitch);
    const totalW = neighbors.reduce((a, b) => a + b.w, 0);
    let accW = 0, medPitch = s.pitchMidi;
    for (const item of neighbors) {
      accW += item.w;
      if (accW >= totalW * 0.5) { medPitch = item.pitch; break; }
    }
    return { ...s, pitchMidi: medPitch };
  });
}

export function validateAmbitusNote(
  targetMidi: number, samples: ValidationSample[], targetHoldSec = AMBITUS_HOLD_SEC, minProjectionRms = MIN_PROJECTION_RMS
): AmbitusStepResult {
  const noteName = midiToNoteName(targetMidi);
  const smoothed = smoothAmbitusSamples(samples, targetMidi, 0.12);
  const voiced = smoothed.filter((s) => s.pitchMidi > 0 && s.rms >= minProjectionRms * 0.35);

  if (voiced.length < 4) {
    return { note: noteName, midi: targetMidi, heldDurationSec: 0, avgRms: 0, isSolid: false, status: 'failed_low_power', messageKey: 'ambitusCoachingNeedPower' };
  }

  const firstTime = voiced[0].timeSec, lastTime = voiced[voiced.length - 1].timeSec;
  const durationSec = lastTime - firstTime;
  const avgRms = voiced.reduce((acc, s) => acc + s.rms, 0) / voiced.length;

  if (avgRms < minProjectionRms) {
    return { note: noteName, midi: targetMidi, heldDurationSec: durationSec, avgRms, isSolid: false, status: 'failed_low_power', messageKey: 'ambitusCoachingNeedPower' };
  }

  let maxGapSec = 0;
  for (let i = 1; i < voiced.length; i++) {
    const gap = voiced[i].timeSec - voiced[i - 1].timeSec;
    if (gap > maxGapSec) maxGapSec = gap;
  }

  const requiredHoldSec = Math.min(MIN_STABLE_HOLD_SEC, targetHoldSec * 0.75);
  if (durationSec < requiredHoldSec || maxGapSec > MAX_CONTINUITY_GAP_SEC) {
    return { note: noteName, midi: targetMidi, heldDurationSec: durationSec, avgRms, isSolid: false, status: 'failed_pitch', messageKey: 'ambitusCoachingTooShort' };
  }

  const avgDiff = voiced.reduce((acc, s) => acc + (s.pitchMidi - targetMidi), 0) / voiced.length;
  if (avgDiff < -PITCH_TOLERANCE_SEMITONES) {
    return { note: noteName, midi: targetMidi, heldDurationSec: durationSec, avgRms, isSolid: false, status: 'failed_pitch', messageKey: 'ambitusCoachingTooLow' };
  }
  if (avgDiff > PITCH_TOLERANCE_SEMITONES) {
    return { note: noteName, midi: targetMidi, heldDurationSec: durationSec, avgRms, isSolid: false, status: 'failed_pitch', messageKey: 'ambitusCoachingTooHigh' };
  }

  const meanPitch = voiced.reduce((acc, s) => acc + s.pitchMidi, 0) / voiced.length;
  const varianceCents = voiced.reduce((acc, s) => acc + Math.pow((s.pitchMidi - meanPitch) * 100, 2), 0) / voiced.length;
  if (Math.sqrt(varianceCents) > MAX_JITTER_CENTS) {
    return { note: noteName, midi: targetMidi, heldDurationSec: durationSec, avgRms, isSolid: false, status: 'failed_sagging', messageKey: 'ambitusCoachingSagging' };
  }

  const tailBoundary = lastTime - 0.5;
  const coreWindow = voiced.filter((s) => s.timeSec <= tailBoundary);
  const finalWindow = voiced.filter((s) => s.timeSec > tailBoundary);
  if (coreWindow.length > 0 && finalWindow.length > 0) {
    const avgCore = coreWindow.reduce((a, s) => a + s.pitchMidi, 0) / coreWindow.length;
    const avgFinal = finalWindow.reduce((a, s) => a + s.pitchMidi, 0) / finalWindow.length;
    if ((avgCore - avgFinal) * 100 > MAX_SAGGING_CENTS) {
      return { note: noteName, midi: targetMidi, heldDurationSec: durationSec, avgRms, isSolid: false, status: 'failed_sagging', messageKey: 'ambitusCoachingSagging' };
    }
  }

  return { note: noteName, midi: targetMidi, heldDurationSec: durationSec, avgRms, isSolid: true, status: 'solid', messageKey: 'ambitusNoteSolidSuccess' };
}
