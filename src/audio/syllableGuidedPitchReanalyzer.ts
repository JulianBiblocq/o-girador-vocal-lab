/**
 * syllableGuidedPitchReanalyzer.ts
 * Re-analyse mélodique haute-précision sur syllabes et rythme déjà calés (< 135 lignes).
 * Préserve à 100 % `active`, `isTie` et `syllable`, décode les hauteurs par Cœur de Voyelle + Auto-Diapason + Viterbi
 * et marque les briques incertaines avec `isUncertain = true` + `alternativeNote`.
 */
import type { VocalStepData, PitchCurvePoint, DoubtReason } from '../types/vocalPack.types';
import { midiToNoteName } from '../utils/noteUtils';
import { getStepTimeWindowSec, findLastTiedStepIndex } from '../utils/tripletBeatHelper';
import { getEffectiveVocalBounds, type EffectiveVocalBounds } from '../utils/ambitusStorage';
import { buildAllowedPitchClasses, type ScaleType } from './scaleQuantizer';
import {
  computeStationaryVowelWeights,
  cleanConsonantDipsInPitchCurve,
  estimateVocalTuningOffsetSemitones,
} from './vowelCorePitchEstimator';

export interface ReanalyzeSyllablesOptions {
  steps: VocalStepData[];
  pitchCurve: PitchCurvePoint[];
  gridStartSec?: number;
  stepDurationSec?: number;
  beatDurationSec?: number;
  tonic?: string;
  scaleType?: ScaleType;
  allowedPitchClasses?: Set<number> | number[] | null;
  vocalBounds?: Partial<EffectiveVocalBounds>;
}

