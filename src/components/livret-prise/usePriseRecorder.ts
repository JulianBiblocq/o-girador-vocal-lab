/**
 * usePriseRecorder.ts
 * Hook de gestion du cycle d'enregistrement audio et du précompte métronome (< 125 lignes).
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
  recordedSampleRate: number; setRecordedSampleRate: (sr: number) => void;
  activeLivret: string; harmonyConfig?: import('../../types/harmony.types').HarmonyConfig;
}

export function usePriseRecorder(params: UsePriseRecorderParams) {
  const {
    engine, recorder, activePattern, activeVariant, cueMode, getPreviousConductorPattern, projectPatterns,
    timeSignature, measuresCount, hasAnacrusis, beatsPerMeasure, beatDuration, effectiveBpm, effectivePitch,
    listeningMode, selectedDeviceId, selectedOutputDeviceId, updateVariant, updatePattern, recordedSampleRate, setRecordedSampleRate, activeLivret,
    harmonyConfig,
  } = params;

  const [isCycleActive, setIsCycleActive] = useState(false);
  const cueHandleRef = useRef<CuePlaybackHandle | null>(null);
  const takeGuideRef = useRef<TakeGuideHandle | null>(null);
  const sessionTokenRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const activeLivretRef = useRef<string>(activeLivret);
  activeLivretRef.current = activeLivret;

  const setIsRecording = useVocalTransportStore((s) => s.setIsRecording);

  const abortCycle = useCallback(() => {
    sessionTokenRef.current += 1;
    engine.stop(); recorder.cleanup();
    cueHandleRef.current?.stop(); takeGuideRef.current?.stop();
    setIsCycleActive(false); setIsRecording(false);
  }, [engine, recorder, setIsRecording]);

  const handleToggleRecord = useCallback(async () => {
    const measureDuration = beatsPerMeasure * beatDuration;
    const totalRecordedSec = getPatternTotalDurationSec(hasAnacrusis, measuresCount, measureDuration, 0.25, beatDuration);
    if (isCycleActive) {
      sessionTokenRef.current += 1;
      engine.stop(); cueHandleRef.current?.stop(); takeGuideRef.current?.stop();
      updateVariant(activePattern.id, activeVariant.variantKey, { recordingResult: { pcm: recorder.stop(), sampleRate: recordedSampleRate, recordedBpm: effectiveBpm }, trimStartSec: 0, trimEndSec: totalRecordedSec });
      updatePattern?.(activePattern.id, { pack: null, rawAudioSamples: null, isMidiInitialized: false, midiLocked: false });
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

    const cue = cueMode === 'none' ? null : cueMode === 'auto_previous' ? getPreviousConductorPattern() : projectPatterns.find((p: any) => p.id === cueMode);
    const hasCue = !!cue && !!(cue.recordingResult?.pcm?.length || cue.variants?.[cue.activeVariantKey]?.recordingResult?.pcm?.length);
    const preRollMeasures = hasCue && cue ? cue.measuresCount : (hasAnacrusis ? 2 : 1);
    const countdownSec = hasAnacrusis ? (preRollMeasures - 1) * measureDuration : preRollMeasures * measureDuration;
    const preMarginSec = hasAnacrusis ? 0 : NO_ANACRUSIS_PRE_MARGIN_SEC;
    const cycleStart = ctx.currentTime + 0.08, sig = buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, sampleRate);
    const captureStart = cycleStart + countdownSec - preMarginSec - (getSavedLatencyOffsetMs(sig) / 1000);
    if (hasCue && cue && listeningMode === 'headphones') cueHandleRef.current = scheduleCuePatternAudio(ctx, cue, cycleStart, beatsPerMeasure, beatDuration);
    if (activeVariant.variantKey !== 'spd100_pit0' && activePattern.midiLocked && activePattern.mainSteps?.length > 0 && listeningMode === 'headphones') {
      const guideT1 = cycleStart + preRollMeasures * measureDuration, guideAna = hasAnacrusis ? measureDuration : 0;
      takeGuideRef.current = scheduleSecondaryTakeGuide(ctx, ctx.destination, activePattern.anacrusisSteps || [], activePattern.mainSteps || [], guideT1 - guideAna, guideAna, effectiveBpm, activeVariant.pitchShiftSemitones);
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
      updateVariant(activePattern.id, activeVariant.variantKey, { recordingResult: { pcm: recorder.stop(), sampleRate, recordedBpm: effectiveBpm }, trimStartSec: 0, trimEndSec: totalRecordedSec });
      updatePattern?.(activePattern.id, { pack: null, rawAudioSamples: null, isMidiInitialized: false, midiLocked: false });
      setIsCycleActive(false);
    }, cycleStart);
  }, [engine, recorder, isCycleActive, abortCycle, selectedDeviceId, selectedOutputDeviceId, effectiveBpm, timeSignature, measuresCount, effectivePitch, listeningMode, beatsPerMeasure, beatDuration, cueMode, getPreviousConductorPattern, projectPatterns, activePattern, activeVariant, updateVariant, updatePattern, recordedSampleRate, setRecordedSampleRate, hasAnacrusis, harmonyConfig]);

  useEffect(() => {
    setIsRecording(isCycleActive);
    if (activeLivret !== 'prise') { if (isCycleActive) abortCycle(); return; }
    return useVocalTransportStore.getState().registerHandlers({
      toggleRecord: handleToggleRecord,
      stop: () => { if (isCycleActive) abortCycle(); },
    });
  }, [activeLivret, handleToggleRecord, isCycleActive, abortCycle, setIsRecording]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; abortCycle(); };
  }, [abortCycle]);

  return { isCycleActive, handleToggleRecord };
}
