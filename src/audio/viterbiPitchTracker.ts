/**
 * viterbiPitchTracker.ts
 * Décodeur de Viterbi multi-candidats avec ancrage sur l'Ambitus (comfortMidi + médiane robuste)
 * pour empêcher les sauts d'octave parasites (< 125 lignes).
 */
import type { PitchCurvePoint } from '../types/vocalPack.types';
import type { TessituraRange } from '../types/tessitura.types';
import { isPitchInTessitura } from '../types/tessitura.types';

export interface PitchCandidate {
  midiFloat: number;
  aperiodicity: number;
  confidence: number;
  folded?: boolean;
}

export interface CandidateFrame {
  timeSec: number;
  rms: number;
  zcr: number;
  isVoiced: boolean;
  candidates: PitchCandidate[];
}

export interface ViterbiOptions {
  octaveJumpPenalty?: number;
  fifthJumpPenalty?: number;
  maxJumpPenalty?: number;
  minMidi?: number;
  maxMidi?: number;
  comfortMidi?: number;
}

function calcTransitionCost(pPrev: number, pCurr: number, opts: ViterbiOptions): number {
  const diff = Math.abs(pCurr - pPrev);
  if (diff <= 0.6) return diff * diff * 0.15;
  if (diff <= 3.5) return 0.25 * diff;
  if (diff >= 10.5 && diff <= 13.5) return (opts.octaveJumpPenalty ?? 9.5) + Math.abs(diff - 12) * 0.35;
  if (diff >= 6.3 && diff <= 7.7) return (opts.fifthJumpPenalty ?? 4.2) + Math.abs(diff - 7) * 0.3;
  return Math.min(opts.maxJumpPenalty ?? 15.0, 1.3 * diff);
}

function calcEmissionCost(
  cand: PitchCandidate,
  tessitura: TessituraRange | undefined,
  opts: ViterbiOptions,
  blockAnchorMidi: number | null
): number {
  const conf = Math.max(0.01, Math.min(0.99, cand.confidence));
  let cost = -Math.log(conf) + (cand.folded ? 0.35 : 0);

  const minM = opts.minMidi ?? tessitura?.minPitchMidi;
  const maxM = opts.maxMidi ?? tessitura?.maxPitchMidi;
  if (typeof minM === 'number' && typeof maxM === 'number') {
    if (cand.midiFloat < minM) cost += Math.min(16.0, 2.8 * (minM - cand.midiFloat));
    else if (cand.midiFloat > maxM) cost += Math.min(18.0, 3.2 * (cand.midiFloat - maxM));
  } else if (tessitura && !isPitchInTessitura(cand.midiFloat, tessitura)) {
    const dist = cand.midiFloat < tessitura.minPitchMidi ? tessitura.minPitchMidi - cand.midiFloat : cand.midiFloat - tessitura.maxPitchMidi;
    cost += Math.min(14.0, 2.5 * dist);
  }

  const centerRef = opts.comfortMidi ?? blockAnchorMidi;
  if (typeof centerRef === 'number') {
    const dev = Math.abs(cand.midiFloat - centerRef);
    if (dev > 7) cost += (dev - 7) * 0.42;
    if (dev >= 10.5) cost += 3.2;
  }
  return cost;
}

function estimateBlockMedianMidi(block: CandidateFrame[], opts: ViterbiOptions): number | null {
  const vals: number[] = [];
  const minM = opts.minMidi ?? 36, maxM = opts.maxMidi ?? 84;
  for (const f of block) {
    const inRange = f.candidates.find((c) => c.midiFloat >= minM && c.midiFloat <= maxM) ?? f.candidates[0];
    if (inRange && Number.isFinite(inRange.midiFloat)) vals.push(inRange.midiFloat);
  }
  if (vals.length === 0) return opts.comfortMidi ?? null;
  vals.sort((a, b) => a - b);
  return vals[Math.floor(vals.length / 2)];
}

function decodeVoicedBlock(block: CandidateFrame[], tessitura?: TessituraRange, options: ViterbiOptions = {}): PitchCurvePoint[] {
  if (block.length < 3) return [];
  const T = block.length;
  const blockAnchor = estimateBlockMedianMidi(block, options);
  const dp: number[][] = [block[0].candidates.map((c) => calcEmissionCost(c, tessitura, options, blockAnchor))];
  const backptr: number[][] = [block[0].candidates.map(() => 0)];

  for (let t = 1; t < T; t++) {
    dp[t] = []; backptr[t] = [];
    const prevCands = block[t - 1].candidates, currCands = block[t].candidates;
    for (let k = 0; k < currCands.length; k++) {
      const emit = calcEmissionCost(currCands[k], tessitura, options, blockAnchor);
      let minScore = Infinity, bestPrev = 0;
      for (let j = 0; j < prevCands.length; j++) {
        const score = dp[t - 1][j] + calcTransitionCost(prevCands[j].midiFloat, currCands[k].midiFloat, options) + emit;
        if (score < minScore) { minScore = score; bestPrev = j; }
      }
      dp[t][k] = minScore; backptr[t][k] = bestPrev;
    }
  }

  let bestLast = 0, minFinal = Infinity;
  for (let k = 0; k < dp[T - 1].length; k++) {
    if (dp[T - 1][k] < minFinal) { minFinal = dp[T - 1][k]; bestLast = k; }
  }

  const optimal = new Array<number>(T);
  let cur = bestLast;
  for (let t = T - 1; t >= 0; t--) { optimal[t] = cur; cur = backptr[t][cur]; }

  const pts: PitchCurvePoint[] = [];
  for (let t = 0; t < T; t++) {
    const cand = block[t].candidates[optimal[t]];
    if (cand && cand.confidence >= 0.12 && Number.isFinite(cand.midiFloat) && Number.isFinite(block[t].timeSec)) {
      pts.push({
        timeSec: Math.round(block[t].timeSec * 1000) / 1000,
        midiFloat: Math.round(cand.midiFloat * 100) / 100,
        confidence: Math.round(cand.confidence * 1000) / 1000,
        rms: Math.round(block[t].rms * 10000) / 10000,
      });
    }
  }
  return pts;
}

export function trackViterbiPitch(frames: CandidateFrame[], tessitura?: TessituraRange, options: ViterbiOptions = {}): PitchCurvePoint[] {
  if (frames.length === 0) return [];
  const voicedBlocks: CandidateFrame[][] = [];
  let currentBlock: CandidateFrame[] = [];
  for (const f of frames) {
    if (f.isVoiced && f.candidates.length > 0) currentBlock.push(f);
    else if (currentBlock.length > 0) { voicedBlocks.push(currentBlock); currentBlock = []; }
  }
  if (currentBlock.length > 0) voicedBlocks.push(currentBlock);
  const resultPoints: PitchCurvePoint[] = [];
  for (const block of voicedBlocks) resultPoints.push(...decodeVoicedBlock(block, tessitura, options));
  return resultPoints;
}
