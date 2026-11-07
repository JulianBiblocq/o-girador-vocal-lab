/**
 * ambitusStorage.ts
 * Lecture/écriture unifiée du Profil d'Ambitus (`vocal_lab_ambitus_profile_v1`) et bornes vocales effectives (< 105 lignes).
 */
import type { VocalProfilePayload, TessitureType } from '../types/vocalProfile.types';
import type { VocalPatternItem } from '../types/toadaProject.types';
import type { TessituraRange } from '../types/tessitura.types';
import { noteNameToMidi, midiToNoteName, midiToFrequency } from './noteUtils';

export const AMBITUS_PROFILE_STORAGE_KEY = 'vocal_lab_ambitus_profile_v1';
const LEGACY_STORAGE_KEY = 'o_girador_vocal_profile';

export interface EffectiveVocalBounds {
  minMidi: number; maxMidi: number; comfortMidi: number; minHz: number; maxHz: number; isFromAmbitusTest: boolean;
}

export function determineTessiture(_lowestMidi: number, _highestMidi: number, centerMidi: number): TessitureType {
  if (centerMidi <= 46) return 'basse';
  if (centerMidi <= 52) return 'baryton';
  if (centerMidi <= 57) return 'tenor';
  if (centerMidi <= 62) return 'alto';
  return centerMidi <= 67 ? 'mezzo-soprano' : 'soprano';
}

export function createVocalProfilePayload(lowestMidi: number, highestMidi: number, stairsAccuracyPct?: number, persist = false): VocalProfilePayload {
  const center = Math.round((lowestMidi + highestMidi) / 2), range = Math.max(0, highestMidi - lowestMidi);
  const payload: VocalProfilePayload = {
    vocalProfile: {
      lowestSolidNote: midiToNoteName(lowestMidi), lowestMidi, highestSolidNote: midiToNoteName(highestMidi), highestMidi,
      comfortCenterNote: midiToNoteName(center), comfortCenterMidi: center, stairsAccuracyPct: stairsAccuracyPct ?? 90,
      tessiture: determineTessiture(lowestMidi, highestMidi, center), rangeSemitones: range,
      lastEvaluatedAt: new Date().toISOString(), sourceApp: 'o-girador-vocal-lab',
    },
  };
  if (persist) saveVocalProfile(payload);
  return payload;
}

export function saveVocalProfile(payload: VocalProfilePayload): void {
  try {
    const vp = payload.vocalProfile, low = vp.lowestMidi ?? noteNameToMidi(vp.lowestSolidNote);
    const high = vp.highestMidi ?? noteNameToMidi(vp.highestSolidNote), comfort = vp.comfortCenterMidi ?? noteNameToMidi(vp.comfortCenterNote);
    localStorage.setItem(AMBITUS_PROFILE_STORAGE_KEY, JSON.stringify({ ...payload, minMidi: low, maxMidi: high, comfortMidi: comfort, medianMidi: comfort }));
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(payload));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('ogirador-ambitus-updated'));
  } catch {}
}

function readRawAmbitusObject(): any | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(AMBITUS_PROFILE_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function hasSavedAmbitusProfile(): boolean {
  const p = readRawAmbitusObject();
  if (!p) return false;
  const minM = p.minMidi ?? p.lowestMidi ?? p.vocalProfile?.lowestMidi, maxM = p.maxMidi ?? p.highestMidi ?? p.vocalProfile?.highestMidi;
  return typeof minM === 'number' && typeof maxM === 'number' && maxM > minM;
}

export function loadVocalProfile(): VocalProfilePayload | null {
  const p = readRawAmbitusObject();
  if (!p) return null;
  if (p.vocalProfile) return p as VocalProfilePayload;
  return typeof p.minMidi === 'number' && typeof p.maxMidi === 'number' ? createVocalProfilePayload(p.minMidi, p.maxMidi, 90, false) : null;
}

export function getEffectiveVocalBounds(projectTessitura?: TessituraRange): EffectiveVocalBounds {
  const p = readRawAmbitusObject();
  if (p) {
    const rawMin = p.minMidi ?? p.lowestMidi ?? p.vocalProfile?.lowestMidi, rawMax = p.maxMidi ?? p.highestMidi ?? p.vocalProfile?.highestMidi;
    if (typeof rawMin === 'number' && typeof rawMax === 'number' && rawMax >= rawMin) {
      const comfortMidi = p.comfortMidi ?? p.medianMidi ?? p.vocalProfile?.comfortCenterMidi ?? Math.round((rawMin + rawMax) / 2);
      const minMidi = Math.max(30, rawMin - 2), maxMidi = Math.min(92, rawMax + 2);
      return { minMidi, maxMidi, comfortMidi, minHz: midiToFrequency(minMidi), maxHz: midiToFrequency(maxMidi), isFromAmbitusTest: true };
    }
  }
  if (projectTessitura && projectTessitura.presetId !== 'libre') {
    const minMidi = projectTessitura.minPitchMidi, maxMidi = projectTessitura.maxPitchMidi, comfortMidi = Math.round((minMidi + maxMidi) / 2);
    return { minMidi, maxMidi, comfortMidi, minHz: midiToFrequency(minMidi), maxHz: midiToFrequency(maxMidi), isFromAmbitusTest: false };
  }
  return { minMidi: 43, maxMidi: 69, comfortMidi: 55, minHz: midiToFrequency(43), maxHz: midiToFrequency(69), isFromAmbitusTest: false };
}

export function analyzeToadaCompatibility(payload: VocalProfilePayload, patterns: VocalPatternItem[]) {
  let minMidi = 127, maxMidi = 0;
  patterns.forEach((pat) => [...(pat.anacrusisSteps || []), ...(pat.mainSteps || [])].forEach((s) => {
    if (s.active && s.note !== '───') { const m = s.midiNumber || noteNameToMidi(s.note); if (m < minMidi) minMidi = m; if (m > maxMidi) maxMidi = m; }
  }));
  if (minMidi > maxMidi) return { isCompatible: true, suggestedTranspositionSemitones: 0, minMidi: 60, maxMidi: 60 };
  const uLow = noteNameToMidi(payload.vocalProfile.lowestSolidNote), uHigh = noteNameToMidi(payload.vocalProfile.highestSolidNote);
  const uCenter = noteNameToMidi(payload.vocalProfile.comfortCenterNote), tCenter = Math.round((minMidi + maxMidi) / 2), isCompatible = minMidi >= uLow && maxMidi <= uHigh;
  return { isCompatible, suggestedTranspositionSemitones: isCompatible ? 0 : (uCenter - tCenter), minMidi, maxMidi };
}
