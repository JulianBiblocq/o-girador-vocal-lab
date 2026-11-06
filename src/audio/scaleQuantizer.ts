/**
 * scaleQuantizer.ts
 * Détection automatique et verrouillage de gamme Maracatu (Majeur, Mineur, Mixolydien, Dorien, Pentatonique) (< 125 lignes).
 */
import type { PitchCurvePoint, VocalStepData } from '../types/vocalPack.types';
import { midiToNoteName, NOTE_NAMES } from '../utils/noteUtils';

export type ScaleType =
  | 'chromatic' | 'major' | 'minor' | 'natural_minor'
  | 'mixolydian' | 'dorian' | 'harmonic_minor' | 'pentatonic_minor' | 'pentatonic_major';

export interface ScaleDefinition { label: string; intervals: number[]; }

export const SCALE_DEFINITIONS: Record<ScaleType, ScaleDefinition> = {
  chromatic: { label: 'Chromatique (Libre)', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  major: { label: 'Majeur', intervals: [0, 2, 4, 5, 7, 9, 11] },
  minor: { label: 'Mineur Naturel', intervals: [0, 2, 3, 5, 7, 8, 10] },
  natural_minor: { label: 'Mineur Naturel', intervals: [0, 2, 3, 5, 7, 8, 10] },
  mixolydian: { label: 'Mixolydien / Nordeste (7e min)', intervals: [0, 2, 4, 5, 7, 9, 10] },
  dorian: { label: 'Dorien', intervals: [0, 2, 3, 5, 7, 9, 10] },
  harmonic_minor: { label: 'Mineur Harmonique', intervals: [0, 2, 3, 5, 7, 8, 11] },
  pentatonic_minor: { label: 'Pentatonique Mineure', intervals: [0, 3, 5, 7, 10] },
  pentatonic_major: { label: 'Pentatonique Majeure', intervals: [0, 2, 4, 7, 9] },
};

const SOLFEGE_TO_SEMITONE: Record<string, number> = {
  DO: 0, 'DÓ': 0, C: 0, 'DO#': 1, 'DÓ#': 1, 'C#': 1, DB: 1,
  RE: 2, 'RÉ': 2, D: 2, 'RE#': 3, 'RÉ#': 3, 'D#': 3, EB: 3, MI: 4, E: 4,
  FA: 5, 'FÁ': 5, F: 5, 'FA#': 6, 'FÁ#': 6, 'F#': 6, GB: 6,
  SOL: 7, G: 7, 'SOL#': 8, 'G#': 8, AB: 8, LA: 9, 'LÁ': 9, A: 9,
  'LA#': 10, 'LÁ#': 10, 'A#': 10, BB: 10, SI: 11, B: 11,
};

export function getTonicSemitone(tonic: string): number {
  const clean = (tonic || 'C').replace(/\d+$/, '').trim().toUpperCase();
  if (SOLFEGE_TO_SEMITONE[clean] !== undefined) return SOLFEGE_TO_SEMITONE[clean];
  const idx = (NOTE_NAMES as readonly string[]).indexOf(clean);
  return idx >= 0 ? idx : 0;
}

export function parseDefaultKeyString(keyStr?: string): { tonicSemitone: number; isMinor: boolean } | null {
  if (!keyStr || !keyStr.trim()) return null;
  const raw = keyStr.trim();
  const isMinor = /(?:m|min|mineur|menor)$/i.test(raw) && !/maj|majeur|maior/i.test(raw);
  const rootToken = raw.replace(/(?:m|min|mineur|menor|maj|majeur|maior|\s)+$/gi, '').toUpperCase();
  const semi = SOLFEGE_TO_SEMITONE[rootToken];
  return semi !== undefined ? { tonicSemitone: semi, isMinor } : null;
}

export function buildAllowedPitchClasses(tonic: string, scaleType: ScaleType, customPitchClasses?: number[] | Set<number> | null): Set<number> {
  if (customPitchClasses) {
    const arr = Array.from(customPitchClasses).map((n) => ((n % 12) + 12) % 12);
    if (arr.length > 0) return new Set(arr);
  }
  const def = SCALE_DEFINITIONS[scaleType] || SCALE_DEFINITIONS.chromatic;
  const root = getTonicSemitone(tonic);
  return new Set(def.intervals.map((iv) => (root + iv) % 12));
}

export function snapMidiToScale(
  midiFloat: number, tonicOrSet?: string | Set<number>, scaleType: ScaleType = 'chromatic', customPitchClasses?: number[] | Set<number> | null
): number {
  const allowed: Set<number> | null =
    tonicOrSet instanceof Set ? tonicOrSet
    : customPitchClasses ? buildAllowedPitchClasses(typeof tonicOrSet === 'string' ? tonicOrSet : 'C', scaleType, customPitchClasses)
    : scaleType !== 'chromatic' ? buildAllowedPitchClasses(typeof tonicOrSet === 'string' ? tonicOrSet : 'C', scaleType) : null;

  if (!allowed || allowed.size === 0 || allowed.size >= 12) return Math.round(midiFloat);
  const center = Math.round(midiFloat);
  let bestMidi = center, bestDist = Infinity;
  for (let delta = -6; delta <= 6; delta++) {
    const candidate = center + delta, pc = ((candidate % 12) + 12) % 12;
    if (allowed.has(pc)) {
      const dist = Math.abs(candidate - midiFloat);
      if (dist < bestDist) { bestDist = dist; bestMidi = candidate; }
    }
  }
  return bestMidi;
}

export function detectBestScaleFromPitchCurve(
  pitchCurve: PitchCurvePoint[], defaultKeyStr?: string
): { tonic: string; scaleType: ScaleType; allowedPitchClasses: Set<number>; tuningOffset: number } {
  const valid = (pitchCurve || []).filter((p) => p.midiFloat >= 36 && p.midiFloat <= 96);
  const prior = parseDefaultKeyString(defaultKeyStr);
  if (valid.length < 4) {
    const t = prior ? NOTE_NAMES[prior.tonicSemitone] : 'C', sc: ScaleType = prior?.isMinor ? 'natural_minor' : 'major';
    return { tonic: t, scaleType: sc, allowedPitchClasses: buildAllowedPitchClasses(t, sc), tuningOffset: 0 };
  }
  const devs = valid.map((p) => p.midiFloat - Math.round(p.midiFloat)).sort((a, b) => a - b);
  const tuningOffset = devs[Math.floor(devs.length / 2)] || 0;
  const hist = new Float32Array(12);
  for (let i = 0; i < valid.length; i++) {
    const m = valid[i].midiFloat - tuningOffset, prevM = i > 0 ? valid[i - 1].midiFloat - tuningOffset : m;
    const stability = Math.abs(m - prevM) < 0.35 ? 1.5 : 0.7;
    hist[((Math.round(m) % 12) + 12) % 12] += stability;
  }
  const candidateModes: ScaleType[] = ['major', 'natural_minor', 'mixolydian', 'dorian'];
  let bestRoot = prior ? prior.tonicSemitone : 0, bestMode: ScaleType = prior?.isMinor ? 'natural_minor' : 'major', bestScore = -1;
  for (let r = 0; r < 12; r++) {
    for (const mode of candidateModes) {
      let score = 0;
      for (const iv of SCALE_DEFINITIONS[mode].intervals) score += hist[(r + iv) % 12] * (iv === 0 ? 1.25 : iv === 7 ? 1.1 : 1.0);
      if (prior && prior.tonicSemitone === r) score *= (prior.isMinor === (mode === 'natural_minor' || mode === 'dorian')) ? 1.45 : 1.2;
      if (score > bestScore) { bestScore = score; bestRoot = r; bestMode = mode; }
    }
  }
  const tonic = NOTE_NAMES[bestRoot];
  return { tonic, scaleType: bestMode, allowedPitchClasses: buildAllowedPitchClasses(tonic, bestMode), tuningOffset };
}

export function applyScaleToSteps(steps: VocalStepData[], tonic: string, scaleType: ScaleType, customPitchClasses?: number[] | Set<number> | null): VocalStepData[] {
  const allowed = buildAllowedPitchClasses(tonic, scaleType, customPitchClasses);
  if (scaleType === 'chromatic' && (!customPitchClasses || allowed.size >= 12)) return steps;
  return steps.map((st, idx, arr) => {
    if (!st.active || st.midiNumber <= 0) return st;
    if (st.note === '───') return { ...st, midiNumber: snapMidiToScale(arr[idx - 1]?.midiNumber ?? st.midiNumber, allowed) };
    const snapped = snapMidiToScale(st.midiNumber, allowed);
    return { ...st, midiNumber: snapped, note: midiToNoteName(snapped) };
  });
}
