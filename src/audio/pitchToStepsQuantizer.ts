/**
 * pitchToStepsQuantizer.ts
 * Quantification MIDI sur la grille des temps basée sur les segments de pitch.
 * Attaques obligatoires sur temps ancrés, scission intra-temps et gestion des silences (< 145 lignes).
 */
import type { PitchCurvePoint, VocalStepData } from '../types/vocalPack.types';
import type { TimeAnchor } from '../types/toadaDocument.types';
import { midiToNoteName } from '../utils/noteUtils';
import { snapMidiToScale, type ScaleType } from './scaleQuantizer';
import { hasSyllableAttack } from './onsetDetector';
import { getPatternT1OffsetSec } from '../utils/anacrusisTimingHelper';
import { segmentPitchCurve, computeTrimmedMedianMidi, recalibrateBricksToLocalPitchCurve, type PitchSegment } from './pitchStepSegmentation';
import { buildBeatLyricsMap } from '../utils/timeAnchorParser';

export interface QuantizerParams {
  pitchCurve: PitchCurvePoint[]; bpm: number; beatsPerMeasure: number; measuresCount: number;
  beatResolutions: number[]; trimStartSec: number; trimEndSec: number; hasAnacrusis?: boolean;
  t1OffsetSec?: number; pitchOffsetSemitones?: number; smoothingLevel?: number;
  tonic?: string; scaleType?: ScaleType; pcm?: Float32Array; sampleRate?: number;
  timeAnchors?: TimeAnchor[];
}

export interface QuantizedGridResult {
  anacrusisSteps: VocalStepData[]; gridSteps: VocalStepData[]; totalSteps: number;
}

function findSegmentForStep(segments: PitchSegment[], sStart: number, sEnd: number, sDur: number): PitchSegment | null {
  let best: PitchSegment | null = null, maxOverlap = 0;
  for (const seg of segments) {
    const overlap = Math.max(0, Math.min(sEnd, seg.endSec) - Math.max(sStart, seg.startSec));
    if (overlap > maxOverlap) { maxOverlap = overlap; best = seg; }
  }
  return (best && (maxOverlap >= Math.min(0.035, sDur * 0.30) || (best.startSec >= sStart && best.endSec <= sEnd))) ? best : null;
}

