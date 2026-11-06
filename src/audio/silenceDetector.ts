/**
 * silenceDetector.ts
 * Détection automatique des phrases vocales par double seuil d'hystérésis adaptatif (P15 / P85)
 * et recalage sur passage à zéro exact (< 130 lignes).
 */
import { estimateSegmentMetrics, type SliceSegment } from '../types/slicerSegments.types';
import { snapToNearestZeroCrossing } from '../utils/slicerBoundaryOptimizer';

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
  const marginSec = options?.marginSec ?? 0.20;
  const minRmsFloor = options?.minRmsFloor ?? 0.008;

  const frameMs = 35, hopMs = 15;
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

  // Percentiles P15 (bruit de fond de la pièce) et P85 (niveau vocal actif)
  const sortedRms = Array.from(rmsValues).sort((a, b) => a - b);
  const p15 = sortedRms[Math.floor(sortedRms.length * 0.15)] ?? 0;
  const p85 = Math.max(p15 + 0.01, sortedRms[Math.floor(sortedRms.length * 0.85)] ?? maxRms);
  const span = Math.max(0.005, p85 - p15);
  const tOn = Math.max(minRmsFloor, p15 + 0.18 * span, options?.thresholdRatio ? maxRms * options.thresholdRatio : 0);
  const tOff = Math.max(minRmsFloor * 0.45, p15 + 0.04 * span);

  const minSilenceFrames = Math.floor((minSilenceDur * 1000) / hopMs);
  const minPhraseFrames = Math.floor((minPhraseDur * 1000) / hopMs);

  const rawRegions: Array<{ startSec: number; endSec: number }> = [];
  let inVoice = false, phraseStartFrame = 0, silenceCount = 0;

  for (let i = 0; i < numFrames; i++) {
    const rms = rmsValues[i];
    if (!inVoice) {
      if (rms >= tOn) {
        inVoice = true;
        // Remonter au début d'attaque (> tOff)
        let k = i;
        while (k > 0 && k > i - 6 && rmsValues[k - 1] >= tOff) k--;
        phraseStartFrame = k;
        silenceCount = 0;
      }
    } else {
      if (rms < tOff) {
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
    rawRegions.push({ startSec: (phraseStartFrame * hopMs) / 1000, endSec: durationSec });
  }
  if (rawRegions.length === 0) {
    return [{ id: `seg-${Date.now()}-0`, startSec: 0, endSec: Math.min(durationSec, 8), targetPatternId: 'ignore' }];
  }

  const segments: SliceSegment[] = [];
  rawRegions.forEach((r, idx) => {
    const rawStart = Math.max(0, r.startSec - marginSec);
    const rawEnd = Math.min(durationSec, r.endSec + marginSec);
    const start = snapToNearestZeroCrossing(pcm, sampleRate, rawStart, 5);
    const end = snapToNearestZeroCrossing(pcm, sampleRate, rawEnd, 5);

    if (segments.length > 0 && start <= segments[segments.length - 1].endSec + 0.1) {
      segments[segments.length - 1].endSec = Math.max(segments[segments.length - 1].endSec, end);
    } else {
      const met = estimateSegmentMetrics(end - start);
      segments.push({
        id: `seg-${Date.now()}-${idx}`, startSec: start, endSec: end, targetPatternId: 'ignore',
        measuresCount: met.measuresCount, hasAnacrusis: met.hasAnacrusis, hasTailBeat: met.hasTailBeat,
      });
    }
  });

  return segments;
}
