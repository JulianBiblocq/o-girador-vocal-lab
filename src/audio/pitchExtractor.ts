/**
 * pitchExtractor.ts
 * Algorithme YIN multi-candidats avec repliement Plancher/Plafond et décodeur Viterbi (< 130 lignes).
 */
import type { PitchCurvePoint } from '../types/vocalPack.types';
import type { TessituraRange } from '../types/tessitura.types';
import { foldPitchToTessitura } from '../types/tessitura.types';
import { frequencyToMidiFloat } from '../utils/noteUtils';
import { sanitizePitchCurve } from './pitchCurveSanitizer';
import { preFilterAudioForPitchDetection } from './pitchPreFilter';
import { trackViterbiPitch, type CandidateFrame, type PitchCandidate } from './viterbiPitchTracker';

export interface PitchExtractorOptions {
  sampleRate: number;
  totalDurationSec: number;
  trimStartSec: number;
  trimEndSec: number;
  tessitura?: TessituraRange;
  yinThreshold?: number;
  rmsGate?: number;
}

export function extractContinuousPitchCurve(pcm: Float32Array, options: PitchExtractorOptions): PitchCurvePoint[] {
  const { sampleRate, totalDurationSec, trimStartSec, trimEndSec, tessitura, yinThreshold = 0.45, rmsGate = 0.010 } = options;
  if (!pcm || pcm.length === 0) return [];

  const analysisPCM = preFilterAudioForPitchDetection(pcm, sampleRate, 85, 1200);
  const windowSize = 1024, hopSize = Math.max(128, Math.floor(sampleRate * 0.01));
  const minFreq = 65, maxFreq = 1050; // C2..C6
  const minPeriod = Math.floor(sampleRate / maxFreq), maxPeriod = Math.min(windowSize - 1, Math.floor(sampleRate / minFreq));

  const diff = new Float32Array(maxPeriod + 1);
  const candidateFrames: CandidateFrame[] = [];
  const totalFrames = Math.floor((pcm.length - windowSize) / hopSize);

  for (let frame = 0; frame < totalFrames; frame++) {
    const startIdx = frame * hopSize, timeSec = startIdx / sampleRate;
    if (timeSec < trimStartSec - 0.02 || timeSec > trimEndSec + 0.02) continue;
    if (timeSec > totalDurationSec) break;

    let sumSq = 0, zc = 0;
    for (let j = 0; j < windowSize; j++) {
      const s = pcm[startIdx + j];
      sumSq += s * s;
      if (j > 0 && ((s >= 0 && pcm[startIdx + j - 1] < 0) || (s < 0 && pcm[startIdx + j - 1] >= 0))) zc++;
    }
    const rms = Math.sqrt(sumSq / windowSize);
    const zcr = zc / windowSize;
    if (rms < rmsGate || zcr > 0.42) {
      candidateFrames.push({ timeSec, rms, zcr, isVoiced: false, candidates: [] });
      continue;
    }

    diff[0] = 0;
    for (let tau = 1; tau <= maxPeriod; tau++) {
      let d = 0;
      for (let j = 0; j < windowSize; j++) {
        const delta = analysisPCM[startIdx + j] - analysisPCM[startIdx + j + tau];
        d += delta * delta;
      }
      diff[tau] = d;
    }

    diff[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau <= maxPeriod; tau++) {
      runningSum += diff[tau];
      diff[tau] = runningSum > 0 ? (diff[tau] * tau) / runningSum : 1;
    }

    // Extraction des K meilleurs minima locaux (Multi-Candidats)
    const frameCandidates: PitchCandidate[] = [];
    for (let tau = minPeriod + 1; tau < maxPeriod; tau++) {
      if (diff[tau] < diff[tau - 1] && diff[tau] <= diff[tau + 1] && diff[tau] < yinThreshold) {
        let refinedTau = tau;
        const s0 = diff[tau - 1], s1 = diff[tau], s2 = diff[tau + 1];
        const denom = 2 * (s0 - 2 * s1 + s2);
        if (Math.abs(denom) > 1e-6) refinedTau += (s0 - s2) / denom;

        const freq = sampleRate / refinedTau;
        if (freq >= minFreq && freq <= maxFreq) {
          const midiFloat = frequencyToMidiFloat(freq);
          const conf = Math.max(0.02, 1 - diff[tau]);
          frameCandidates.push({ midiFloat, aperiodicity: diff[tau], confidence: conf, folded: false });

          // Repliement d'harmonique dans la plage Plancher/Plafond
          if (tessitura) {
            const folded = foldPitchToTessitura(midiFloat, tessitura);
            if (folded.folded) {
              frameCandidates.push({
                midiFloat: folded.midiFloat,
                aperiodicity: diff[tau] + 0.05,
                confidence: Math.max(0.01, conf * 0.88),
                folded: true,
              });
            }
          }
        }
      }
    }

    frameCandidates.sort((a, b) => b.confidence - a.confidence);
    const topCandidates = frameCandidates.slice(0, 4);

    candidateFrames.push({
      timeSec,
      rms,
      zcr,
      isVoiced: topCandidates.length > 0,
      candidates: topCandidates,
    });
  }

  // Décodage optimal global par Trellis Viterbi
  const viterbiCurve = trackViterbiPitch(candidateFrames, tessitura);
  return sanitizePitchCurve(viterbiCurve);
}
