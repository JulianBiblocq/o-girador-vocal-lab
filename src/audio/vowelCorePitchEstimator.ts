/**
 * vowelCorePitchEstimator.ts
 * Pondération par « Cœur de Voyelle Stationnaire », nettoyage des plongeons consonantiques (<= 75 ms, >= 1.8 ST)
 * et Auto-Calibration circulaire du Diapason A Cappella (< 130 lignes).
 */
import type { PitchCurvePoint } from '../types/vocalPack.types';

export interface StationaryWeightedPoint {
  point: PitchCurvePoint;
  slopeStPerSec: number;
  weight: number;
}

/**
 * 1. Pondération par Cœur de Voyelle Stationnaire :
 * W_i = rms_i * confidence_i^2 * exp(-(slope_i / 10)^2)
 */
export function computeStationaryVowelWeights(pitchCurve: PitchCurvePoint[]): number[] {
  const n = pitchCurve.length;
  if (n === 0) return [];
  const weights = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    const cur = pitchCurve[i];
    if (!Number.isFinite(cur.midiFloat) || cur.midiFloat < 30 || cur.midiFloat > 96) {
      weights[i] = 0;
      continue;
    }
    const prev = i > 0 ? pitchCurve[i - 1] : cur;
    const next = i + 1 < n ? pitchCurve[i + 1] : cur;
    const prevValid = prev.midiFloat >= 30 && Math.abs(cur.timeSec - prev.timeSec) <= 0.08;
    const nextValid = next.midiFloat >= 30 && Math.abs(next.timeSec - cur.timeSec) <= 0.08;

    let slope = 0;
    if (prevValid && nextValid && i > 0 && i + 1 < n) {
      const dt = Math.max(0.005, next.timeSec - prev.timeSec);
      slope = Math.abs(next.midiFloat - prev.midiFloat) / dt;
    } else if (nextValid && i + 1 < n) {
      const dt = Math.max(0.005, next.timeSec - cur.timeSec);
      slope = Math.abs(next.midiFloat - cur.midiFloat) / dt;
    } else if (prevValid && i > 0) {
      const dt = Math.max(0.005, cur.timeSec - prev.timeSec);
      slope = Math.abs(cur.midiFloat - prev.midiFloat) / dt;
    }

    const rms = Math.max(0.01, cur.rms ?? 0.12);
    const conf = Math.max(0.05, Math.min(1.0, cur.confidence ?? 0.9));
    const ratio = slope / 10;
    weights[i] = rms * (conf * conf) * Math.exp(-(ratio * ratio));
  }
  return weights;
}

/**
 * 2. Nettoyage des plongeons consonantiques (<= 75 ms, plongée >= 1.8 ST entre deux voyelles stables).
 */
export function cleanConsonantDipsInPitchCurve(
  pitchCurve: PitchCurvePoint[],
  maxDipDurationSec = 0.075,
  minDipSemitones = 1.8
): PitchCurvePoint[] {
  if (!pitchCurve || pitchCurve.length < 3) return pitchCurve ? [...pitchCurve] : [];
  const out = pitchCurve.map((p) => ({ ...p }));
  const n = out.length;
  let i = 1;

  while (i < n - 1) {
    const leftAnchor = out[i - 1];
    if (leftAnchor.midiFloat < 30 || out[i].midiFloat < 30) {
      i++;
      continue;
    }
    if (leftAnchor.midiFloat - out[i].midiFloat >= minDipSemitones) {
      let j = i;
      while (
        j + 1 < n - 1 &&
        out[j + 1].midiFloat >= 30 &&
        out[j + 1].timeSec - out[i].timeSec <= maxDipDurationSec &&
        leftAnchor.midiFloat - out[j + 1].midiFloat >= minDipSemitones * 0.65
      ) {
        j++;
      }
      const rightAnchor = out[j + 1];
      const dipSpanSec = out[j].timeSec - out[i].timeSec + 0.01;
      if (
        dipSpanSec <= maxDipDurationSec + 0.015 &&
        rightAnchor &&
        rightAnchor.midiFloat >= 30 &&
        rightAnchor.timeSec - out[j].timeSec <= 0.08 &&
        rightAnchor.midiFloat - out[i].midiFloat >= minDipSemitones * 0.75
      ) {
        const totalDt = Math.max(0.005, rightAnchor.timeSec - leftAnchor.timeSec);
        for (let k = i; k <= j; k++) {
          const alpha = (out[k].timeSec - leftAnchor.timeSec) / totalDt;
          out[k].midiFloat =
            Math.round((leftAnchor.midiFloat + alpha * (rightAnchor.midiFloat - leftAnchor.midiFloat)) * 100) / 100;
        }
        i = j + 1;
        continue;
      }
    }
    i++;
  }
  return out;
}

/**
 * 3. Auto-Calibration du Diapason A Cappella par moyenne circulaire pondérée :
 * delta_tuning = (1 / 2pi) * atan2(sum W_i sin(2pi p_i), sum W_i cos(2pi p_i)) dans [-0.40, +0.40].
 */
export function estimateVocalTuningOffsetSemitones(
  pitchCurve: PitchCurvePoint[],
  precomputedWeights?: number[]
): number {
  if (!pitchCurve || pitchCurve.length === 0) return 0;
  const weights = precomputedWeights ?? computeStationaryVowelWeights(pitchCurve);
  let sumSin = 0, sumCos = 0, totalW = 0;

  for (let i = 0; i < pitchCurve.length; i++) {
    const p = pitchCurve[i].midiFloat;
    const w = weights[i] ?? 0;
    if (w <= 1e-6 || !Number.isFinite(p) || p < 30 || p > 96) continue;
    const angle = 2 * Math.PI * p;
    sumSin += w * Math.sin(angle);
    sumCos += w * Math.cos(angle);
    totalW += w;
  }

  if (totalW <= 1e-5 || (Math.abs(sumSin) < 1e-7 && Math.abs(sumCos) < 1e-7)) return 0;
  const rawOffset = Math.atan2(sumSin, sumCos) / (2 * Math.PI);
  return Math.max(-0.40, Math.min(0.40, Math.round(rawOffset * 1000) / 1000));
}

