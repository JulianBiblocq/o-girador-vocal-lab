/**
 * useLivretMelodicInit.ts
 * Extraction du pitch Viterbi et initialisation/recalcul des briques MIDI pour LivretPrise (< 90 lignes).
 */
import { useCallback } from 'react';
import type { VocalPackExport, PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import type { VocalPatternItem, VocalAudioVariant } from '../../types/toadaProject.types';
import type { TessituraRange } from '../../types/tessitura.types';
import { extractContinuousPitchCurve } from '../../audio/pitchExtractor';
import { quantizePitchToSteps } from '../../audio/pitchToStepsQuantizer';
import { applyLyricsSyllablesToSteps } from '../../utils/syllableAligner';
import { createPaddedPreviewBuffer } from '../../utils/wavEncoder';

export interface MelodicData {
  pitchCurve: PitchCurvePoint[];
  allSteps: VocalStepData[];
  pack: VocalPackExport;
  cleanPCM: Float32Array;
}

interface UseLivretMelodicInitParams {
  recordedPCM: Float32Array | null;
  recordedSampleRate: number;
  totalDurationSec: number;
  effectiveBpm: number;
  beatsPerMeasure: number;
  measuresCount: number;
  beatResolutions: number[];
  hasAnacrusis: boolean;
  t1OffsetSec: number;
  activePattern: VocalPatternItem;
  activeVariant: VocalAudioVariant;
  updatePattern: (id: string, updates: Partial<VocalPatternItem>) => void;
  setActiveLivret: (livret: 'prise' | 'melodia' | 'treino') => void;
  setMelodicData: React.Dispatch<React.SetStateAction<MelodicData | null>>;
}

export function useLivretMelodicInit(params: UseLivretMelodicInitParams) {
  const {
    recordedPCM, recordedSampleRate, totalDurationSec, effectiveBpm, beatsPerMeasure,
    measuresCount, beatResolutions, hasAnacrusis, t1OffsetSec, activePattern, activeVariant,
    updatePattern, setActiveLivret, setMelodicData,
  } = params;

  const extractAndQuantize = useCallback((cleanPCM: Float32Array, vTrimStart: number, vTrimEnd: number, tessitura?: TessituraRange) => {
    const pitchCurve = extractContinuousPitchCurve(cleanPCM, {
      sampleRate: recordedSampleRate, totalDurationSec, trimStartSec: vTrimStart, trimEndSec: vTrimEnd,
      tessitura: tessitura || activePattern.tessitura,
    });
    const q = quantizePitchToSteps({
      pitchCurve, bpm: effectiveBpm, beatsPerMeasure, measuresCount, beatResolutions,
      trimStartSec: vTrimStart, trimEndSec: vTrimEnd, pcm: cleanPCM, sampleRate: recordedSampleRate,
      hasAnacrusis, t1OffsetSec, pitchOffsetSemitones: activeVariant.pitchShiftSemitones,
      timeAnchors: activePattern.timeAnchors,
    });
    const rawSteps = hasAnacrusis ? [...q.anacrusisSteps, ...q.gridSteps] : q.gridSteps;
    const allSteps = activePattern.assignedLyricsText ? applyLyricsSyllablesToSteps(rawSteps, activePattern.assignedLyricsText) : rawSteps;
    const anacCount = hasAnacrusis ? q.anacrusisSteps.length : 0;
    return { pitchCurve, allSteps, anacCount };
  }, [recordedSampleRate, totalDurationSec, activePattern, effectiveBpm, beatsPerMeasure, measuresCount, beatResolutions, hasAnacrusis, t1OffsetSec, activeVariant.pitchShiftSemitones]);

  const handlePackReady = useCallback((pack: VocalPackExport) => {
    if (!recordedPCM) return;
    const vTrimStart = activeVariant.trimStartSec > 0 ? activeVariant.trimStartSec : (pack.audio.trim.startSec ?? 0);
    const vTrimEnd = activeVariant.trimEndSec > 0 ? activeVariant.trimEndSec : (pack.audio.trim.endSec ?? totalDurationSec);
    const cleanPCM = createPaddedPreviewBuffer(recordedPCM, recordedSampleRate, totalDurationSec, vTrimStart, vTrimEnd, 0, activeVariant.lowCutEnabled, true, activeVariant.enableTonePolish !== false);

    if (!activePattern.isMidiInitialized || !activePattern.midiLocked) {
      const { pitchCurve, allSteps, anacCount } = extractAndQuantize(cleanPCM, vTrimStart, vTrimEnd, activePattern.tessitura);
      setMelodicData({ pitchCurve, allSteps, pack, cleanPCM });
      updatePattern(activePattern.id, {
        pack, midiLocked: true, isMidiInitialized: true, anacrusisSteps: hasAnacrusis ? allSteps.slice(0, anacCount) : [],
        mainSteps: allSteps.slice(anacCount), pitchCurve, rawAudioSamples: cleanPCM, rawPitchCurve: pitchCurve, pitchCorrectionAmount: 0, correctedAudioSamples: null,
      });
    } else {
      const steps = hasAnacrusis ? [...(activePattern.anacrusisSteps || []), ...(activePattern.mainSteps || [])] : (activePattern.mainSteps || []);
      setMelodicData({ pitchCurve: activePattern.pitchCurve || [], allSteps: steps, pack, cleanPCM });
      updatePattern(activePattern.id, { rawAudioSamples: cleanPCM, rawPitchCurve: activePattern.pitchCurve || [] });
    }
    setActiveLivret('melodia');
  }, [recordedPCM, activeVariant, totalDurationSec, recordedSampleRate, activePattern, extractAndQuantize, setMelodicData, updatePattern, hasAnacrusis, setActiveLivret]);

  const handleRecalculatePitch = useCallback((customTessitura?: TessituraRange) => {
    if (!recordedPCM) return;
    const vTrimStart = activeVariant.trimStartSec > 0 ? activeVariant.trimStartSec : 0;
    const vTrimEnd = activeVariant.trimEndSec > 0 ? activeVariant.trimEndSec : totalDurationSec;
    const cleanPCM = createPaddedPreviewBuffer(recordedPCM, recordedSampleRate, totalDurationSec, vTrimStart, vTrimEnd, 0, activeVariant.lowCutEnabled, true, activeVariant.enableTonePolish !== false);
    const { pitchCurve, allSteps, anacCount } = extractAndQuantize(cleanPCM, vTrimStart, vTrimEnd, customTessitura);
    setMelodicData((prev) => (prev ? { ...prev, pitchCurve, allSteps, cleanPCM } : null));
    updatePattern(activePattern.id, {
      pitchCurve, rawPitchCurve: pitchCurve, anacrusisSteps: hasAnacrusis ? allSteps.slice(0, anacCount) : [],
      mainSteps: allSteps.slice(anacCount), tessitura: customTessitura || activePattern.tessitura,
    });
  }, [recordedPCM, activeVariant, totalDurationSec, recordedSampleRate, extractAndQuantize, setMelodicData, updatePattern, activePattern.id, activePattern.tessitura, hasAnacrusis]);

  return { handlePackReady, handleRecalculatePitch };
}
