/**
 * RhythmTapCaptureEngine.ts
 * Moteur de quantification rythmique Maracatu (Barre Espace / Clavier Maître MIDI)
 * avec Auto-Compensation de latence sur les attaques vocales et gestion des tenues (───) (< 125 lignes).
 */
import type { PitchCurvePoint, VocalStepData } from '../types/vocalPack.types';
import type { TimeAnchor } from '../types/toadaDocument.types';
import type { RhythmTapEvent } from '../hooks/useWebMidiInput';
import { computeTrimmedMedianMidi } from './pitchStepSegmentation';
import { snapMidiToScale } from './scaleQuantizer';
import { assignSyllablesStrictlyToExistingBricks } from '../utils/syllableAligner';
import { midiToNoteName } from '../utils/noteUtils';

export function detectVocalOnsetTimesSec(pcm: Float32Array, sampleRate: number): number[] {
  if (!pcm || pcm.length === 0 || sampleRate <= 0) return [];
  const win = Math.max(8, Math.floor(0.015 * sampleRate)), hop = Math.max(4, Math.floor(0.006 * sampleRate));
  const numFrames = Math.floor((pcm.length - win) / hop);
  if (numFrames < 3) return [];
  const rms = new Float32Array(numFrames);
  let maxRms = 0;
  for (let i = 0; i < numFrames; i++) {
    let sum = 0; const base = i * hop;
    for (let k = 0; k < win; k++) { const v = pcm[base + k]; sum += v * v; }
    rms[i] = Math.sqrt(sum / win);
    if (rms[i] > maxRms) maxRms = rms[i];
  }
  const thresh = Math.max(0.012, maxRms * 0.12), onsets: number[] = [];
  let lastOnsetSec = -1;
  for (let i = 2; i < numFrames - 1; i++) {
    const prev = (rms[i - 2] + rms[i - 1]) * 0.5, cur = (rms[i] + rms[i + 1]) * 0.5;
    const sec = (i * hop + win * 0.5) / sampleRate;
    if (cur >= thresh && cur > prev * 1.38 && sec - lastOnsetSec >= 0.085) { onsets.push(sec); lastOnsetSec = sec; }
  }
  return onsets;
}

export function estimateTapLatencySec(taps: RhythmTapEvent[], pcm?: Float32Array, sampleRate = 44100): number {
  if (!taps.length || !pcm || !pcm.length) return 0.055;
  const vocalOnsets = detectVocalOnsetTimesSec(pcm, sampleRate);
  if (!vocalOnsets.length) return 0.055;
  const diffs: number[] = [];
  for (const tap of taps) {
    let bestDiff = Infinity;
    for (const vSec of vocalOnsets) {
      const d = tap.onsetSec - vSec;
      if (Math.abs(d) <= 0.18 && Math.abs(d) < Math.abs(bestDiff)) bestDiff = d;
    }
    if (Number.isFinite(bestDiff)) diffs.push(bestDiff);
  }
  if (!diffs.length) return 0.055;
  diffs.sort((a, b) => a - b);
  return Math.max(-0.04, Math.min(0.16, diffs[Math.floor(diffs.length / 2)]));
}

export interface ConvertTapsToStepsParams {
  taps: RhythmTapEvent[]; existingSteps: VocalStepData[]; pitchCurve: PitchCurvePoint[];
  pcm?: Float32Array; sampleRate?: number; gridStartSec: number; stepDurationSec: number;
  stepsPerBeat?: number; useMidiPitches?: boolean; allowedPitchClasses?: Set<number> | null;
  lyricsText?: string; timeAnchors?: TimeAnchor[];
}

