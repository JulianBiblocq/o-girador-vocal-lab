/**
 * subbeatAnchorHelper.ts
 * Calcul de la micro-grille sub-temps (s ∈ {0, 1, 2, 3}) depuis les _ et coupures intra-mots d'Organizador,
 * et détection du creux d'énergie RMS pour les points de coupe liés du Slicer (< 130 lignes).
 */
import type { TimeAnchor } from '../types/toadaDocument.types';
import { splitTextIntoLetraSyllables } from './syllableSplitter';

export function isIntraWordBadgeBoundary(rawText: string, badgeIndex: number, badgeFullLength: number): boolean {
  const before = rawText.slice(0, badgeIndex).replace(/\*/g, '');
  const after = rawText.slice(badgeIndex + badgeFullLength).replace(/\*/g, '');
  return /[\p{L}\p{M}]$/u.test(before) && /^[\p{L}\p{M}]/u.test(after);
}

export function computeBeatSyllableSubdivs(
  rawBeatChunk: string,
  syllables: string[],
  hasLeadingRest: boolean,
  hasTrailingPickup: boolean
): number[] {
  const k = syllables.length;
  if (k === 0) return [];
  const cleaned = (rawBeatChunk || '').replace(/\[[^\]]+\]/g, '').replace(/\*/g, '').trim();
  const rawTokens = cleaned.split(/\s+|(?=[_𝄽])|(?<=[_𝄽])/g).map((t) => t.trim()).filter(Boolean);
  const tokens: Array<'rest' | 'syl'> = [];
  for (const tk of rawTokens) {
    if (tk === '_' || tk === '𝄽') tokens.push('rest');
    else {
      const sList = splitTextIntoLetraSyllables(tk);
      for (let i = 0; i < Math.max(1, sList.length); i++) tokens.push('syl');
    }
  }
  const sylPositions: number[] = [];
  tokens.forEach((t, idx) => { if (t === 'syl') sylPositions.push(idx); });
  const hasRestBetween = (sIdxA: number, sIdxB: number) =>
    sylPositions[sIdxA] !== undefined && sylPositions[sIdxB] !== undefined && sylPositions[sIdxB] - sylPositions[sIdxA] > 1;
  const hasTrailingRest = tokens.length > 0 && tokens[tokens.length - 1] === 'rest';

  if (!hasLeadingRest) {
    if (k === 1) return [0];
    if (k === 2) {
      if (hasTrailingRest && !hasRestBetween(0, 1)) return [0, 1];
      if (hasTrailingPickup && hasRestBetween(0, 1)) return [0, 3];
      return [0, 2];
    }
    if (k === 3) {
      if (hasRestBetween(0, 1)) return [0, 2, 3];
      if (hasRestBetween(1, 2) || hasTrailingPickup) return [0, 1, 3];
      return [0, 1, 2];
    }
    return syllables.map((_, idx) => Math.min(3, idx));
  }

  // Cas B : hasLeadingRest === true (s = 0 est occupé par le soupir ou la liaison ───)
  if (k === 1) return [hasTrailingPickup ? 3 : 2];
  if (k === 2) {
    if (hasRestBetween(0, 1) || hasTrailingPickup) return [1, 3];
    return [1, 2];
  }
  return syllables.map((_, idx) => Math.min(3, 1 + idx));
}

export function computePatternVocalOffsetsBeats(
  timeAnchors: TimeAnchor[] | undefined,
  hasAnacrusis: boolean,
  beatsPerMeasure = 4,
  measuresCount = 2
): { firstVocalOffsetBeats: number; lastVocalEndOffsetBeats: number; hasBoundaryExitAnchor: boolean } {
  const defaultFirst = hasAnacrusis ? -2.0 : 0.0;
  const defaultLast = measuresCount * beatsPerMeasure;
  if (!timeAnchors || timeAnchors.length === 0) {
    return { firstVocalOffsetBeats: defaultFirst, lastVocalEndOffsetBeats: defaultLast, hasBoundaryExitAnchor: false };
  }
  const sungAnchors = timeAnchors.filter((a) => !a.isRest && !a.isInitialRest && !a.isSustainedHold && (a.syllables?.length ?? 0) > 0);
  if (sungAnchors.length === 0) {
    return { firstVocalOffsetBeats: defaultFirst, lastVocalEndOffsetBeats: defaultLast, hasBoundaryExitAnchor: false };
  }
  const first = sungAnchors[0];
  const s0 = first.syllableSubdivs?.[0] ?? (first.hasLeadingRest ? 1 : 0);
  const firstRelMeasure = hasAnacrusis ? first.measureOffset - 1 : first.measureOffset;
  const firstVocalOffsetBeats = firstRelMeasure * beatsPerMeasure + (first.beat - 1) + s0 / 4;

  const last = sungAnchors[sungAnchors.length - 1];
  const lastSubdivs = last.syllableSubdivs || [];
  const sLast = lastSubdivs.length > 0 ? lastSubdivs[lastSubdivs.length - 1] : 2;
  const lastRelMeasure = hasAnacrusis ? last.measureOffset - 1 : last.measureOffset;
  const lastStartBeat = lastRelMeasure * beatsPerMeasure + (last.beat - 1);
  const lastVocalEndOffsetBeats = lastStartBeat + Math.min(1, (sLast + 1.5) / 4);
  const hasBoundaryExitAnchor = last.beat === 1 && lastRelMeasure >= measuresCount - 1;

  return { firstVocalOffsetBeats, lastVocalEndOffsetBeats, hasBoundaryExitAnchor };
}

export function findTransitionRmsDipSec(
  boundaryT1Sec: number,
  beatDur: number,
  nextFirstVocalOffsetBeats: number,
  curHasBoundaryExit: boolean,
  pcm?: Float32Array | null,
  sampleRate = 44100
): number {
  const minBeat = nextFirstVocalOffsetBeats >= 0.75
    ? Math.max(0.32, curHasBoundaryExit ? 0.35 : 0.32)
    : 0.12;
  const maxBeat = nextFirstVocalOffsetBeats > minBeat + 0.06
    ? Math.min(1.15, nextFirstVocalOffsetBeats - 0.12)
    : Math.max(minBeat + 0.08, 0.35);

  const winStartSec = boundaryT1Sec + minBeat * beatDur;
  const winEndSec = boundaryT1Sec + maxBeat * beatDur;
  const defaultCutSec = winStartSec + 0.65 * (winEndSec - winStartSec);
  if (!pcm || pcm.length === 0 || sampleRate <= 0) return Math.round(defaultCutSec * 1000) / 1000;

  const rmsWinSamples = Math.max(32, Math.round(0.018 * sampleRate));
  const stepSamples = Math.max(16, Math.round(0.005 * sampleRate));
  const iStart = Math.max(0, Math.floor(winStartSec * sampleRate));
  const iEnd = Math.min(pcm.length - rmsWinSamples, Math.ceil(winEndSec * sampleRate));
  if (iEnd <= iStart) return Math.round(defaultCutSec * 1000) / 1000;

  let bestSample = Math.round(defaultCutSec * sampleRate), minRms = Infinity;
  for (let i = iStart; i <= iEnd; i += stepSamples) {
    let sumSq = 0;
    for (let k = 0; k < rmsWinSamples; k++) { const v = pcm[i + k]; sumSq += v * v; }
    const rms = Math.sqrt(sumSq / rmsWinSamples);
    if (rms < minRms) { minRms = rms; bestSample = i + (rmsWinSamples >> 1); }
  }
  return Math.round((bestSample / sampleRate) * 1000) / 1000;
}

