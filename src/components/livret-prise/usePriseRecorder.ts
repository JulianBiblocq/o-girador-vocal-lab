/**
 * usePriseRecorder.ts
 * Hook de gestion du cycle d'enregistrement audio et du précompte métronome (< 135 lignes).
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import type { TimeSignatureString } from '../../types/vocalPack.types';
import type { VocalPatternItem, VocalAudioVariant } from '../../types/toadaProject.types';
import type { MetronomeEngine, ListeningMode } from '../../audio/MetronomeEngine';
import type { VocalRecorderEngine } from '../../audio/VocalRecorderEngine';
import { scheduleCuePatternAudio, type CuePlaybackHandle } from '../../audio/cueAudioHelper';
import { scheduleSecondaryTakeGuide, type TakeGuideHandle } from '../../audio/takeGuideHelper';
import { buildDeviceSignature } from '../../utils/deviceSignature';
import { getSavedLatencyOffsetMs } from '../../utils/latencyStorage';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { NO_ANACRUSIS_PRE_MARGIN_SEC, getPatternTotalDurationSec } from '../../utils/anacrusisTimingHelper';
import { registerAudioKillSwitch, stopAllActiveAudioEngines } from '../../audio/sharedAudioContext';

export interface UsePriseRecorderParams {
  engine: MetronomeEngine; recorder: VocalRecorderEngine;
  activePattern: VocalPatternItem; activeVariant: VocalAudioVariant;
  cueMode: string; getPreviousConductorPattern: () => VocalPatternItem | null;
  projectPatterns: VocalPatternItem[]; timeSignature: TimeSignatureString;
  measuresCount: 1 | 2 | 3 | 4; hasAnacrusis: boolean;
  beatsPerMeasure: number; beatDuration: number;
  effectiveBpm: number; effectivePitch: string;
  listeningMode: ListeningMode; selectedDeviceId: string; selectedOutputDeviceId: string;
  updateVariant: (patternId: string, variantKey: string, partial: Partial<VocalAudioVariant>) => void;
  updatePattern?: (patternId: string, partial: Partial<VocalPatternItem>) => void;
  updatePatternAndVariant?: (
    patternId: string, variantKey: string, patternPartial: Partial<VocalPatternItem>, variantPartial: Partial<VocalAudioVariant>
  ) => void;
  recordedSampleRate: number; setRecordedSampleRate: (sr: number) => void;
  activeLivret: string; harmonyConfig?: import('../../types/harmony.types').HarmonyConfig;
}

export function usePriseRecorder(params: UsePriseRecorderParams) {
  const {
    engine, recorder, activePattern, activeVariant, cueMode, getPreviousConductorPattern, projectPatterns,
    timeSignature, measuresCount, hasAnacrusis, beatsPerMeasure, beatDuration, effectiveBpm, effectivePitch,
    listeningMode, selectedDeviceId, selectedOutputDeviceId, updateVariant, updatePattern, updatePatternAndVariant,
    recordedSampleRate, setRecordedSampleRate, activeLivret, harmonyConfig,
  } = params;

  const [isCycleActive, setIsCycleActive] = useState(false);
  const cueHandleRef = useRef<CuePlaybackHandle | null>(null);
  const takeGuideRef = useRef<TakeGuideHandle | null>(null);
  const sessionTokenRef = useRef<number>(0), isMountedRef = useRef<boolean>(true);
  const activeLivretRef = useRef<string>(activeLivret);
  activeLivretRef.current = activeLivret;

  const setIsRecording = useVocalTransportStore((s) => s.setIsRecording);

  const abortCycle = useCallback(() => {
    sessionTokenRef.current += 1;
    engine.stop(); recorder.cleanup(); cueHandleRef.current?.stop(); takeGuideRef.current?.stop();
    setIsCycleActive(false); setIsRecording(false);
  }, [engine, recorder, setIsRecording]);

  const commitRecordedTake = useCallback((pcm: Float32Array, sr: number, t1OffsetSec: number, totalRecordedSec: number) => {
    const recResult = { pcm, sampleRate: sr, recordedBpm: effectiveBpm, t1OffsetSec };
    const varUpdates: Partial<VocalAudioVariant> = { recordingResult: recResult, t1OffsetSec, trimStartSec: 0, trimEndSec: totalRecordedSec };
    const isMainTake = activeVariant.speedRatio === 1.0 && activeVariant.pitchShiftSemitones === 0;
    const patUpdates: Partial<VocalPatternItem> = {
      ...(isMainTake ? { recordingResult: recResult, t1OffsetSec, trimStartSec: 0, trimEndSec: totalRecordedSec } : { t1OffsetSec }),
      pack: null, rawAudioSamples: null, isMidiInitialized: false, midiLocked: false,
    };
    if (updatePatternAndVariant) updatePatternAndVariant(activePattern.id, activeVariant.variantKey, patUpdates, varUpdates);
    else { updateVariant(activePattern.id, activeVariant.variantKey, varUpdates); updatePattern?.(activePattern.id, patUpdates); }
  }, [activePattern.id, activeVariant.variantKey, activeVariant.speedRatio, activeVariant.pitchShiftSemitones, effectiveBpm, updatePatternAndVariant, updateVariant, updatePattern]);

  const handleToggleRecord = useCallback(async () => {
    const measureDuration = beatsPerMeasure * beatDuration;
    const t1OffsetSec = hasAnacrusis ? measureDuration : NO_ANACRUSIS_PRE_MARGIN_SEC;
    const totalRecordedSec = getPatternTotalDurationSec(hasAnacrusis, measuresCount, measureDuration, 0.25, beatDuration, t1OffsetSec);
    if (isCycleActive) {
      sessionTokenRef.current += 1;
      engine.stop(); cueHandleRef.current?.stop(); takeGuideRef.current?.stop();
      commitRecordedTake(recorder.stop(), recordedSampleRate, t1OffsetSec, totalRecordedSec);
      setIsCycleActive(false); return;
    }

    stopAllActiveAudioEngines('prise-recorder');
    const token = ++sessionTokenRef.current;
    registerAudioKillSwitch('prise-recorder', abortCycle);

    const ctx = await engine.initContext(), sampleRate = await recorder.prepare(ctx, selectedDeviceId);
    if (!isMountedRef.current || sessionTokenRef.current !== token || activeLivretRef.current !== 'prise') {
      recorder.cleanup(); engine.stop(); return;
    }
    setRecordedSampleRate(sampleRate); await new Promise((r) => setTimeout(r, 180));
    if (!isMountedRef.current || sessionTokenRef.current !== token || activeLivretRef.current !== 'prise') {
      recorder.cleanup(); engine.stop(); return;
    }

    const cue = cueMode === 'none' ? null : cueMode === 'auto_previous' ? getPreviousConductorPattern() : projectPatterns.find((p) => p.id === cueMode);
    const hasCue = !!cue && !!(cue.recordingResult?.pcm?.length || cue.variants?.[cue.activeVariantKey]?.recordingResult?.pcm?.length);
    const preRollMeasures = hasCue && cue ? 1 + cue.measuresCount : (hasAnacrusis ? 2 : 1);
    const cycleStart = ctx.currentTime + 0.08, targetT1Time = cycleStart + preRollMeasures * measureDuration;
    const sig = buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, sampleRate);
    const latencySec = getSavedLatencyOffsetMs(sig) / 1000;
    const captureStart = (targetT1Time - t1OffsetSec) + latencySec;

    if (hasCue && cue && listeningMode === 'headphones') {
      cueHandleRef.current = scheduleCuePatternAudio(ctx, cue, cycleStart, beatsPerMeasure, beatDuration, effectiveBpm);
    }
    const isMainTake = activeVariant.speedRatio === 1.0 && activeVariant.pitchShiftSemitones === 0;
    if (!isMainTake && activePattern.midiLocked && activePattern.mainSteps?.length > 0 && listeningMode === 'headphones') {
      const guideAna = hasAnacrusis ? measureDuration : 0;
      takeGuideRef.current = scheduleSecondaryTakeGuide(ctx, ctx.destination, activePattern.anacrusisSteps || [], activePattern.mainSteps || [], targetT1Time - guideAna, guideAna, effectiveBpm, activeVariant.pitchShiftSemitones);
    }
    recorder.start(captureStart, totalRecordedSec);
    setIsCycleActive(true);
    await engine.startCycle({
      bpm: effectiveBpm, timeSignature, measuresCount, referencePitch: effectivePitch,
      listeningMode, outputDeviceId: selectedOutputDeviceId, preRollMeasures,
      harmonyGrid: activePattern.harmonyGrid, harmonyConfig, hasAnacrusis,
      pitchShiftSemitones: activeVariant.pitchShiftSemitones,
    }, () => {
      if (sessionTokenRef.current !== token) return;
      cueHandleRef.current?.stop(); takeGuideRef.current?.stop();
      commitRecordedTake(recorder.stop(), sampleRate, t1OffsetSec, totalRecordedSec);
      setIsCycleActive(false);
    }, cycleStart);
  }, [engine, recorder, isCycleActive, abortCycle, commitRecordedTake, selectedDeviceId, selectedOutputDeviceId, effectiveBpm, timeSignature, measuresCount, effectivePitch, listeningMode, beatsPerMeasure, beatDuration, cueMode, getPreviousConductorPattern, projectPatterns, activePattern, activeVariant, recordedSampleRate, setRecordedSampleRate, hasAnacrusis, harmonyConfig]);

  useEffect(() => {
    setIsRecording(isCycleActive);
    if (activeLivret !== 'prise') { if (isCycleActive) abortCycle(); return; }
    return useVocalTransportStore.getState().registerHandlers({
      toggleRecord: handleToggleRecord, stop: () => { if (isCycleActive) abortCycle(); },
    });
  }, [activeLivret, handleToggleRecord, isCycleActive, abortCycle, setIsRecording]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; abortCycle(); };
  }, [abortCycle]);

  return { isCycleActive, handleToggleRecord };
}