export function convertTapsToSteps(params: ConvertTapsToStepsParams): { steps: VocalStepData[]; latencyMs: number } {
  const { taps, existingSteps, pitchCurve, pcm, sampleRate = 44100, gridStartSec, stepDurationSec, useMidiPitches = false, allowedPitchClasses, lyricsText } = params;
  if (!taps.length || !existingSteps.length || stepDurationSec <= 0) return { steps: existingSteps, latencyMs: 0 };
  const latencySec = estimateTapLatencySec(taps, pcm, sampleRate), totalSteps = existingSteps.length;
  const result: VocalStepData[] = existingSteps.map((s, idx) => ({
    ...s, stepIndex: idx, active: false, note: '', midiNumber: 0, isTie: false, syllable: '', syllableAttack: false, velocity: 0,
  }));

  const sortedTaps = [...taps].sort((a, b) => a.onsetSec - b.onsetSec);
  let lastFallbackMidi = existingSteps.find((s) => s.active && s.midiNumber > 0)?.midiNumber || 60;

  for (let tIdx = 0; tIdx < sortedTaps.length; tIdx++) {
    const tap = sortedTaps[tIdx], corrOnset = Math.max(gridStartSec, tap.onsetSec - latencySec);
    const corrRelease = Math.max(corrOnset + stepDurationSec * 0.5, tap.releaseSec - latencySec);
    let startStep = Math.max(0, Math.min(totalSteps - 1, Math.round((corrOnset - gridStartSec) / stepDurationSec)));
    const endStep = Math.max(startStep, Math.min(totalSteps - 1, Math.floor((corrRelease - gridStartSec) / stepDurationSec)));

    let targetMidi = lastFallbackMidi;
    if (useMidiPitches && tap.midiNote && tap.midiNote >= 24 && tap.midiNote <= 108) targetMidi = tap.midiNote;
    else {
      const s0 = gridStartSec + startStep * stepDurationSec, s1 = gridStartSec + Math.max(startStep + 1, endStep + 1) * stepDurationSec;
      const local = computeTrimmedMedianMidi(pitchCurve, s0, s1, 0.15) ?? computeTrimmedMedianMidi(pitchCurve, s0 - 0.04, s1 + 0.04, 0.15);
      const rawMidiFloat = local ? local.midiFloat : lastFallbackMidi;
      targetMidi = allowedPitchClasses && allowedPitchClasses.size > 0 ? snapMidiToScale(rawMidiFloat, allowedPitchClasses) : Math.round(rawMidiFloat);
    }
    lastFallbackMidi = targetMidi;

    if (result[startStep].active && result[startStep].note !== '───' && startStep + 1 < totalSteps) startStep++;
    result[startStep] = { ...result[startStep], active: true, midiNumber: targetMidi, note: midiToNoteName(targetMidi), isTie: false, syllableAttack: true, velocity: 100, decay: stepDurationSec };
    const nextTapStep = tIdx + 1 < sortedTaps.length ? Math.max(0, Math.round((Math.max(gridStartSec, sortedTaps[tIdx + 1].onsetSec - latencySec) - gridStartSec) / stepDurationSec)) : totalSteps;
    const clampedEnd = Math.min(endStep, nextTapStep - 1);
    for (let s = startStep + 1; s <= clampedEnd && s < totalSteps; s++) {
      result[s] = { ...result[s], active: true, midiNumber: targetMidi, note: '───', isTie: true, syllableAttack: false, velocity: 90, decay: stepDurationSec };
    }
  }

  const fallbackLyrics = lyricsText || existingSteps.filter((s) => s.active && s.note !== '───' && s.syllable).map((s) => s.syllable).join('');
  const withLyrics = fallbackLyrics ? assignSyllablesStrictlyToExistingBricks(result, fallbackLyrics) : result;
  return { steps: withLyrics, latencyMs: Math.round(latencySec * 1000) };
}

export function shiftAllStepsBySubdivision(steps: VocalStepData[], deltaSteps: -1 | 1): VocalStepData[] {
  const n = steps.length;
  if (n === 0) return steps;
  const empty = (idx: number): VocalStepData => ({ stepIndex: idx, active: false, note: '', midiNumber: 0, isTie: false, syllable: '', syllableAttack: false, velocity: 0, decay: steps[0]?.decay || 0.15 });
  return steps.map((_, idx) => { const srcIdx = idx - deltaSteps; return srcIdx >= 0 && srcIdx < n ? { ...steps[srcIdx], stepIndex: idx } : empty(idx); });
}

export function realignStepsToVocalOnsets(steps: VocalStepData[], pcm: Float32Array, sampleRate: number, gridStartSec: number, stepDurationSec: number): VocalStepData[] {
  const onsets = detectVocalOnsetTimesSec(pcm, sampleRate);
  const attackSteps = steps.map((s, idx) => (s.active && s.note !== '───' && !s.isTie ? idx : -1)).filter((idx) => idx !== -1);
  if (!onsets.length || !attackSteps.length || stepDurationSec <= 0) return steps;
  const stepDiffs: number[] = [];
  for (const idx of attackSteps) {
    const stepSec = gridStartSec + idx * stepDurationSec;
    let bestD = Infinity;
    for (const oSec of onsets) { const d = oSec - stepSec; if (Math.abs(d) <= stepDurationSec * 2.2 && Math.abs(d) < Math.abs(bestD)) bestD = d; }
    if (Number.isFinite(bestD)) stepDiffs.push(Math.round(bestD / stepDurationSec));
  }
  if (!stepDiffs.length) return steps;
  stepDiffs.sort((a, b) => a - b);
  const medShift = stepDiffs[Math.floor(stepDiffs.length / 2)];
  return medShift === 0 ? steps : shiftAllStepsBySubdivision(steps, medShift > 0 ? 1 : -1);
}