export function quantizePitchToSteps(params: QuantizerParams): QuantizedGridResult {
  const { pitchCurve, bpm, beatsPerMeasure, measuresCount, beatResolutions, trimStartSec, trimEndSec, hasAnacrusis = true, tonic = 'C', scaleType = 'chromatic', pcm, sampleRate, timeAnchors = [] } = params;
  const beatDuration = 60 / bpm, measureDuration = beatsPerMeasure * beatDuration;
  const t1 = params.t1OffsetSec ?? getPatternT1OffsetSec(hasAnacrusis, measureDuration);
  const hasAnac = hasAnacrusis !== false, startM = hasAnac ? -1 : 0, gridStartSec = hasAnac ? (t1 - measureDuration) : t1;
  const pitchDiffLimit = Math.max(0.55, 0.55 + (params.smoothingLevel ?? 0.15) * 0.5);
  const allSteps: VocalStepData[] = [];
  const beatMap = buildBeatLyricsMap(timeAnchors, hasAnac);
  let globalStepIndex = 0, prevMidiFloat = 0;
  const segments = segmentPitchCurve(pitchCurve, { minDurationSec: 0.04, pitchJumpThreshold: pitchDiffLimit });

  for (let m = startM; m <= measuresCount; m++) {
    const mBaseSec = m === -1 ? (t1 - measureDuration) : (t1 + m * measureDuration);
    const beatsInThisM = (m === measuresCount) ? 1 : beatsPerMeasure;
    const mOffset = hasAnac ? (m === -1 ? 0 : m + 1) : m;

    for (let b = 0; b < beatsInThisM; b++) {
      const beatStartTime = mBaseSec + b * beatDuration;
      const resolution = beatResolutions[b] || 4, stepDuration = beatDuration / resolution;
      const anchor = beatMap[`${mOffset}_${b + 1}`];
      const isInitialRest = anchor?.isInitialRest === true, isSustainedHold = anchor?.isSustainedHold === true, hasLeadingRest = anchor?.hasLeadingRest === true;
      const sylCount = anchor?.syllables?.length || 0, startSub = hasLeadingRest ? 1 : 0, availRes = hasLeadingRest ? Math.max(1, resolution - 1) : resolution;
      const subdivTargets = new Set<number>();
      for (let k = 0; k < sylCount; k++) subdivTargets.add(Math.min(resolution - 1, startSub + Math.floor((k * availRes) / sylCount)));
      const beatPitch = computeTrimmedMedianMidi(pitchCurve, beatStartTime, beatStartTime + beatDuration, 0.2);
      let hasVoicedInBeat = false;

      for (let s = 0; s < resolution; s++) {
        const stepStart = beatStartTime + s * stepDuration, stepEnd = stepStart + stepDuration;
        const prevStep = allSteps[allSteps.length - 1];
        if (isInitialRest || stepStart >= trimEndSec) {
          allSteps.push({ stepIndex: globalStepIndex++, active: false, note: '', midiNumber: 0, velocity: 0, decay: stepDuration });
          prevMidiFloat = 0; continue;
        }
        if (hasLeadingRest && s === 0) {
          const s0Voiced = computeTrimmedMedianMidi(pitchCurve, stepStart, stepEnd, 0.2) !== null;
          if (prevStep?.active && prevStep.midiNumber > 0 && s0Voiced) {
            allSteps.push({ stepIndex: globalStepIndex++, active: true, note: '───', midiNumber: prevStep.midiNumber, syllable: '', syllableAttack: false, isTie: true, velocity: 90, decay: stepDuration });
          } else {
            allSteps.push({ stepIndex: globalStepIndex++, active: false, note: '', midiNumber: 0, velocity: 0, decay: stepDuration });
            prevMidiFloat = 0;
          }
          continue;
        }

        let localPitch = computeTrimmedMedianMidi(pitchCurve, stepStart, stepEnd, 0.2);
        if (!localPitch && sylCount > 0 && s >= startSub && beatPitch && (subdivTargets.has(s) || hasVoicedInBeat)) {
          localPitch = computeTrimmedMedianMidi(pitchCurve, stepStart, beatStartTime + beatDuration, 0.2) ?? beatPitch;
        }
        const bestSegment = findSegmentForStep(segments, stepStart, stepEnd, stepDuration);
        if (!localPitch && (!bestSegment || stepEnd <= trimStartSec)) {
          allSteps.push({ stepIndex: globalStepIndex++, active: false, note: '', midiNumber: 0, velocity: 0, decay: stepDuration });
          prevMidiFloat = 0; continue;
        }

        const curFloat = localPitch ? localPitch.midiFloat : bestSegment!.medianMidiFloat;
        let targetMidi = localPitch ? localPitch.midi : bestSegment!.medianMidi;
        if (scaleType !== 'chromatic') targetMidi = snapMidiToScale(targetMidi, tonic, scaleType);

        const isFirstVoicedWithSyl = !hasVoicedInBeat && sylCount > 0;
        hasVoicedInBeat = true;
        const isSubdivAttack = sylCount > 0 && subdivTargets.has(s);
        const allowAcousticAttack = timeAnchors.length === 0 || (sylCount === 0 && !isSustainedHold);
        const acousticAttack = allowAcousticAttack && pcm && sampleRate ? hasSyllableAttack(pcm, sampleRate, stepStart, stepEnd) : false;
        const hasAttack = !isSustainedHold && (isFirstVoicedWithSyl || isSubdivAttack || acousticAttack);

        const samePitch = Boolean(prevStep && prevStep.active && prevStep.midiNumber === targetMidi && (prevMidiFloat <= 0 || Math.abs(curFloat - prevMidiFloat) < pitchDiffLimit));
        const canTie = Boolean(prevStep && prevStep.active && (isSustainedHold || (!hasAttack && samePitch)));
        if (!canTie) prevMidiFloat = curFloat;
        const effectiveMidi = (canTie && isSustainedHold) ? prevStep.midiNumber : targetMidi;

        allSteps.push({
          stepIndex: globalStepIndex++, active: true, note: canTie ? '───' : midiToNoteName(effectiveMidi),
          midiNumber: effectiveMidi, syllable: '', syllableAttack: hasAttack, isTie: canTie, velocity: canTie ? 90 : 100, decay: stepDuration,
        });
      }
    }
  }

  const baseStepDur = beatDuration / (beatResolutions[0] || 4);
  const calibrated = recalibrateBricksToLocalPitchCurve(allSteps, pitchCurve, gridStartSec, baseStepDur, tonic, scaleType);
  const anacrusisCount = hasAnac ? beatsPerMeasure * (beatResolutions[0] || 4) : 0;
  return {
    anacrusisSteps: hasAnac ? calibrated.slice(0, anacrusisCount) : [],
    gridSteps: (hasAnac ? calibrated.slice(anacrusisCount) : calibrated).map((st, i) => ({ ...st, stepIndex: i })),
    totalSteps: calibrated.length,
  };
}

export function requantizeStepsInTimeRange(
  curve: PitchCurvePoint[], existingSteps: VocalStepData[], startSec: number, endSec: number, stepDurationSec: number, _anacCount = 0, tGridStart = 0
): VocalStepData[] {
  if (!existingSteps || existingSteps.length === 0 || stepDurationSec <= 0) return existingSteps;
  const segments = segmentPitchCurve(curve, { minDurationSec: 0.04, pitchJumpThreshold: 0.65 });
  const result = existingSteps.map((s) => ({ ...s }));
  for (let i = 0; i < result.length; i++) {
    const sStart = tGridStart + i * stepDurationSec, sEnd = sStart + stepDurationSec;
    if (sEnd <= startSec - 0.005 || sStart >= endSec + 0.005) continue;
    const local = computeTrimmedMedianMidi(curve, sStart, sEnd, 0.2);
    const bestSegment = findSegmentForStep(segments, sStart, sEnd, stepDurationSec);
    if (!local && !bestSegment) { result[i] = { ...result[i], active: false, note: '', midiNumber: 0 }; continue; }
    const targetMidi = local ? local.midi : bestSegment!.medianMidi, prev = i > 0 ? result[i - 1] : null;
    const isTie = Boolean(prev && prev.active && prev.midiNumber === targetMidi && !result[i].syllableAttack);
    result[i] = { ...result[i], active: true, note: isTie ? '───' : midiToNoteName(targetMidi), midiNumber: targetMidi, velocity: isTie ? 90 : (result[i].velocity || 100), decay: stepDurationSec };
  }
  return recalibrateBricksToLocalPitchCurve(result, curve, tGridStart, stepDurationSec);
}
