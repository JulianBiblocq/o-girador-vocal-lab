/**
 * ambitusStorage.ts
 * Gestion du stockage LocalStorage/IndexedDB et export JSON du profil vocal (< 100 lignes).
 */
import type { VocalProfilePayload, TessitureType } from '../types/vocalProfile.types';
import type { VocalPatternItem } from '../types/toadaProject.types';
import { noteNameToMidi, midiToNoteName } from './noteUtils';

const STORAGE_KEY = 'o_girador_vocal_profile';

export function determineTessiture(_lowestMidi: number, _highestMidi: number, centerMidi: number): TessitureType {
  if (centerMidi <= 46) return 'basse';
  if (centerMidi <= 52) return 'baryton';
  if (centerMidi <= 57) return 'tenor';
  if (centerMidi <= 62) return 'alto';
  if (centerMidi <= 67) return 'mezzo-soprano';
  return 'soprano';
}

export function createVocalProfilePayload(lowestMidi: number, highestMidi: number, stairsAccuracyPct?: number): VocalProfilePayload {
  const center = Math.round((lowestMidi + highestMidi) / 2);
  const range = Math.max(0, highestMidi - lowestMidi);
  const tess = determineTessiture(lowestMidi, highestMidi, center);
  const payload: VocalProfilePayload = {
    vocalProfile: {
      lowestSolidNote: midiToNoteName(lowestMidi),
      lowestMidi,
      highestSolidNote: midiToNoteName(highestMidi),
      highestMidi,
      comfortCenterNote: midiToNoteName(center),
      comfortCenterMidi: center,
      stairsAccuracyPct: stairsAccuracyPct ?? 90,
      tessiture: tess,
      rangeSemitones: range,
      lastEvaluatedAt: new Date().toISOString(),
      sourceApp: 'o-girador-vocal-lab',
    },
  };
  saveVocalProfile(payload);
  return payload;
}

export function saveVocalProfile(payload: VocalProfilePayload): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(payload)); } catch {}
}

export function loadVocalProfile(): VocalProfilePayload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}


export function analyzeToadaCompatibility(payload: VocalProfilePayload, patterns: VocalPatternItem[]) {
  let minMidi = 127, maxMidi = 0;
  patterns.forEach((pat) => {
    const steps = [...(pat.anacrusisSteps || []), ...(pat.mainSteps || [])];
    steps.forEach((s) => {
      if (s.active && s.note !== '───') {
        const m = s.midiNumber || noteNameToMidi(s.note);
        if (m < minMidi) minMidi = m;
        if (m > maxMidi) maxMidi = m;
      }
    });
  });
  if (minMidi > maxMidi) return { isCompatible: true, suggestedTranspositionSemitones: 0, minMidi: 60, maxMidi: 60 };

  const userLowestMidi = noteNameToMidi(payload.vocalProfile.lowestSolidNote);
  const userHighestMidi = noteNameToMidi(payload.vocalProfile.highestSolidNote);
  const userCenterMidi = noteNameToMidi(payload.vocalProfile.comfortCenterNote);
  const toadaCenterMidi = Math.round((minMidi + maxMidi) / 2);

  const isCompatible = minMidi >= userLowestMidi && maxMidi <= userHighestMidi;
  const suggestedTranspositionSemitones = isCompatible ? 0 : (userCenterMidi - toadaCenterMidi);
  return { isCompatible, suggestedTranspositionSemitones, minMidi, maxMidi };
}
