/**
 * vocalOnsetDetector.ts
 * Détection automatique du P-Center / Onset Vocal et auto-calage de l'ancre T1 (< 120 lignes).
 * Gère les attaques thétiques (Temps 1), les anacrouses (+1T..+3T) et les entrées post-silence ([1]_ [2]_ [3]Trouxe).
 */
import type { TimeAnchor } from '../types/toadaDocument.types';

export interface AutoSnapT1Params {
  pcm: Float32Array;
  sampleRate: number;
  bpm: number;
  timeAnchors?: TimeAnchor[];
  hasAnacrusis: boolean;
  beatsPerMeasure: number;
  expectedT1Sec: number;
}

/**
 * Calcule le décalage théorique (en secondes) entre l'ancre T1 et la 1re attaque vocale attendue.
 * - < 0 si la 1re syllabe démarre en anacrouse avant T1.
 * - = 0 si la 1re syllabe démarre pile sur le Temps 1.
 * - > 0 si la 1re syllabe démarre après des temps de silence initiaux (ex: [1]_ [2]_ [3]Trouxe).
 */
export function computeExpectedVocalEntryOffsetSec(
  bpm: number,
  timeAnchors: TimeAnchor[] | undefined,
  hasAnacrusis: boolean,
  beatsPerMeasure: number
): number {
  const safeBpm = Math.max(30, bpm || 88);
  const beatDur = 60 / safeBpm;
  const B = Math.max(1, beatsPerMeasure || 4);

  const firstSung = timeAnchors?.find(
    (a) => !a.isInitialRest && !a.isRest && ((a.syllables && a.syllables.length > 0) || (a.textSlice && a.textSlice.trim().length > 0))
  );

  if (hasAnacrusis) {
    if (firstSung) {
      if (firstSung.measureOffset === 0) {
        const b = Math.max(1, Math.min(B, firstSung.beat));
        return -(B - (b - 1)) * beatDur;
      }
      const mAfterT1 = Math.max(0, firstSung.measureOffset - 1);
      return (mAfterT1 * B + Math.max(0, firstSung.beat - 1)) * beatDur;
    }
    return -1 * beatDur;
  }

  if (firstSung) {
    const m = Math.max(0, firstSung.measureOffset || 0);
    const b = Math.max(1, firstSung.beat || 1);
    return (m * B + (b - 1)) * beatDur;
  }

  return 0;
}

/**
 * Détecte l'attaque vocale réelle (P-Center) autour de la position attendue et retourne le t1OffsetSec recalé.
 */
export function autoSnapT1ToVocalOnset(params: AutoSnapT1Params): number {
  const { pcm, sampleRate, bpm, timeAnchors, hasAnacrusis, beatsPerMeasure, expectedT1Sec } = params;
  if (!pcm || pcm.length === 0 || sampleRate <= 0) return Math.max(0, expectedT1Sec);

  const totalSec = pcm.length / sampleRate;
  const entryOffsetSec = computeExpectedVocalEntryOffsetSec(bpm, timeAnchors, hasAnacrusis, beatsPerMeasure);
  const expectedOnsetSec = expectedT1Sec + entryOffsetSec;

  const searchStartSec = Math.max(0.02, expectedOnsetSec - 0.35);
  const searchEndSec = Math.min(totalSec - 0.03, expectedOnsetSec + 0.45);
  if (searchEndSec <= searchStartSec + 0.04) return Math.max(0, expectedT1Sec);

  const winSamples = Math.max(64, Math.round(sampleRate * 0.01));
  const hopSamples = Math.max(32, Math.round(sampleRate * 0.005));
  const preNoiseStartSec = Math.max(0.01, searchStartSec - 0.25);

  const startSample = Math.floor(preNoiseStartSec * sampleRate);
  const endSample = Math.min(pcm.length - winSamples, Math.floor(searchEndSec * sampleRate));
  if (endSample <= startSample) return Math.max(0, expectedT1Sec);

  const frames: { timeSec: number; rms: number; inSearchWindow: boolean }[] = [];
  for (let s = startSample; s <= endSample; s += hopSamples) {
    let sumSq = 0;
    let prev = pcm[Math.max(0, s - 1)];
    for (let i = 0; i < winSamples; i++) {
      const cur = pcm[s + i];
      const hp = cur - 0.95 * prev;
      prev = cur;
      sumSq += hp * hp;
    }
    const timeSec = (s + winSamples * 0.5) / sampleRate;
    frames.push({
      timeSec,
      rms: Math.sqrt(sumSq / winSamples),
      inSearchWindow: timeSec >= searchStartSec && timeSec <= searchEndSec,
    });
  }

  const searchFrames = frames.filter((f) => f.inSearchWindow);
  if (searchFrames.length < 4) return Math.max(0, expectedT1Sec);

  const sortedAll = [...frames].map((f) => f.rms).sort((a, b) => a - b);
  const sortedSearch = [...searchFrames].map((f) => f.rms).sort((a, b) => a - b);
  const noiseRms = sortedAll[Math.floor(sortedAll.length * 0.15)] ?? 0;
  const peakRms = sortedSearch[Math.floor(sortedSearch.length * 0.95)] ?? 0;

  if (peakRms < Math.max(0.012, noiseRms * 3.0)) {
    return Math.max(0, expectedT1Sec);
  }

  const threshold = noiseRms + 0.22 * (peakRms - noiseRms);
  for (let i = 0; i < searchFrames.length - 1; i++) {
    if (searchFrames[i].rms >= threshold && searchFrames[i + 1].rms >= threshold) {
      const detectedOnsetSec = searchFrames[i].timeSec;
      const snappedT1 = detectedOnsetSec - entryOffsetSec;
      return Math.max(0.01, Math.round(snappedT1 * 1000) / 1000);
    }
  }

  return Math.max(0, expectedT1Sec);
}
