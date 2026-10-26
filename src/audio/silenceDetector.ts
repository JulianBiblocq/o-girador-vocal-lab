/**
 * silenceDetector.ts
 * Détection automatique des phrases vocales par analyse d'énergie RMS et silences (< 110 lignes).
 */
import type { SliceSegment } from '../types/slicerSegments.types';

export interface SilenceDetectorOptions {
  minPhraseDurationSec?: number;
  minSilenceDurationSec?: number;
  thresholdRatio?: number;
  marginSec?: number;
  minRmsFloor?: number;
}

export function detectVocalPhrases(
  pcm: Float32Array,
  sampleRate: number,
  options?: SilenceDetectorOptions
): SliceSegment[] {
  const durationSec = pcm.length / sampleRate;
  if (durationSec <= 0.5) return [];

  const minPhraseDur = options?.minPhraseDurationSec ?? 0.60;
  const minSilenceDur = options?.minSilenceDurationSec ?? 0.40;
  const threshRatio = options?.thresholdRatio ?? 0.09;
  const marginSec = options?.marginSec ?? 0.20;
  const minRmsFloor = options?.minRmsFloor ?? 0.012;

  const frameMs = 35;
  const hopMs = 15;
  const frameSize = Math.max(64, Math.floor(sampleRate * (frameMs / 1000)));
  const hopSize = Math.max(32, Math.floor(sampleRate * (hopMs / 1000)));
  const numFrames = Math.floor((pcm.length - frameSize) / hopSize);
  if (numFrames <= 0) return [];

  const rmsValues = new Float32Array(numFrames);
  let maxRms = 0;

  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    let sumSq = 0;
    for (let j = 0; j < frameSize; j += 2) {
      const v = pcm[start + j] || 0;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / (frameSize / 2));
    rmsValues[i] = rms;
    if (rms > maxRms) maxRms = rms;
  }

  if (maxRms < 0.005) {
    return [{ id: `seg-${Date.now()}-0`, startSec: 0, endSec: Math.min(durationSec, 8), targetPatternId: 'ignore' }];
  }

  const threshold = Math.max(minRmsFloor, maxRms * threshRatio);
  const minSilenceFrames = Math.floor((minSilenceDur * 1000) / hopMs);
  const minPhraseFrames = Math.floor((minPhraseDur * 1000) / hopMs);

  const rawRegions: Array<{ startSec: number; endSec: number }> = [];
  let inVoice = false;
  let phraseStartFrame = 0;
  let silenceCount = 0;

  for (let i = 0; i < numFrames; i++) {
    const isAbove = rmsValues[i] >= threshold;
    if (!inVoice) {
      if (isAbove) {
        inVoice = true;
        phraseStartFrame = i;
        silenceCount = 0;
      }
    } else {
      if (!isAbove) {
        silenceCount++;
        if (silenceCount >= minSilenceFrames) {
          const phraseEndFrame = i - silenceCount;
          if (phraseEndFrame - phraseStartFrame >= minPhraseFrames) {
            rawRegions.push({
              startSec: (phraseStartFrame * hopMs) / 1000,
              endSec: (phraseEndFrame * hopMs + frameMs) / 1000,
            });
          }
          inVoice = false;
          silenceCount = 0;
        }
      } else {
        silenceCount = 0;
      }
    }
  }

  if (inVoice && numFrames - phraseStartFrame >= minPhraseFrames) {
    rawRegions.push({
      startSec: (phraseStartFrame * hopMs) / 1000,
      endSec: durationSec,
    });
  }

  if (rawRegions.length === 0) {
    return [{ id: `seg-${Date.now()}-0`, startSec: 0, endSec: Math.min(durationSec, 8), targetPatternId: 'ignore' }];
  }

  // Ajout de marge et fusion des éventuels chevauchements
  const segments: SliceSegment[] = [];
  rawRegions.forEach((r, idx) => {
    const start = Math.max(0, r.startSec - marginSec);
    const end = Math.min(durationSec, r.endSec + marginSec);

    if (segments.length > 0 && start <= segments[segments.length - 1].endSec + 0.1) {
      segments[segments.length - 1].endSec = Math.max(segments[segments.length - 1].endSec, end);
    } else {
      segments.push({
        id: `seg-${Date.now()}-${idx}`,
        startSec: Math.round(start * 100) / 100,
        endSec: Math.round(end * 100) / 100,
        targetPatternId: 'ignore',
      });
    }
  });

  return segments;
}
