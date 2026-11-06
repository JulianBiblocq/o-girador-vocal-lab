/**
 * slicerBoundaryOptimizer.ts
 * Optimisation mathématique des frontières du Slicer (Livret 3) :
 * Fenêtre valide issue des timeAnchors, minimisation de la fonction de coût acoustique C(t),
 * aimantation sur passage à zéro (Zero-Crossing) et auto-calage du gridOffsetSec maître (< 130 lignes).
 */
import type { VocalPatternItem, VocalRole } from '../types/toadaProject.types';
import { resolveFreshTimeAnchors } from './timeAnchorParser';
import { computePatternVocalOffsetsBeats } from './subbeatAnchorHelper';

export function snapToNearestZeroCrossing(
  pcm: Float32Array, sampleRate: number, targetSec: number, radiusMaxMsOrSec = 5
): number {
  if (!pcm || pcm.length === 0 || sampleRate <= 0) return targetSec;
  const radiusSec = radiusMaxMsOrSec > 0.2 ? radiusMaxMsOrSec / 1000 : radiusMaxMsOrSec;
  const centerIdx = Math.max(0, Math.min(pcm.length - 1, Math.round(targetSec * sampleRate)));
  const rad = Math.max(2, Math.round(radiusSec * sampleRate));
  const i0 = Math.max(0, centerIdx - rad), i1 = Math.min(pcm.length - 2, centerIdx + rad);
  let bestZcIdx = -1, bestZcCost = Infinity, minAmpIdx = centerIdx, minAmp = Math.abs(pcm[centerIdx]);

  for (let i = i0; i <= i1; i++) {
    const a = pcm[i], b = pcm[i + 1], absA = Math.abs(a), absB = Math.abs(b);
    if (absA < minAmp) { minAmp = absA; minAmpIdx = i; }
    if (a * b <= 0) {
      const cost = absA + absB + 0.015 * (Math.abs(i - centerIdx) / rad);
      if (cost < bestZcCost) { bestZcCost = cost; bestZcIdx = absA <= absB ? i : i + 1; }
    }
  }
  return (bestZcIdx >= 0 ? bestZcIdx : minAmpIdx) / sampleRate;
}

export function computeValidCutWindowSec(
  boundaryT1Sec: number, beatDur: number, nextFirstVocalOffsetBeats: number, curHasBoundaryExit: boolean
): { minSec: number; maxSec: number; idealSec: number } {
  if (nextFirstVocalOffsetBeats < -0.05) {
    const maxSec = Math.max(0.05, boundaryT1Sec + nextFirstVocalOffsetBeats * beatDur - 0.020);
    const minSec = Math.max(0.02, Math.min(maxSec - 0.06, boundaryT1Sec + (nextFirstVocalOffsetBeats - 1.1) * beatDur));
    return { minSec, maxSec, idealSec: minSec + 0.65 * (maxSec - minSec) };
  }
  const minBeat = nextFirstVocalOffsetBeats >= 0.75 ? (curHasBoundaryExit ? 0.35 : 0.32) : Math.max(0.10, Math.min(0.26, nextFirstVocalOffsetBeats * 0.45));
  const maxBeat = nextFirstVocalOffsetBeats > minBeat + 0.06 ? Math.min(1.20, nextFirstVocalOffsetBeats - Math.max(0.03, 0.020 / Math.max(0.2, beatDur))) : Math.max(minBeat + 0.10, 0.36);
  const minSec = boundaryT1Sec + minBeat * beatDur, maxSec = Math.max(minSec + 0.025, boundaryT1Sec + maxBeat * beatDur);
  return { minSec, maxSec, idealSec: minSec + 0.62 * (maxSec - minSec) };
}

function measureEnergiesAt(pcm: Float32Array, sampleRate: number, centerSec: number, winSec = 0.035): { voicedE: number; totalE: number } {
  const half = winSec * 0.5, i0 = Math.max(0, Math.floor((centerSec - half) * sampleRate)), i1 = Math.min(pcm.length, Math.ceil((centerSec + half) * sampleRate));
  if (i1 <= i0 + 1) return { voicedE: 0, totalE: 0 };
  const useBand = sampleRate >= 6000;
  const hpA = useBand ? Math.exp((-2 * Math.PI * 200) / sampleRate) : 0, lpA = useBand ? Math.exp((-2 * Math.PI * 3400) / sampleRate) : 0;
  let hp = 0, xPrev = pcm[i0], lp = 0, sumTot = 0, sumVoiced = 0;
  for (let i = i0; i < i1; i++) {
    const x = pcm[i]; sumTot += x * x;
    if (useBand) { hp = hpA * (hp + x - xPrev); xPrev = x; lp = lpA * lp + (1 - lpA) * hp; sumVoiced += lp * lp; }
    else sumVoiced += x * x;
  }
  const n = i1 - i0;
  return { voicedE: Math.sqrt(sumVoiced / n), totalE: Math.sqrt(sumTot / n) };
}

