/**
 * commitTakeAsyncHelper.ts
 * Validation instantanée d'une prise vocale en Cabine (0 ms de gel UI sur A Fita)
 * suivie de l'analyse mélodique asynchrone en arrière-plan via le Web Worker DSP (< 85 lignes).
 */
import type { TimeSignatureString } from '../../types/vocalPack.types';
import type { VocalPatternItem, VocalAudioVariant } from '../../types/toadaProject.types';
import { autoSnapT1ToVocalOnset } from '../../audio/vocalOnsetDetector';
import { mergePunchInMeasure } from '../../audio/punchInMerger';
import { getDefaultBeatResolutions } from '../../utils/alignmentMath';
import { extractMelodicDataInWorker, isVocalDspCancelled } from '../../workers/vocalDspWorkerClient';

export interface CommitRecordedTakeParams {
  rawCapturedPcm: Float32Array;
  sampleRate: number;
  t1OffsetSec: number;
  totalRecordedSec: number;
  activePattern: VocalPatternItem;
  activeVariant: VocalAudioVariant;
  punchMeasureIndex: number | null;
  effectiveBpm: number;
  effectivePitch: string;
  timeSignature: TimeSignatureString;
  measuresCount: 1 | 2 | 3 | 4;
  hasAnacrusis: boolean;
  beatsPerMeasure: number;
  beatDuration: number;
  updateVariant: (patternId: string, variantKey: string, partial: Partial<VocalAudioVariant>) => void;
  updatePattern?: (patternId: string, partial: Partial<VocalPatternItem>) => void;
  updatePatternAndVariant?: (patternId: string, variantKey: string, p: Partial<VocalPatternItem>, v: Partial<VocalAudioVariant>) => void;
}

export function commitRecordedTakeNonBlocking(params: CommitRecordedTakeParams): void {
  const {
    rawCapturedPcm, sampleRate: sr, t1OffsetSec, totalRecordedSec, activePattern, activeVariant,
    punchMeasureIndex, effectiveBpm, effectivePitch, timeSignature, measuresCount, hasAnacrusis,
    beatsPerMeasure, beatDuration, updateVariant, updatePattern, updatePatternAndVariant,
  } = params;

  const existingRec = activeVariant.recordingResult;
  const isPunchIn = Boolean(punchMeasureIndex && punchMeasureIndex >= 1 && existingRec?.pcm?.length);
  const measureDuration = beatsPerMeasure * beatDuration;
  const pcm = isPunchIn && existingRec && punchMeasureIndex
    ? mergePunchInMeasure({
        existingPCM: existingRec.pcm, punchPCM: rawCapturedPcm, sampleRate: sr,
        targetMeasureIndex: punchMeasureIndex, measuresCount, measureDurationSec: measureDuration,
        t1OffsetSec: existingRec.t1OffsetSec ?? t1OffsetSec,
      })
    : rawCapturedPcm;

  const finalTotalSec = isPunchIn && existingRec ? existingRec.pcm.length / sr : totalRecordedSec;
  const snappedT1 = isPunchIn && existingRec?.t1OffsetSec !== undefined
    ? existingRec.t1OffsetSec
    : autoSnapT1ToVocalOnset({
        pcm, sampleRate: sr, bpm: effectiveBpm, timeAnchors: activePattern.timeAnchors,
        hasAnacrusis, beatsPerMeasure, expectedT1Sec: t1OffsetSec,
      });

  const recResult = { pcm, sampleRate: sr, recordedBpm: effectiveBpm, t1OffsetSec: snappedT1 };
  const varUpdates: Partial<VocalAudioVariant> = { recordingResult: recResult, t1OffsetSec: snappedT1, trimStartSec: 0, trimEndSec: finalTotalSec };
  const isMainTake = activeVariant.speedRatio === 1.0 && activeVariant.pitchShiftSemitones === 0;
  const patUpdates: Partial<VocalPatternItem> = {
    ...(isMainTake ? { recordingResult: recResult, t1OffsetSec: snappedT1, trimStartSec: 0, trimEndSec: finalTotalSec, rawAudioSamples: pcm } : { t1OffsetSec: snappedT1 }),
    pack: null, isMidiInitialized: false, midiLocked: false, hasCanonicalAlignment: false as any, correctedAudioSamples: null,
  };

  if (updatePatternAndVariant) updatePatternAndVariant(activePattern.id, activeVariant.variantKey, patUpdates, varUpdates);
  else { updateVariant(activePattern.id, activeVariant.variantKey, varUpdates); updatePattern?.(activePattern.id, patUpdates); }

  if (!isMainTake) return;
  extractMelodicDataInWorker({
    rawPCM: pcm, sampleRate: sr, bpm: effectiveBpm, timeSignature, measuresCount, beatsPerMeasure,
    beatResolutions: activePattern.pack?.metadata.beatResolutions || getDefaultBeatResolutions(timeSignature),
    hasAnacrusis, trimStartSec: 0, trimEndSec: finalTotalSec, t1OffsetSec: snappedT1,
    referencePitch: effectivePitch, pitchShiftSemitones: activeVariant.pitchShiftSemitones,
    tessitura: activePattern.tessitura, assignedLyricsText: activePattern.assignedLyricsText,
    timeAnchors: activePattern.timeAnchors, lowCutEnabled: activeVariant.lowCutEnabled,
    enableTonePolish: activeVariant.enableTonePolish !== false, referenceMidiNotes: activePattern.referenceMidiNotes,
  }, { dedupeKey: `prise_extract_${activePattern.id}` }).then((res) => {
    updatePattern?.(activePattern.id, {
      pack: res.pack, rawAudioSamples: res.cleanPCM, rawPitchCurve: res.pitchCurve, pitchCurve: res.pitchCurve,
      anacrusisSteps: res.anacrusisSteps, mainSteps: res.mainSteps, isMidiInitialized: true,
    });
  }).catch((err) => { if (!isVocalDspCancelled(err)) console.warn('[commitTakeAsync] Worker error:', err); });
}
