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
import { segmentPitchCurve, type PitchSegment } from './pitchStepSegmentation';
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
  const hasAnac = hasAnacrusis !== false, startM = hasAnac ? -1 : 0;
  const allSteps: VocalStepData[] = [];
  const beatMap = buildBeatLyricsMap(timeAnchors);
  let globalStepIndex = 0, previousSegmentId = -1;

  const segments = segmentPitchCurve(pitchCurve, { minDurationSec: 0.045, pitchJumpThreshold: 1.2 });

  for (let m = startM; m <= measuresCount; m++) {
    const mBaseSec = m === -1 ? (t1 - measureDuration) : (t1 + m * measureDuration);
    const beatsInThisM = (m === measuresCount) ? 1 : beatsPerMeasure;
    const mOffset = hasAnac ? (m === -1 ? 0 : m + 1) : m;

    for (let b = 0; b < beatsInThisM; b++) {
      const beatStartTime = mBaseSec + b * beatDuration;
      const resolution = beatResolutions[b] || 4, stepDuration = beatDuration / resolution;
      const anchor = beatMap[`${mOffset}_${b + 1}`];
      const isInitialRest = anchor?.isInitialRest === true;
      const isSustainedHold = anchor?.isSustainedHold === true;
      const sylCount = anchor?.syllables?.length || 0;

      for (let s = 0; s < resolution; s++) {
        const stepStart = beatStartTime + s * stepDuration, stepEnd = stepStart + stepDuration;
        if (isInitialRest || stepEnd <= trimStartSec || stepStart >= trimEndSec) {
          allSteps.push({ stepIndex: globalStepIndex++, active: false, note: '', midiNumber: 0, velocity: 0, decay: stepDuration });
          previousSegmentId = -1; continue;
        }

        const bestSegment = findSegmentForStep(segments, stepStart, stepEnd, stepDuration);
        if (!bestSegment) {
          allSteps.push({ stepIndex: globalStepIndex++, active: false, note: '', midiNumber: 0, velocity: 0, decay: stepDuration });
          previousSegmentId = -1; continue;
        }

        let targetMidi = bestSegment.medianMidi;
        if (scaleType !== 'chromatic') targetMidi = snapMidiToScale(targetMidi, tonic, scaleType);

        // Détection d'attaque sur le temps ou par répartition intra-temps des syllabes
        const isBeatStartWithSyllable = s === 0 && sylCount > 0;
        const isSubdivAttack = sylCount > 1 && (s === Math.floor(resolution / sylCount) || (sylCount >= 3 && s === Math.floor((2 * resolution) / sylCount)));
        // Sur une tenue déclarée (_ après chant), aucune attaque n'est redéclenchée
        const hasAttack = !isSustainedHold && (isBeatStartWithSyllable || isSubdivAttack || ((pcm && sampleRate) ? hasSyllableAttack(pcm, sampleRate, stepStart, stepEnd) : false));

        const prevStep = allSteps[allSteps.length - 1];
        // En tenue (isSustainedHold), si le pas précédent est actif, liaison continue sans attaque
        const canTie = prevStep && prevStep.active && (
          isSustainedHold ||
          (!hasAttack && previousSegmentId === bestSegment.id && prevStep.midiNumber === targetMidi)
        );
        const effectiveMidi = (canTie && isSustainedHold) ? prevStep.midiNumber : targetMidi;

        allSteps.push({
          stepIndex: globalStepIndex++, active: true, note: canTie ? '───' : midiToNoteName(effectiveMidi),
          midiNumber: effectiveMidi, syllable: '', syllableAttack: hasAttack, isTie: Boolean(canTie), velocity: canTie ? 90 : 100, decay: stepDuration,
        });
        previousSegmentId = bestSegment.id;
      }
    }
  }

  const anacrusisCount = hasAnac ? beatsPerMeasure * (beatResolutions[0] || 4) : 0;
  return {
    anacrusisSteps: hasAnac ? allSteps.slice(0, anacrusisCount) : [],
    gridSteps: (hasAnac ? allSteps.slice(anacrusisCount) : allSteps).map((st, i) => ({ ...st, stepIndex: i })),
    totalSteps: allSteps.length,
  };
}

export function requantizeStepsInTimeRange(
  curve: PitchCurvePoint[], existingSteps: VocalStepData[], startSec: number, endSec: number, stepDurationSec: number, _anacCount = 0
): VocalStepData[] {
  if (!existingSteps || existingSteps.length === 0 || stepDurationSec <= 0) return existingSteps;
  const segments = segmentPitchCurve(curve, { minDurationSec: 0.045, pitchJumpThreshold: 1.2 });
  const result = existingSteps.map((s) => ({ ...s }));
  let previousSegmentId = -1;

  for (let i = 0; i < result.length; i++) {
    const sStart = i * stepDurationSec, sEnd = sStart + stepDurationSec;
    if (sEnd <= startSec - 0.005 || sStart >= endSec + 0.005) {
      if (result[i].active) previousSegmentId = -1;
      continue;
    }
    const bestSegment = findSegmentForStep(segments, sStart, sEnd, stepDurationSec);
    if (!bestSegment) {
      result[i] = { ...result[i], active: false, note: '', midiNumber: 0 };
      previousSegmentId = -1; continue;
    }
    const targetMidi = bestSegment.medianMidi, prev = i > 0 ? result[i - 1] : null;
    const isTie = previousSegmentId === bestSegment.id && prev && prev.active && prev.midiNumber === targetMidi && !result[i].syllableAttack;
    result[i] = {
      ...result[i], active: true, note: isTie ? '───' : midiToNoteName(targetMidi),
      midiNumber: targetMidi, velocity: isTie ? 90 : (result[i].velocity || 100), decay: stepDurationSec,
    };
    previousSegmentId = bestSegment.id;
  }
  return result;
}
