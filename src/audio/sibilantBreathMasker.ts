/**
 * sibilantBreathMasker.ts
 * Masquage acoustique type Melodyne 5 des consonnes non-voisées (s, z, ch, f, t, k, p) et souffles :
 * Ratio haute fréquence (4.5–8.5 kHz) vs corps vocal (120–900 Hz) + ZCR, et enveloppe interne de brique (< 120 lignes).
 */
import type { PitchCurvePoint, VocalStepData } from '../types/vocalPack.types';
import { getStepTimeWindowSec, findLastTiedStepIndex } from '../utils/tripletBeatHelper';

export interface SibilantFrameDiagnosis {
  isSibilantOrBreath: boolean;
  hfToVocalRatio: number;
  zcrHz: number;
  rms: number;
}

function goertzelPower(frame: Float32Array, start: number, len: number, sampleRate: number, freqHz: number): number {
  if (freqHz <= 40 || freqHz >= sampleRate * 0.48 || len < 16) return 0;
  const coeff = 2 * Math.cos((2 * Math.PI * freqHz) / sampleRate);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < len; i++) {
    s0 = frame[start + i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2) / (len * len);
}

export function analyzeFrameSibilantBreath(
  pcm: Float32Array,
  sampleRate: number,
  startIdx = 0,
  frameLen?: number
): SibilantFrameDiagnosis {
  const len = Math.min(pcm.length - startIdx, frameLen ?? pcm.length);
  if (len < 32) return { isSibilantOrBreath: true, hfToVocalRatio: 0, zcrHz: 0, rms: 0 };

  let sumSq = 0, crossings = 0;
  for (let i = 0; i < len; i++) {
    const v = pcm[startIdx + i];
    sumSq += v * v;
    if (i > 0) {
      const prev = pcm[startIdx + i - 1];
      if ((prev >= 0 && v < 0) || (prev < 0 && v >= 0)) crossings++;
    }
  }
  const rms = Math.sqrt(sumSq / len);
  const zcrHz = (crossings / Math.max(1, len - 1)) * (sampleRate * 0.5);
  if (rms < 0.005) return { isSibilantOrBreath: true, hfToVocalRatio: 0, zcrHz, rms };

  const probeLen = Math.min(len, 512);
  const vocalBody =
    goertzelPower(pcm, startIdx, probeLen, sampleRate, 190) +
    goertzelPower(pcm, startIdx, probeLen, sampleRate, 340) +
    goertzelPower(pcm, startIdx, probeLen, sampleRate, 560) +
    goertzelPower(pcm, startIdx, probeLen, sampleRate, 800);

  const hfSibilant =
    goertzelPower(pcm, startIdx, probeLen, sampleRate, 4800) +
    goertzelPower(pcm, startIdx, probeLen, sampleRate, 5800) +
    goertzelPower(pcm, startIdx, probeLen, sampleRate, 6800) +
    goertzelPower(pcm, startIdx, probeLen, sampleRate, 8000);

  const hfToVocalRatio = hfSibilant / Math.max(1e-10, vocalBody);
  const isSibilantOrBreath = hfToVocalRatio > 1.25 || (zcrHz > 2500 && hfToVocalRatio > 0.45) || zcrHz > 3600;
  return { isSibilantOrBreath, hfToVocalRatio, zcrHz, rms };
}

export function maskSibilantsInPitchCurve(
  pitchCurve: PitchCurvePoint[],
  pcm?: Float32Array | null,
  sampleRate = 48000
): PitchCurvePoint[] {
  if (!pitchCurve.length || !pcm?.length || sampleRate <= 0) return pitchCurve;
  const winLen = Math.max(128, Math.round(sampleRate * 0.024));
  const halfWin = Math.floor(winLen / 2);

  return pitchCurve.map((pt) => {
    if (pt.midiFloat <= 0) return pt;
    const center = Math.round(pt.timeSec * sampleRate);
    const s0 = Math.max(0, Math.min(pcm.length - winLen, center - halfWin));
    const diag = analyzeFrameSibilantBreath(pcm, sampleRate, s0, winLen);
    if (diag.isSibilantOrBreath) return { ...pt, midiFloat: 0, confidence: 0 };
    return pt;
  });
}

export function annotateBricksConsonantAndEnvelope(
  steps: VocalStepData[],
  pcm?: Float32Array | null,
  sampleRate = 48000,
  gridStartSec = 0,
  beatDurSec = 0.6
): VocalStepData[] {
  if (!steps.length || !pcm?.length || sampleRate <= 0) return steps;
  const out = steps.map((s) => ({ ...s }));
  const binsCount = 12;

  for (let i = 0; i < out.length; i++) {
    if (out[i].tripletSlot === 'unused' || !out[i].active || out[i].note === '───') continue;
    const endIdx = findLastTiedStepIndex(out, i);
    const { startSec, endSec } = getStepTimeWindowSec(out, i, gridStartSec, beatDurSec);
    const s0 = Math.max(0, Math.floor(startSec * sampleRate)), s1 = Math.min(pcm.length, Math.floor(endSec * sampleRate));
    if (s1 - s0 >= 128) {
      const bins = new Array<number>(binsCount).fill(0), stepLen = Math.max(1, Math.floor((s1 - s0) / binsCount));
      let maxAmp = 0.04, unvoicedHeadBins = 0, headOngoing = true;
      for (let b = 0; b < binsCount; b++) {
        const bStart = s0 + b * stepLen, diag = analyzeFrameSibilantBreath(pcm, sampleRate, bStart, stepLen);
        bins[b] = diag.rms; if (diag.rms > maxAmp) maxAmp = diag.rms;
        if (headOngoing && b < 6 && diag.isSibilantOrBreath && diag.rms >= 0.008) unvoicedHeadBins++;
        else if (diag.rms >= 0.015 && !diag.isSibilantOrBreath) headOngoing = false;
      }
      out[i] = {
        ...out[i],
        consonantHeadRatio: unvoicedHeadBins > 0 ? Math.min(0.55, Math.max(0.10, (unvoicedHeadBins / binsCount))) : 0.14,
        waveEnvelopeBins: bins.map((v) => Math.round(Math.min(1, v / maxAmp) * 100) / 100),
      };
    }
    i = endIdx;
  }
  return out;
}
