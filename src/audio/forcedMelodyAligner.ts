/**
 * forcedMelodyAligner.ts
 * Alignement forcé des notes de référence validées par le Mestre (referenceMidiNotes) sur une prise énergique :
 * Bijection 1:1 exacte (insensible aux sauts d'octave sur attaque criée) ou programmation dynamique monotone (DTW)
 * sur courbe masquée des sibilantes, + formatage Code Papier (C, F#, A3) / Solfège (< 135 lignes).
 */
import type { PitchCurvePoint, VocalStepData } from '../types/vocalPack.types';
import { NOTE_NAMES, midiToNoteName } from '../utils/noteUtils';
import { SOLFEGE_NOTE_NAMES, SOLFEGE_NOTE_NAMES_BR } from './projectScaleFormatter';
import { getStepTimeWindowSec, findLastTiedStepIndex } from '../utils/tripletBeatHelper';
import { maskSibilantsInPitchCurve } from './sibilantBreathMasker';

export function formatPaperNoteCode(midi: number): string {
  if (!Number.isFinite(midi) || midi <= 0) return '—';
  const rounded = Math.round(midi), pc = NOTE_NAMES[((rounded % 12) + 12) % 12], oct = Math.floor(rounded / 12) - 1;
  return oct === 4 ? pc : `${pc}${oct}`;
}

export function formatSolfegeNoteWithOctave(midi: number, lang: 'fr' | 'br' = 'fr'): string {
  if (!Number.isFinite(midi) || midi <= 0) return '—';
  const rounded = Math.round(midi), idx = ((rounded % 12) + 12) % 12, oct = Math.floor(rounded / 12) - 1;
  const names = lang === 'br' ? SOLFEGE_NOTE_NAMES_BR : SOLFEGE_NOTE_NAMES;
  return `${names[idx] || NOTE_NAMES[idx]}${oct}`;
}

function mod12Distance(a: number, b: number): number {
  const d = Math.abs(a - b) % 12;
  return Math.min(d, 12 - d);
}

function detectConsensusOctaveShift(brickMidis: Array<number | null>, refs: number[]): number {
  const diffs: number[] = [];
  const n = Math.min(brickMidis.length, refs.length);
  for (let i = 0; i < n; i++) {
    if (brickMidis[i] != null) diffs.push(brickMidis[i]! - refs[i]);
  }
  if (diffs.length < 3) return 0;
  for (const candShift of [-12, 12]) {
    const matching = diffs.filter((d) => Math.abs(d - candShift) <= 3.2).length;
    if (matching / diffs.length >= 0.72) return candShift;
  }
  return 0;
}

export function alignStepsWithReferenceMidiNotes(params: {
  steps: VocalStepData[];
  referenceMidiNotes?: number[] | null;
  pitchCurve?: PitchCurvePoint[];
  gridStartSec?: number;
  beatDurationSec?: number;
  pcm?: Float32Array | null;
  sampleRate?: number;
}): VocalStepData[] {
  const { steps, referenceMidiNotes, pitchCurve = [], gridStartSec = 0, beatDurationSec = 0.6, pcm, sampleRate = 48000 } = params;
  const validRefs = (referenceMidiNotes || []).filter((m) => Number.isFinite(m) && m >= 24 && m <= 108).map((m) => Math.round(m));
  if (!steps.length || validRefs.length === 0) return steps;

  const cleanCurve = maskSibilantsInPitchCurve(pitchCurve, pcm, sampleRate);
  const out = steps.map((s) => ({ ...s }));
  const rootIndices: number[] = [];
  for (let i = 0; i < out.length; i++) {
    if (out[i].tripletSlot === 'unused' || !out[i].active || out[i].isTie || out[i].note === '───') continue;
    rootIndices.push(i);
    i = findLastTiedStepIndex(out, i);
  }
  const K = rootIndices.length, M = validRefs.length;
  if (K === 0) return out;

  const brickMidis: Array<number | null> = rootIndices.map((rIdx) => {
    const { startSec, endSec } = getStepTimeWindowSec(out, rIdx, gridStartSec, beatDurationSec);
    const pts = cleanCurve.filter((p) => p.timeSec >= startSec && p.timeSec <= endSec && p.midiFloat >= 30 && p.midiFloat <= 96).map((p) => p.midiFloat).sort((a, b) => a - b);
    return pts.length > 0 ? pts[Math.floor(pts.length / 2)] : null;
  });

  const octShift = detectConsensusOctaveShift(brickMidis, validRefs);
  const refs = validRefs.map((r) => Math.max(24, Math.min(108, r + octShift)));

  let mappedRefIdx: number[];
  const isExactBijection = K === M;

  if (isExactBijection) {
    mappedRefIdx = refs.map((_, idx) => idx);
  } else {
    const dp = Array.from({ length: K }, () => new Array<number>(M).fill(1e9));
    const prevJ = Array.from({ length: K }, () => new Array<number>(M).fill(0));
    const localCost = (i: number, j: number) => {
      const bm = brickMidis[i];
      if (bm == null) return Math.abs(i / Math.max(1, K - 1) - j / Math.max(1, M - 1)) * 2.0;
      return mod12Distance(bm, refs[j]) * 0.8 + Math.min(3.0, Math.abs(bm - refs[j]) * 0.14);
    };
    dp[0][0] = localCost(0, 0);
    if (M > 1) dp[0][1] = localCost(0, 1) + 0.95;

    for (let i = 1; i < K; i++) {
      for (let j = 0; j < M; j++) {
        const c = localCost(i, j);
        const cands: Array<{ pj: number; pen: number }> = [{ pj: j, pen: 0.65 }];
        if (j >= 1) cands.push({ pj: j - 1, pen: 0 });
        if (j >= 2) cands.push({ pj: j - 2, pen: 1.15 });
        for (const cand of cands) {
          const score = dp[i - 1][cand.pj] + cand.pen + c;
          if (score < dp[i][j]) { dp[i][j] = score; prevJ[i][j] = cand.pj; }
        }
      }
    }
    let bestLastJ = M - 1;
    if (M >= 2 && dp[K - 1][M - 2] + 0.8 < dp[K - 1][M - 1]) bestLastJ = M - 2;
    mappedRefIdx = new Array<number>(K);
    let curJ = bestLastJ;
    for (let i = K - 1; i >= 0; i--) { mappedRefIdx[i] = curJ; curJ = prevJ[i][curJ]; }
  }

  for (let b = 0; b < K; b++) {
    const rIdx = rootIndices[b], endIdx = findLastTiedStepIndex(out, rIdx), targetMidi = refs[mappedRefIdx[b]];
    const bm = brickMidis[b], frankMismatch = !isExactBijection && bm != null && mod12Distance(bm, targetMidi) > 2.2;
    const altMidi = frankMismatch && bm != null ? Math.round(bm) : undefined;
    out[rIdx] = {
      ...out[rIdx], midiNumber: targetMidi, note: midiToNoteName(targetMidi), manualPitchMoved: false,
      isUncertain: frankMismatch, pitchConfidence: frankMismatch ? 0.45 : 0.98,
      alternativeNote: altMidi ? midiToNoteName(altMidi) : undefined,
      doubtReason: frankMismatch ? 'between_notes' : undefined,
    };
    for (let t = rIdx + 1; t <= endIdx; t++) {
      if (out[t].tripletSlot === 'unused') continue;
      out[t] = { ...out[t], midiNumber: targetMidi, isUncertain: false, alternativeNote: undefined, doubtReason: undefined };
    }
  }
  return out;
}