export interface AcousticCutParams {
  boundaryT1Sec: number; beatDur: number; nextFirstVocalOffsetBeats: number; curHasBoundaryExit: boolean;
  pcm?: Float32Array | null; sampleRate?: number; minSecOverride?: number; maxSecOverride?: number;
}

export function findOptimalAcousticCutSec(
  paramsOrPcm: AcousticCutParams | Float32Array,
  sampleRateArg = 44100,
  idealCutSecArg = 0,
  minCutSecArg = 0,
  maxCutSecArg = 0
): number {
  let pcm: Float32Array | null | undefined;
  let sampleRate = sampleRateArg, minSec = minCutSecArg, maxSec = maxCutSecArg, idealSec = idealCutSecArg;

  if (paramsOrPcm instanceof Float32Array) {
    pcm = paramsOrPcm;
    maxSec = Math.max(minSec + 0.02, maxSec);
  } else {
    const p = paramsOrPcm;
    pcm = p.pcm; sampleRate = p.sampleRate ?? 44100;
    const baseWin = computeValidCutWindowSec(p.boundaryT1Sec, p.beatDur, p.nextFirstVocalOffsetBeats, p.curHasBoundaryExit);
    minSec = p.minSecOverride ?? baseWin.minSec;
    maxSec = Math.max(minSec + 0.02, p.maxSecOverride ?? baseWin.maxSec);
    idealSec = minSec + 0.62 * (maxSec - minSec);
  }
  if (!pcm || pcm.length === 0 || sampleRate <= 0) return Math.round(idealSec * 1000) / 1000;

  const stepSec = 0.005, span = Math.max(0.02, maxSec - minSec);
  const grid: Array<{ t: number; vE: number; tE: number; grad: number }> = [];
  let maxVE = 1e-6, maxTE = 1e-6, maxGrad = 1e-6;

  for (let t = minSec; t <= maxSec + 1e-6; t += stepSec) {
    const cur = measureEnergiesAt(pcm, sampleRate, t, 0.035), ahead = measureEnergiesAt(pcm, sampleRate, t + 0.025, 0.035);
    const grad = Math.max(0, ahead.totalE - cur.totalE);
    if (cur.voicedE > maxVE) maxVE = cur.voicedE;
    if (cur.totalE > maxTE) maxTE = cur.totalE;
    if (grad > maxGrad) maxGrad = grad;
    grid.push({ t, vE: cur.voicedE, tE: cur.totalE, grad });
  }

  let bestT = idealSec, minCost = Infinity;
  for (const pt of grid) {
    const prior = ((pt.t - idealSec) / span) ** 2;
    const cost = 0.55 * (pt.vE / maxVE) + 0.30 * (pt.tE / maxTE) - 0.15 * (pt.grad / maxGrad) + 0.10 * prior;
    if (cost < minCost) { minCost = cost; bestT = pt.t; }
  }
  return snapToNearestZeroCrossing(pcm, sampleRate, bestT, 5);
}

export function findOptimalMasterGridOffsetSec(
  pcm: Float32Array | null | undefined, sampleRate: number, bpm: number,
  patterns: VocalPatternItem[], defaultRole: VocalRole, initialOffsetSec = 0.8
): number {
  if (!pcm || pcm.length === 0 || sampleRate <= 0 || patterns.length === 0) return initialOffsetSec;
  const beatDur = 60 / (bpm || 88), measureDur = beatDur * 4;
  const rolePats = patterns.filter((p) => p.role === (defaultRole === 'coro' ? 'coro' : 'puxador')), firstPat = rolePats[0] || patterns[0];
  const hasAna = firstPat.hasAnacrusis !== false, anchors = resolveFreshTimeAnchors(firstPat.rawLineCode, firstPat.timeAnchors, 4, !hasAna, firstPat.assignedLyricsText);
  const { firstVocalOffsetBeats } = computePatternVocalOffsetsBeats(anchors, hasAna, 4, firstPat.measuresCount ?? 1);
  let bestOff = initialOffsetSec, bestScore = -Infinity;
  for (let d = -0.35; d <= 0.35; d += 0.015) {
    const candT1 = Math.max(0.2, initialOffsetSec + d), firstAt = Math.max(0, candT1 + firstVocalOffsetBeats * beatDur);
    const eAt = measureEnergiesAt(pcm, sampleRate, firstAt + 0.06, 0.08).totalE, ePre = measureEnergiesAt(pcm, sampleRate, Math.max(0, firstAt - 0.08), 0.08).totalE;
    const eDown = measureEnergiesAt(pcm, sampleRate, candT1 + 0.06, 0.10).totalE;
    const score = (Math.max(0, eAt - 0.6 * ePre) + 0.8 * eDown) * (1 - 0.08 * ((d / (measureDur * 0.25)) ** 2));
    if (score > bestScore) { bestScore = score; bestOff = candT1; }
  }
  return Math.round(bestOff * 1000) / 1000;
}
