/**
 * pitchToStepsQuantizer.ts — Quantification MIDI sub-temps Maracatu, noyau vocalique et gestion des silences (< 130 lignes).
 */
import type { PitchCurvePoint, VocalStepData } from '../types/vocalPack.types';
import type { TimeAnchor } from '../types/toadaDocument.types';
import { midiToNoteName } from '../utils/noteUtils';
import { snapMidiToScale, snapMidiWithBayesianScalePrior, type ScaleType } from './scaleQuantizer';
import { hasSyllableAttack } from './onsetDetector';
import { getPatternT1OffsetSec } from '../utils/anacrusisTimingHelper';
import { filterConsonantPitchDips, segmentPitchCurve, computeVowelCoreMidi, recalibrateBricksToLocalPitchCurve, inferBestDiatonicScale, type PitchSegment } from './pitchStepSegmentation';
import { computeVowelOnsetStrength, scoreMaracatuSubBeatPattern } from './maracatuSubBeatAligner';
import { buildBeatLyricsMap } from '../utils/timeAnchorParser';

export interface QuantizerParams {
  pitchCurve: PitchCurvePoint[]; bpm: number; beatsPerMeasure: number; measuresCount: number;
  beatResolutions: number[]; trimStartSec: number; trimEndSec: number; hasAnacrusis?: boolean;
  t1OffsetSec?: number; pitchOffsetSemitones?: number; smoothingLevel?: number;
  tonic?: string; scaleType?: ScaleType; allowedPitchClasses?: Set<number> | number[] | null;
  pcm?: Float32Array; sampleRate?: number; timeAnchors?: TimeAnchor[];
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
  const { bpm, beatsPerMeasure, measuresCount, beatResolutions, trimStartSec, trimEndSec, hasAnacrusis = true, tonic = 'C', scaleType = 'chromatic', allowedPitchClasses, pcm, sampleRate, timeAnchors = [] } = params;
  const pitchCurve = filterConsonantPitchDips(params.pitchCurve), inferred = inferBestDiatonicScale(pitchCurve, tonic), tuningOffset = inferred.tuningOffset;
  const beatDuration = 60 / bpm, measureDuration = beatsPerMeasure * beatDuration, t1 = params.t1OffsetSec ?? getPatternT1OffsetSec(hasAnacrusis, measureDuration);
  const hasAnac = hasAnacrusis !== false, startM = hasAnac ? -1 : 0, gridStartSec = hasAnac ? (t1 - measureDuration) : t1;
  const pitchDiffLimit = Math.max(0.55, 0.55 + (params.smoothingLevel ?? 0.15) * 0.5);
  const allSteps: VocalStepData[] = [], beatMap = buildBeatLyricsMap(timeAnchors, hasAnac);
  let globalStepIndex = 0, prevMidiFloat = 0;
  const segments = segmentPitchCurve(pitchCurve, { minDurationSec: 0.04, pitchJumpThreshold: pitchDiffLimit });