export function reanalyzeNotesOnAlignedSyllables(options: ReanalyzeSyllablesOptions): VocalStepData[] {
  const { steps, pitchCurve, gridStartSec = 0, stepDurationSec, beatDurationSec, tonic = 'C', scaleType = 'chromatic', allowedPitchClasses, vocalBounds } = options;
  const effBeatDur = beatDurationSec ?? ((stepDurationSec ?? 0.15) * 4);
  if (!steps || steps.length === 0 || effBeatDur <= 0) return steps;

  const cleanCurve = cleanConsonantDipsInPitchCurve(pitchCurve || []);
  const weights = computeStationaryVowelWeights(cleanCurve);
  const tuningOffset = estimateVocalTuningOffsetSemitones(cleanCurve, weights);
  const baseBounds = getEffectiveVocalBounds();
  const minMidi = Math.round(vocalBounds?.minMidi ?? baseBounds.minMidi), maxMidi = Math.round(vocalBounds?.maxMidi ?? baseBounds.maxMidi);

  const scaleSet: Set<number> | null = allowedPitchClasses instanceof Set
    ? allowedPitchClasses
    : Array.isArray(allowedPitchClasses) && allowedPitchClasses.length > 0 && allowedPitchClasses.length < 12
      ? new Set(allowedPitchClasses)
      : scaleType !== 'chromatic' ? buildAllowedPitchClasses(tonic, scaleType, null) : null;

  const out = steps.map((s) => ({ ...s }));
  let prevChosenMidi: number | null = null;

  for (let i = 0; i < out.length; i++) {
    if (out[i].tripletSlot === 'unused' || !out[i].active || out[i].isTie || out[i].note === '───') continue;
    const endIdx = findLastTiedStepIndex(out, i);
    const { startSec, endSec, durationSec } = getStepTimeWindowSec(out, i, gridStartSec, effBeatDur);
    const dur = Math.max(0.01, durationSec), attTrim = dur >= 0.11 ? 0.04 : dur * 0.225, relTrim = dur >= 0.11 ? 0.02 : dur * 0.225;

    let indices: number[] = [];
    for (let idx = 0; idx < cleanCurve.length; idx++) {
      const pt = cleanCurve[idx];
      if (pt.timeSec >= startSec + attTrim && pt.timeSec <= endSec - relTrim && pt.midiFloat >= 30 && pt.midiFloat <= 96) indices.push(idx);
    }
    if (indices.length < 2) {
      indices = [];
      for (let idx = 0; idx < cleanCurve.length; idx++) {
        const pt = cleanCurve[idx];
        if (pt.timeSec >= startSec - 0.015 && pt.timeSec <= endSec + 0.015 && pt.midiFloat >= 30 && pt.midiFloat <= 96) indices.push(idx);
      }
    }

    if (indices.length === 0) {
      const fb: number = out[i].midiNumber || prevChosenMidi || baseBounds.comfortMidi || 55, alt = fb + 2 <= maxMidi ? fb + 2 : fb - 2;
      out[i] = { ...out[i], midiNumber: fb, note: midiToNoteName(fb), isUncertain: true, pitchConfidence: 0.2, alternativeNote: midiToNoteName(alt), doubtReason: 'short_or_noisy' };
      for (let k = i + 1; k <= endIdx; k++) out[k] = { ...out[k], midiNumber: fb, isUncertain: false };
      prevChosenMidi = fb; i = endIdx; continue;
    }

    let sumW = 0, sumWMidi = 0, sumConf = 0;
    for (const idx of indices) {
      const w = Math.max(1e-5, weights[idx] ?? 0.01), deTuned = cleanCurve[idx].midiFloat - tuningOffset;
      sumW += w; sumWMidi += w * deTuned; sumConf += cleanCurve[idx].confidence ?? 0.85;
    }
    const meanDeTuned = sumWMidi / sumW, avgConf = sumConf / indices.length;
    let sumVar = 0;
    for (const idx of indices) {
      const w = Math.max(1e-5, weights[idx] ?? 0.01), d = (cleanCurve[idx].midiFloat - tuningOffset) - meanDeTuned;
      sumVar += w * d * d;
    }
    const stdSt = Math.sqrt(sumVar / sumW), sigma = 0.32;
    const candScores: Array<{ midi: number; prob: number }> = [];
    for (let m = minMidi; m <= maxMidi; m++) {
      let density = 0;
      for (const idx of indices) {
        const w = Math.max(1e-5, weights[idx] ?? 0.01), d = (cleanCurve[idx].midiFloat - tuningOffset) - m;
        density += w * Math.exp(-(d * d) / (2 * sigma * sigma));
      }
      const inScale = !scaleSet || scaleSet.has(((m % 12) + 12) % 12);
      const jump = prevChosenMidi !== null ? Math.abs(m - prevChosenMidi) : 0;
      candScores.push({ midi: m, prob: density * (inScale ? 1.25 : 0.72) * (jump >= 10 ? 0.28 : jump >= 7 ? 0.78 : 1.0) });
    }
    candScores.sort((a, b) => b.prob - a.prob);
    const best1 = candScores[0] ?? { midi: Math.round(meanDeTuned), prob: 1 };
    const best2 = candScores[1] ?? { midi: best1.midi + (meanDeTuned >= best1.midi ? 1 : -1), prob: 0.1 };
    const pureAcousticMidi = Math.round(meanDeTuned);
    const acousticOutScale = Boolean(scaleSet && !scaleSet.has(((pureAcousticMidi % 12) + 12) % 12) && Math.abs(meanDeTuned - pureAcousticMidi) <= 0.28);

    const probRatio = best1.prob / Math.max(1e-9, best1.prob + best2.prob), distFromNote = Math.abs(meanDeTuned - best1.midi);
    let isUncertain = false, doubtReason: DoubtReason | undefined, altMidi = best2.midi;
    if (indices.length < 2 || avgConf < 0.62) { isUncertain = true; doubtReason = 'short_or_noisy'; }
    else if (acousticOutScale && pureAcousticMidi !== best1.midi) { isUncertain = true; doubtReason = 'out_of_scale'; altMidi = pureAcousticMidi; }
    else if (distFromNote > 0.34 || probRatio < 0.68 || stdSt > 0.55) { isUncertain = true; doubtReason = 'between_notes'; }

    const chosenMidi = best1.midi, origVoice = Math.round((meanDeTuned + tuningOffset) * 100) / 100;
    out[i] = {
      ...out[i], midiNumber: chosenMidi, note: midiToNoteName(chosenMidi), originalVoiceMidi: origVoice, manualPitchMoved: false,
      isUncertain, pitchConfidence: Math.round(Math.min(1, Math.max(0.05, probRatio * avgConf)) * 100) / 100,
      alternativeNote: isUncertain ? midiToNoteName(altMidi) : undefined, doubtReason: isUncertain ? doubtReason : undefined,
    };
    for (let k = i + 1; k <= endIdx; k++) {
      if (out[k].tripletSlot === 'unused') continue;
      out[k] = { ...out[k], midiNumber: chosenMidi, originalVoiceMidi: origVoice, manualPitchMoved: false, isUncertain: false, alternativeNote: undefined, doubtReason: undefined };
    }
    prevChosenMidi = chosenMidi;
    i = endIdx;
  }
  return out;
}
