/**
 * wsolaTimeStretcher.ts
 * Time-stretching WSOLA à hauteur constante (75% / 85% / 100%) et extraction de la voix calée du Mestre (< 115 lignes).
 */
import type { VocalPatternItem } from '../types/toadaProject.types';
import { rebuildCanonicalCleanAudio } from './melodicExtractionHelper';

/**
 * Étire ou compresse temporellement un signal vocal mono sans modifier sa hauteur (WSOLA Hann 50%).
 * @param speedRatio Ratio de vitesse (ex: 0.75 pour ralentir à 75%, 0.85 pour 85%, 1.0 pour 100%).
 */
export function timeStretchConstantPitch(
  pcm: Float32Array,
  sampleRate: number,
  speedRatio: number
): Float32Array {
  const clampedRatio = Math.max(0.5, Math.min(1.5, speedRatio || 1.0));
  if (!pcm || pcm.length === 0 || Math.abs(clampedRatio - 1.0) < 0.015) {
    return pcm;
  }

  const winLen = Math.max(256, Math.round(sampleRate * 0.032));
  const hopS = Math.floor(winLen / 2);
  const hopA = Math.max(1, Math.round(hopS * clampedRatio));
  const searchRadius = Math.max(16, Math.round(sampleRate * 0.010));
  const outLen = Math.max(winLen, Math.round(pcm.length / clampedRatio));
  const out = new Float32Array(outLen);
  const norm = new Float32Array(outLen);

  const hann = new Float32Array(winLen);
  for (let i = 0; i < winLen; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (winLen - 1)));
  }

  let anaPos = 0;
  let synPos = 0;
  let prevChosenAna = 0;

  while (synPos + winLen <= outLen && anaPos + winLen < pcm.length) {
    let bestOffset = 0;
    if (synPos > 0) {
      const naturalCont = prevChosenAna + hopS;
      const minCand = Math.max(0, anaPos - searchRadius);
      const maxCand = Math.min(pcm.length - winLen - 1, anaPos + searchRadius);
      let bestCorr = -Infinity;
      const cmpLen = Math.min(hopS, pcm.length - naturalCont - 1);

      if (cmpLen > 32 && naturalCont + cmpLen < pcm.length) {
        for (let cand = minCand; cand <= maxCand; cand += 4) {
          let corr = 0;
          for (let k = 0; k < cmpLen; k += 4) {
            corr += pcm[naturalCont + k] * pcm[cand + k];
          }
          if (corr > bestCorr) {
            bestCorr = corr;
            bestOffset = cand - anaPos;
          }
        }
      }
    }

    const chosenAna = Math.max(0, Math.min(pcm.length - winLen, anaPos + bestOffset));
    for (let i = 0; i < winLen; i++) {
      const w = hann[i];
      out[synPos + i] += pcm[chosenAna + i] * w;
      norm[synPos + i] += w;
    }

    prevChosenAna = chosenAna;
    synPos += hopS;
    anaPos += hopA;
  }

  for (let i = 0; i < outLen; i++) {
    if (norm[i] > 1e-4) out[i] /= norm[i];
  }
  return out;
}

/**
 * Retourne le buffer vocal canonique du Mestre (calé sur T1) pour l'entraînement synchronisé.
 */
export function extractCanonicalMestreBuffer(
  pattern: VocalPatternItem,
  bpm: number,
  beatsPerMeasure = 4,
  fallbackSampleRate = 44100
): { pcm: Float32Array; sampleRate: number } | null {
  const variant = pattern.variants?.[pattern.activeVariantKey];
  const rec = variant?.recordingResult ?? pattern.recordingResult;
  const sampleRate = pattern.pack?.audio?.sampleRate ?? rec?.sampleRate ?? fallbackSampleRate;
  const activeClean = pattern.correctedAudioSamples ?? pattern.rawAudioSamples;

  if (activeClean && activeClean.length > 0) {
    return { pcm: activeClean, sampleRate };
  }
  if (rec?.pcm && rec.pcm.length > 0) {
    const clean = rebuildCanonicalCleanAudio({
      rawPCM: rec.pcm, sampleRate, bpm, measuresCount: pattern.measuresCount || 2,
      beatsPerMeasure, hasAnacrusis: pattern.hasAnacrusis !== false,
      trimStartSec: variant?.trimStartSec ?? pattern.trimStartSec,
      trimEndSec: variant?.trimEndSec ?? pattern.trimEndSec,
      t1OffsetSec: variant?.t1OffsetSec ?? pattern.t1OffsetSec ?? rec.t1OffsetSec,
    });
    return { pcm: clean, sampleRate };
  }
  return null;
}

/**
 * Extrait uniquement le segment vocal actif découpé (sans silence de pré-roll) pour l'atelier Prononciation.
 */
export function extractTrimmedPhraseAudio(
  pattern: VocalPatternItem,
  fallbackSampleRate = 44100
): { pcm: Float32Array; sampleRate: number } | null {
  const variant = pattern.variants?.[pattern.activeVariantKey];
  const rec = variant?.recordingResult ?? pattern.recordingResult;
  const sampleRate = pattern.pack?.audio?.sampleRate ?? rec?.sampleRate ?? fallbackSampleRate;
  if (pattern.correctedAudioSamples && pattern.correctedAudioSamples.length > 0) {
    const tStart = pattern.pack?.audio?.trim?.startSec ?? 0;
    const tEnd = pattern.pack?.audio?.trim?.endSec ?? (pattern.correctedAudioSamples.length / sampleRate);
    const s0 = Math.max(0, Math.floor(tStart * sampleRate));
    const s1 = Math.min(pattern.correctedAudioSamples.length, Math.ceil(tEnd * sampleRate));
    return { pcm: s1 > s0 ? pattern.correctedAudioSamples.subarray(s0, s1) : pattern.correctedAudioSamples, sampleRate };
  }
  if (rec?.pcm && rec.pcm.length > 0) {
    const tStart = Math.max(0, variant?.trimStartSec ?? pattern.trimStartSec ?? 0);
    const rawEnd = variant?.trimEndSec ?? pattern.trimEndSec ?? 0;
    const tEnd = rawEnd > tStart ? rawEnd : (rec.pcm.length / sampleRate);
    const s0 = Math.max(0, Math.floor(tStart * sampleRate));
    const s1 = Math.min(rec.pcm.length, Math.ceil(tEnd * sampleRate));
    return { pcm: s1 > s0 ? rec.pcm.subarray(s0, s1) : rec.pcm, sampleRate };
  }
  if (pattern.rawAudioSamples && pattern.rawAudioSamples.length > 0) {
    return { pcm: pattern.rawAudioSamples, sampleRate };
  }
  return null;
}

