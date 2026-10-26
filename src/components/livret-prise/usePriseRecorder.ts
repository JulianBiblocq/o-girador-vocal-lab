/**
 * usePriseRecorder.ts
 * Hook de gestion du cycle d'enregistrement audio et du précompte métronome (< 90 lignes).
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

export interface UsePriseRecorderParams {
  engine: MetronomeEngine;
  recorder: VocalRecorderEngine;
  activePattern: VocalPatternItem;
  activeVariant: VocalAudioVariant;
  cueMode: string;
  getPreviousConductorPattern: () => VocalPatternItem | null;
  projectPatterns: VocalPatternItem[];
  timeSignature: TimeSignatureString;
  measuresCount: 1 | 2 | 3 | 4;
  hasAnacrusis: boolean;
  beatsPerMeasure: number;
  beatDuration: number;
  effectiveBpm: number;
  effectivePitch: string;
  listeningMode: ListeningMode;
  selectedDeviceId: string;
  selectedOutputDeviceId: string;
  updateVariant: (patternId: string, variantKey: string, partial: Partial<VocalAudioVariant>) => void;
  updatePattern?: (patternId: string, partial: Partial<VocalPatternItem>) => void;
  recordedSampleRate: number;
  setRecordedSampleRate: (sr: number) => void;
  activeLivret: string;
  harmonyConfig?: import('../../types/harmony.types').HarmonyConfig;
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
  const { setIsRecording } = useVocalTransportStore();

  const handleToggleRecord = useCallback(async () => {
    const measureDuration = beatsPerMeasure * beatDuration;
    const extraEndBeatSec = beatDuration;
    const totalRecordedSec = getPatternTotalDurationSec(hasAnacrusis, measuresCount, measureDuration, 0.25, extraEndBeatSec);
    if (isCycleActive) {
      engine.stop(); cueHandleRef.current?.stop(); takeGuideRef.current?.stop();
      updateVariant(activePattern.id, activeVariant.variantKey, { recordingResult: { pcm: recorder.stop(), sampleRate: recordedSampleRate }, trimStartSec: 0, trimEndSec: totalRecordedSec });
      updatePattern?.(activePattern.id, { pack: null, rawAudioSamples: null, isMidiInitialized: false, midiLocked: false });
      setIsCycleActive(false); return;
    }
    const ctx = await engine.initContext(), sampleRate = await recorder.prepare(ctx, selectedDeviceId);
    setRecordedSampleRate(sampleRate); await new Promise((r) => setTimeout(r, 180));
    const cue = cueMode === 'none' ? null : cueMode === 'auto_previous' ? getPreviousConductorPattern() : projectPatterns.find((p: any) => p.id === cueMode);
    const hasCue = !!cue && !!(cue.recordingResult?.pcm?.length || cue.variants?.[cue.activeVariantKey]?.recordingResult?.pcm?.length);
    const cueMeasures = hasCue && cue ? cue.measuresCount : 1;
    const preRollMeasures = hasCue ? cueMeasures : (hasAnacrusis ? 2 : 1);
    const countdownSec = hasAnacrusis ? (preRollMeasures - 1) * measureDuration : preRollMeasures * measureDuration;
    const preMarginSec = hasAnacrusis ? 0 : NO_ANACRUSIS_PRE_MARGIN_SEC;
    const cycleStart = ctx.currentTime + 0.08, sig = buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, sampleRate);
    const captureStart = cycleStart + countdownSec - preMarginSec - (getSavedLatencyOffsetMs(sig) / 1000);
    if (hasCue && cue && listeningMode === 'headphones') cueHandleRef.current = scheduleCuePatternAudio(ctx, cue, cycleStart, beatsPerMeasure, beatDuration);
    const isTake1 = activeVariant.variantKey === 'spd100_pit0';
    if (!isTake1 && activePattern.midiLocked && activePattern.mainSteps?.length > 0 && listeningMode === 'headphones') {
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
      cueHandleRef.current?.stop(); takeGuideRef.current?.stop();
      updateVariant(activePattern.id, activeVariant.variantKey, { recordingResult: { pcm: recorder.stop(), sampleRate }, trimStartSec: 0, trimEndSec: totalRecordedSec });
      updatePattern?.(activePattern.id, { pack: null, rawAudioSamples: null, isMidiInitialized: false, midiLocked: false });
      setIsCycleActive(false);
    }, cycleStart);
  }, [engine, recorder, isCycleActive, selectedDeviceId, selectedOutputDeviceId, effectiveBpm, timeSignature, measuresCount, effectivePitch, listeningMode, beatsPerMeasure, beatDuration, cueMode, getPreviousConductorPattern, projectPatterns, activePattern, activeVariant, updateVariant, updatePattern, recordedSampleRate, hasAnacrusis, harmonyConfig]);

  useEffect(() => {
    setIsRecording(isCycleActive);
    if (activeLivret !== 'prise') return;
    return useVocalTransportStore.getState().registerHandlers({
      toggleRecord: handleToggleRecord,
      stop: () => { if (isCycleActive) { engine.stop(); cueHandleRef.current?.stop(); takeGuideRef.current?.stop(); setIsCycleActive(false); } },
    });
  }, [activeLivret, handleToggleRecord, isCycleActive, engine, setIsRecording]);

  return { isCycleActive, handleToggleRecord };
}