  for (let m = startM; m <= measuresCount; m++) {
    const mBaseSec = m === -1 ? (t1 - measureDuration) : (t1 + m * measureDuration);
    const beatsInThisM = (m === measuresCount) ? 1 : beatsPerMeasure, mOffset = hasAnac ? (m === -1 ? 0 : m + 1) : m;

    for (let b = 0; b < beatsInThisM; b++) {
      const beatStartTime = mBaseSec + b * beatDuration, resolution = beatResolutions[b] || 4, stepDuration = beatDuration / resolution;
      const anchor = beatMap[`${mOffset}_${b + 1}`];
      const isInitialRest = anchor?.isInitialRest === true, isSustainedHold = anchor?.isSustainedHold === true, hasLeadingRest = anchor?.hasLeadingRest === true;
      const sylCount = anchor?.syllables?.length || 0;
      const onsetProfile = computeVowelOnsetStrength(pcm, sampleRate, pitchCurve, beatStartTime, beatDuration, resolution);
      const hasExplicitUnderscore = Boolean(anchor?.textSlice && /[_𝄽]/.test(anchor.textSlice)) || Boolean(anchor?.isDownbeatLocked) || Boolean(anchor?.hasTrailingPickup);
      const maracatuFit = scoreMaracatuSubBeatPattern({
        syllableCount: sylCount, profile: onsetProfile, hasLeadingRest, hasTrailingPickup: anchor?.hasTrailingPickup,
        isDownbeatLocked: anchor?.isDownbeatLocked, explicitSubdivs: anchor?.syllableSubdivs, hasExplicitUnderscore,
      });
      const subdivTargets = new Set<number>(maracatuFit.subdivs), startSub = maracatuFit.subdivs.length > 0 ? maracatuFit.subdivs[0] : (hasLeadingRest ? 1 : 0);
      const beatPitch = computeVowelCoreMidi(pitchCurve, beatStartTime, beatStartTime + beatDuration, tuningOffset, inferred.allowedPitchClasses)
        ?? (sylCount > 0 && !isInitialRest ? computeVowelCoreMidi(pitchCurve, beatStartTime, beatStartTime + beatDuration * 1.6, tuningOffset, inferred.allowedPitchClasses) : null);
      let hasVoicedInBeat = false;

      for (let s = 0; s < resolution; s++) {
        const stepStart = beatStartTime + s * stepDuration, stepEnd = stepStart + stepDuration, prevStep = allSteps[allSteps.length - 1];
        if (isInitialRest || stepStart >= trimEndSec) {
          allSteps.push({ stepIndex: globalStepIndex++, active: false, note: '', midiNumber: 0, velocity: 0, decay: stepDuration });
          prevMidiFloat = 0; continue;
        }
        if ((hasLeadingRest && s === 0) || (sylCount > 0 && s < startSub)) {
          const sVoiced = computeVowelCoreMidi(pitchCurve, stepStart, stepEnd, tuningOffset) !== null;
          if (prevStep?.active && prevStep.midiNumber > 0 && sVoiced) {
            allSteps.push({ stepIndex: globalStepIndex++, active: true, note: '───', midiNumber: prevStep.midiNumber, syllable: '', syllableAttack: false, isTie: true, velocity: 90, decay: stepDuration });
          } else {
            allSteps.push({ stepIndex: globalStepIndex++, active: false, note: '', midiNumber: 0, velocity: 0, decay: stepDuration });
            prevMidiFloat = 0;
          }
          continue;
        }

        let localPitch = computeVowelCoreMidi(pitchCurve, stepStart, stepEnd, tuningOffset, inferred.allowedPitchClasses);
        if (!localPitch && sylCount > 0 && s >= startSub && beatPitch && (subdivTargets.has(s) || hasVoicedInBeat)) {
          localPitch = computeVowelCoreMidi(pitchCurve, stepStart, beatStartTime + beatDuration, tuningOffset, inferred.allowedPitchClasses) ?? beatPitch;
        }
        const bestSegment = findSegmentForStep(segments, stepStart, stepEnd, stepDuration);
        if (!localPitch && (!bestSegment || stepEnd <= trimStartSec)) {
          allSteps.push({ stepIndex: globalStepIndex++, active: false, note: '', midiNumber: 0, velocity: 0, decay: stepDuration });
          prevMidiFloat = 0; continue;
        }

        const curFloat = localPitch ? localPitch.midiFloat : bestSegment!.medianMidiFloat;
        const targetMidi = (scaleType !== 'chromatic' || allowedPitchClasses) ? snapMidiToScale(curFloat, tonic, scaleType, allowedPitchClasses) : snapMidiWithBayesianScalePrior(curFloat, inferred.allowedPitchClasses, 0, 0.32);
        const isFirstVoicedWithSyl = !hasVoicedInBeat && sylCount > 0;
        hasVoicedInBeat = true;
        const isSubdivAttack = sylCount > 0 && subdivTargets.has(s);
        const acousticAttack = (pcm && sampleRate ? hasSyllableAttack(pcm, sampleRate, stepStart, stepEnd) : false) || onsetProfile.hasImpulse[s];
        const allowAcousticSplit = timeAnchors.length === 0 || (sylCount === 0 && !isSustainedHold);
        const hasAttack = !isSustainedHold && (isFirstVoicedWithSyl || isSubdivAttack || (allowAcousticSplit && acousticAttack));
        const samePitch = Boolean(prevStep && prevStep.active && (sylCount > 0 || (prevStep.midiNumber === targetMidi && (prevMidiFloat <= 0 || Math.abs(curFloat - prevMidiFloat) < pitchDiffLimit))));
        const canTie = Boolean(prevStep && prevStep.active && (isSustainedHold || (!hasAttack && samePitch)));
        if (!canTie) prevMidiFloat = curFloat;
        const effectiveMidi = (canTie && (isSustainedHold || sylCount > 0)) ? prevStep.midiNumber : targetMidi;
        allSteps.push({
          stepIndex: globalStepIndex++, active: true, note: canTie ? '───' : midiToNoteName(effectiveMidi),
          midiNumber: effectiveMidi, syllable: '', syllableAttack: hasAttack, isTie: canTie, velocity: canTie ? 90 : 100, decay: stepDuration,
        });
      }
    }
  }

  const baseStepDur = beatDuration / (beatResolutions[0] || 4);
  const calibrated = recalibrateBricksToLocalPitchCurve(allSteps, pitchCurve, gridStartSec, baseStepDur, tonic, scaleType, params.smoothingLevel ?? 0.15, allowedPitchClasses);
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
  const segments = segmentPitchCurve(curve, { minDurationSec: 0.04, pitchJumpThreshold: 0.65 }), tuningOffset = inferBestDiatonicScale(curve).tuningOffset;
  const result = existingSteps.map((s) => ({ ...s }));
  for (let i = 0; i < result.length; i++) {
    const sStart = tGridStart + i * stepDurationSec, sEnd = sStart + stepDurationSec;
    if (sEnd <= startSec - 0.005 || sStart >= endSec + 0.005) continue;
    const local = computeVowelCoreMidi(curve, sStart, sEnd, tuningOffset), bestSegment = findSegmentForStep(segments, sStart, sEnd, stepDurationSec);
    if (!local && !bestSegment) { result[i] = { ...result[i], active: false, note: '', midiNumber: 0 }; continue; }
    const targetMidi = local ? local.midi : bestSegment!.medianMidi, prev = i > 0 ? result[i - 1] : null;
    const isTie = Boolean(prev && prev.active && prev.midiNumber === targetMidi && !result[i].syllableAttack);
    result[i] = { ...result[i], active: true, note: isTie ? '───' : midiToNoteName(targetMidi), midiNumber: targetMidi, velocity: isTie ? 90 : (result[i].velocity || 100), decay: stepDurationSec };
  }
  return recalibrateBricksToLocalPitchCurve(result, curve, tGridStart, stepDurationSec);
}
