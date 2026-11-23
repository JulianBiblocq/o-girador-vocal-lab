/**
 * usePriseRecorder.ts — Hook de cycle d'enregistrement audio, précompte, Retour Confort, Baque casque et Punch-in (< 140 lignes).
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
import { NO_ANACRUSIS_PRE_MARGIN_SEC, getPatternTotalDurationSec, resolvePatternAnacrusisBeats } from '../../utils/anacrusisTimingHelper';
import { registerAudioKillSwitch, stopAllActiveAudioEngines } from '../../audio/sharedAudioContext';
import { createComfortMonitoringGraph, type ComfortMonitoringPreset, type ComfortMonitoringHandle } from '../../audio/ComfortMonitoringNode';
import { getActiveBackingTrack } from '../../utils/backingTrackStorage';
import { scheduleBackingTrackOnContext, type BackingTrackPlaybackHandle } from '../../audio/BackingTrackEngine';
import { schedulePunchInLeadInAudio } from '../../audio/punchInMerger';
import { commitRecordedTakeNonBlocking } from './commitTakeAsyncHelper';

export interface UsePriseRecorderParams {
  engine: MetronomeEngine; recorder: VocalRecorderEngine; activePattern: VocalPatternItem; activeVariant: VocalAudioVariant;
  cueMode: string; getPreviousConductorPattern: () => VocalPatternItem | null; projectPatterns: VocalPatternItem[];
  timeSignature: TimeSignatureString; measuresCount: 1 | 2 | 3 | 4; hasAnacrusis: boolean; beatsPerMeasure: number;
  beatDuration: number; effectiveBpm: number; effectivePitch: string; listeningMode: ListeningMode;
  selectedDeviceId: string; selectedOutputDeviceId: string;
  updateVariant: (patternId: string, variantKey: string, partial: Partial<VocalAudioVariant>) => void;
  updatePattern?: (patternId: string, partial: Partial<VocalPatternItem>) => void;
  updatePatternAndVariant?: (patternId: string, variantKey: string, p: Partial<VocalPatternItem>, v: Partial<VocalAudioVariant>) => void;
  recordedSampleRate: number; setRecordedSampleRate: (sr: number) => void; activeLivret: string;
  harmonyConfig?: import('../../types/harmony.types').HarmonyConfig; referencePitchHz?: number;
  comfortPreset?: ComfortMonitoringPreset; comfortMix?: number; backingInHeadphones?: boolean; punchMeasureIndex?: number | null;
}

export function usePriseRecorder(params: UsePriseRecorderParams) {
  const {
    engine, recorder, activePattern, activeVariant, cueMode, getPreviousConductorPattern, projectPatterns,
    timeSignature, measuresCount, hasAnacrusis, beatsPerMeasure, beatDuration, effectiveBpm, effectivePitch,
    listeningMode, selectedDeviceId, selectedOutputDeviceId, updateVariant, updatePattern, updatePatternAndVariant,
    recordedSampleRate, setRecordedSampleRate, activeLivret, harmonyConfig, referencePitchHz,
    comfortPreset = 'off', comfortMix = 0.35, backingInHeadphones = true, punchMeasureIndex = null,
  } = params;
  const [isCycleActive, setIsCycleActive] = useState(false), [hasClipped, setHasClipped] = useState(false);
  const peakDbRef = useRef<number | null>(null), peakListenerRef = useRef<((db: number | null) => void) | null>(null);
  const cueHandleRef = useRef<CuePlaybackHandle | null>(null), takeGuideRef = useRef<TakeGuideHandle | null>(null);
  const comfortRef = useRef<ComfortMonitoringHandle | null>(null), backingRef = useRef<BackingTrackPlaybackHandle | null>(null);
  const punchLeadRef = useRef<{ stop: () => void } | null>(null), sessionTokenRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true), activeLivretRef = useRef<string>(activeLivret);
  activeLivretRef.current = activeLivret;
  const setIsRecording = useVocalTransportStore((s) => s.setIsRecording);

  const stopAuxHandles = useCallback(() => {
    cueHandleRef.current?.stop(); takeGuideRef.current?.stop(); comfortRef.current?.disconnect(); comfortRef.current = null;
    backingRef.current?.stop(); backingRef.current = null; punchLeadRef.current?.stop(); punchLeadRef.current = null;
  }, []);
  const abortCycle = useCallback(() => {
    sessionTokenRef.current += 1; engine.stop(); recorder.cleanup(); stopAuxHandles(); setIsCycleActive(false); setIsRecording(false);
  }, [engine, recorder, setIsRecording, stopAuxHandles]);

  const commitRecordedTake = useCallback((rawCapturedPcm: Float32Array, sr: number, t1OffsetSec: number, totalRecordedSec: number) => {
    commitRecordedTakeNonBlocking({
      rawCapturedPcm, sampleRate: sr, t1OffsetSec, totalRecordedSec, activePattern, activeVariant,
      punchMeasureIndex, effectiveBpm, effectivePitch, timeSignature, measuresCount, hasAnacrusis,
      beatsPerMeasure, beatDuration, updateVariant, updatePattern, updatePatternAndVariant,
    });
  }, [activePattern, activeVariant, punchMeasureIndex, effectiveBpm, effectivePitch, timeSignature, hasAnacrusis, beatsPerMeasure, beatDuration, measuresCount, updatePatternAndVariant, updateVariant, updatePattern]);

  const handleToggleRecord = useCallback(async () => {
    const measureDuration = beatsPerMeasure * beatDuration;
    const t1OffsetSec = hasAnacrusis ? measureDuration : NO_ANACRUSIS_PRE_MARGIN_SEC;
    const totalRecordedSec = getPatternTotalDurationSec(hasAnacrusis, measuresCount, measureDuration, 0.25, beatDuration, t1OffsetSec);
    if (isCycleActive) {
      sessionTokenRef.current += 1; engine.stop(); stopAuxHandles();
      commitRecordedTake(recorder.stop(), recordedSampleRate, t1OffsetSec, totalRecordedSec); setIsCycleActive(false); return;
    }
    stopAllActiveAudioEngines('prise-recorder');
    const token = ++sessionTokenRef.current;
    registerAudioKillSwitch('prise-recorder', abortCycle);
    const ctx = await engine.initContext(), sampleRate = await recorder.prepare(ctx, selectedDeviceId);
    if (!isMountedRef.current || sessionTokenRef.current !== token || activeLivretRef.current !== 'prise') { recorder.cleanup(); engine.stop(); return; }
    setRecordedSampleRate(sampleRate); await new Promise((r) => setTimeout(r, 180));
    if (!isMountedRef.current || sessionTokenRef.current !== token || activeLivretRef.current !== 'prise') { recorder.cleanup(); engine.stop(); return; }

    const isPunchIn = Boolean(punchMeasureIndex && punchMeasureIndex >= 1 && activeVariant.recordingResult?.pcm?.length);
    const cue = cueMode === 'none' ? null : cueMode === 'auto_previous' ? getPreviousConductorPattern() : projectPatterns.find((p) => p.id === cueMode);
    const hasCue = !isPunchIn && !!cue && !!(cue.recordingResult?.pcm?.length || cue.variants?.[cue.activeVariantKey]?.recordingResult?.pcm?.length);
    const preRollMeasures = isPunchIn ? 1 : (hasCue && cue ? 1 + cue.measuresCount : (hasAnacrusis ? 2 : 1));
    const cycleStart = ctx.currentTime + 0.08, targetT1Time = cycleStart + preRollMeasures * measureDuration;
    const latencySec = getSavedLatencyOffsetMs(buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, sampleRate)) / 1000;
    const captureStart = isPunchIn ? targetT1Time + latencySec : (targetT1Time - t1OffsetSec) + latencySec;
    const effectiveRecSec = isPunchIn ? measureDuration + (punchMeasureIndex === measuresCount ? beatDuration : 0) : totalRecordedSec;

    recorder.setOnPeakUpdate((db, clipped) => { peakDbRef.current = db; peakListenerRef.current?.(db); if (clipped) setHasClipped(true); });
    const srcNode = recorder.getSourceNode();
    if (listeningMode === 'headphones' && srcNode && comfortPreset !== 'off') comfortRef.current = createComfortMonitoringGraph(ctx, srcNode, comfortPreset, comfortMix);
    if (listeningMode === 'headphones' && backingInHeadphones) backingRef.current = scheduleBackingTrackOnContext(ctx, getActiveBackingTrack(), targetT1Time, effectiveBpm, effectiveRecSec);
    if (isPunchIn && listeningMode === 'headphones' && activeVariant.recordingResult && punchMeasureIndex) {
      punchLeadRef.current = schedulePunchInLeadInAudio(ctx, activeVariant.recordingResult.pcm, sampleRate, punchMeasureIndex, measureDuration, activeVariant.recordingResult.t1OffsetSec ?? t1OffsetSec, cycleStart);
    }
    if (hasCue && cue) cueHandleRef.current = scheduleCuePatternAudio(ctx, cue, cycleStart, beatsPerMeasure, beatDuration, effectiveBpm);
    const isMainTake = activeVariant.speedRatio === 1.0 && activeVariant.pitchShiftSemitones === 0;
    if (!isMainTake && activePattern.midiLocked && activePattern.mainSteps?.length > 0 && listeningMode === 'headphones') {
      const guideAna = hasAnacrusis ? measureDuration : 0;
      takeGuideRef.current = scheduleSecondaryTakeGuide(ctx, ctx.destination, activePattern.anacrusisSteps || [], activePattern.mainSteps || [], targetT1Time - guideAna, guideAna, effectiveBpm, activeVariant.pitchShiftSemitones, referencePitchHz);
    }
    recorder.start(captureStart, effectiveRecSec); setIsCycleActive(true);
    const anacrusisBeats = resolvePatternAnacrusisBeats(activePattern, beatsPerMeasure);
    await engine.startCycle({
      bpm: effectiveBpm, timeSignature, measuresCount: (isPunchIn ? 1 : measuresCount) as 1 | 2 | 3 | 4, referencePitch: effectivePitch,
      listeningMode, outputDeviceId: selectedOutputDeviceId, preRollMeasures, referencePitchHz,
      harmonyGrid: activePattern.harmonyGrid, harmonyConfig, hasAnacrusis: isPunchIn ? false : hasAnacrusis, anacrusisBeats, pitchShiftSemitones: activeVariant.pitchShiftSemitones,
    }, () => {
      if (sessionTokenRef.current !== token) return;
      stopAuxHandles(); commitRecordedTake(recorder.stop(), sampleRate, t1OffsetSec, totalRecordedSec); setIsCycleActive(false);
    }, cycleStart);
  }, [engine, recorder, isCycleActive, abortCycle, stopAuxHandles, commitRecordedTake, selectedDeviceId, selectedOutputDeviceId, effectiveBpm, timeSignature, measuresCount, effectivePitch, listeningMode, beatsPerMeasure, beatDuration, cueMode, getPreviousConductorPattern, projectPatterns, activePattern, activeVariant, recordedSampleRate, setRecordedSampleRate, hasAnacrusis, harmonyConfig, referencePitchHz, comfortPreset, comfortMix, backingInHeadphones, punchMeasureIndex]);

  useEffect(() => {
    setIsRecording(isCycleActive);
    if (activeLivret !== 'prise') { if (isCycleActive) abortCycle(); return; }
    return useVocalTransportStore.getState().registerHandlers({ toggleRecord: handleToggleRecord, stop: () => { if (isCycleActive) abortCycle(); } });
  }, [activeLivret, handleToggleRecord, isCycleActive, abortCycle, setIsRecording]);
  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; abortCycle(); }; }, [abortCycle]);
  const registerPeakListener = useCallback((fn: ((db: number | null) => void) | null) => { peakListenerRef.current = fn; if (fn) fn(peakDbRef.current); }, []);
  const resetClipIndicator = useCallback(() => { recorder.resetPeakHold(); peakDbRef.current = null; peakListenerRef.current?.(null); setHasClipped(false); }, [recorder]);
  return { isCycleActive, handleToggleRecord, peakDb: null as number | null, registerPeakListener, hasClipped, resetClipIndicator };
}
