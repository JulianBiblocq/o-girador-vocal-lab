/**
 * LivretPrise.tsx
 * Livret 1 : Prise vocale calée, matrice de déclinaisons & verrouillage MIDI sur Prise 1.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { TimeSignatureString, VocalPackExport, PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import { MetronomeEngine, type ListeningMode } from '../../audio/MetronomeEngine';
import { VocalRecorderEngine } from '../../audio/VocalRecorderEngine';
import { closeSharedAudioContext } from '../../audio/sharedAudioContext';
import { extractContinuousPitchCurve } from '../../audio/pitchExtractor';
import { quantizePitchToSteps } from '../../audio/stepQuantizer';
import { scheduleCuePatternAudio, type CuePlaybackHandle } from '../../audio/cueAudioHelper';
import { scheduleSecondaryTakeGuide, type TakeGuideHandle } from '../../audio/takeGuideHelper';
import { PendulumVisualizer } from '../PendulumVisualizer';
import { WaveformTrimEditor } from './WaveformTrimEditor';
import { RecordActionButton } from './RecordActionButton';
import { CuePatternSelector } from './CuePatternSelector';
import { LivretTabsBar, type LivretTabType } from './LivretTabsBar';
import { PriseConfigGrid } from './PriseConfigGrid';
import { PatternVariantSelector } from './PatternVariantSelector';
import { LivretMelodia } from '../livret-melodia/LivretMelodia';
import { LivretTreino } from '../livret-treino/LivretTreino';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { getBeatsPerMeasure, transposePitchNote } from '../../utils/musicalMath';
import { getDefaultBeatResolutions } from '../../utils/alignmentMath';
import { buildDeviceSignature } from '../../utils/deviceSignature';
import { getSavedLatencyOffsetMs } from '../../utils/latencyStorage';
import { createPaddedPreviewBuffer } from '../../utils/wavEncoder';

export const LivretPrise: React.FC = () => {
  const { project, activePattern, activeVariant, updatePattern, updateVariant, cueMode, getPreviousConductorPattern } = useToadaProject();
  const { t } = useLanguage();
  const engine = useMemo(() => new MetronomeEngine(), []);
  const recorder = useMemo(() => new VocalRecorderEngine(), []);
  const cueHandleRef = useRef<CuePlaybackHandle | null>(null);
  const takeGuideRef = useRef<TakeGuideHandle | null>(null);

  const [activeLivret, setActiveLivret] = useState<LivretTabType>('prise');
  const [selectedDeviceId, setSelectedDeviceId] = useState(''); const [selectedOutputDeviceId, setSelectedOutputDeviceId] = useState('');
  const [timeSignature, setTimeSignature] = useState<TimeSignatureString>(project.timeSignature); const [bpm, setBpm] = useState(project.bpm);
  const [beatResolutions, setBeatResolutions] = useState<number[]>(() => getDefaultBeatResolutions('4/4'));
  const [listeningMode, setListeningMode] = useState<ListeningMode>('headphones'); const [referencePitch, setReferencePitch] = useState('C4');
  const [isCycleActive, setIsCycleActive] = useState(false); const [recordedSampleRate, setRecordedSampleRate] = useState(44100);
  const [melodicData, setMelodicData] = useState<{ pitchCurve: PitchCurvePoint[]; allSteps: VocalStepData[]; pack: VocalPackExport; cleanPCM: Float32Array } | null>(null);

  const measuresCount = activePattern.measuresCount; const recordedPCM = activeVariant.recordingResult?.pcm ?? null;
  const beatsPerMeasure = getBeatsPerMeasure(timeSignature); const effectiveBpm = Math.max(30, Math.round(bpm * activeVariant.speedRatio));
  const effectivePitch = useMemo(() => transposePitchNote(referencePitch, activeVariant.pitchShiftSemitones), [referencePitch, activeVariant.pitchShiftSemitones]);
  const beatDuration = 60 / effectiveBpm; const anacrusisDurationSec = beatsPerMeasure * beatDuration;
  const totalDurationSec = (1 + measuresCount) * beatsPerMeasure * beatDuration;

  useEffect(() => () => { engine.stop(); recorder.cleanup(); cueHandleRef.current?.stop(); takeGuideRef.current?.stop(); closeSharedAudioContext(); }, [engine, recorder]);

  const handleToggleRecord = useCallback(async () => {
    if (isCycleActive) {
      engine.stop(); cueHandleRef.current?.stop(); takeGuideRef.current?.stop();
      const pcm = recorder.stop();
      updateVariant(activePattern.id, activeVariant.variantKey, { recordingResult: { pcm, sampleRate: recordedSampleRate } });
      setIsCycleActive(false); return;
    }
    const ctx = await engine.initContext();
    const sampleRate = await recorder.prepare(ctx, selectedDeviceId);
    setRecordedSampleRate(sampleRate);
    await new Promise((r) => setTimeout(r, 180));
    const countdownSec = beatsPerMeasure * beatDuration; const singingSec = (1 + measuresCount) * beatsPerMeasure * beatDuration;
    const cycleStart = ctx.currentTime + 0.08; const sig = buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, sampleRate);
    const captureStart = cycleStart + countdownSec - (getSavedLatencyOffsetMs(sig) / 1000);
    const cue = cueMode === 'none' ? null : cueMode === 'auto_previous' ? getPreviousConductorPattern() : project.patterns.find((p) => p.id === cueMode);
    if (cue && listeningMode === 'headphones') cueHandleRef.current = scheduleCuePatternAudio(ctx, cue, cycleStart, beatsPerMeasure, beatDuration);
    const isTake1 = activeVariant.variantKey === 'spd100_pit0';
    if (!isTake1 && activePattern.midiLocked && activePattern.mainSteps?.length > 0 && listeningMode === 'headphones') {
      takeGuideRef.current = scheduleSecondaryTakeGuide(ctx, ctx.destination, activePattern.anacrusisSteps || [], activePattern.mainSteps || [], cycleStart, countdownSec, effectiveBpm, activeVariant.pitchShiftSemitones);
    }
    recorder.start(captureStart, singingSec);
    setIsCycleActive(true);
    await engine.startCycle({ bpm: effectiveBpm, timeSignature, measuresCount, referencePitch: effectivePitch, listeningMode, outputDeviceId: selectedOutputDeviceId }, () => {
      cueHandleRef.current?.stop(); takeGuideRef.current?.stop();
      const pcm = recorder.stop();
      updateVariant(activePattern.id, activeVariant.variantKey, { recordingResult: { pcm, sampleRate } });
      setIsCycleActive(false);
    }, cycleStart);
  }, [engine, recorder, isCycleActive, selectedDeviceId, selectedOutputDeviceId, effectiveBpm, timeSignature, measuresCount, effectivePitch, listeningMode, beatsPerMeasure, beatDuration, cueMode, getPreviousConductorPattern, project.patterns, activePattern, activeVariant, updateVariant, recordedSampleRate]);

  const handlePackReady = useCallback((pack: VocalPackExport) => {
    if (!recordedPCM) return;
    const cleanPCM = createPaddedPreviewBuffer(recordedPCM, recordedSampleRate, totalDurationSec, 0, totalDurationSec, 0, true, true);
    const isTake1 = activeVariant.variantKey === 'spd100_pit0';
    if (isTake1 || !activePattern.midiLocked) {
      const pitchCurve = extractContinuousPitchCurve(cleanPCM, { sampleRate: recordedSampleRate, totalDurationSec, trimStartSec: 0, trimEndSec: totalDurationSec });
      const q = quantizePitchToSteps({ pitchCurve, bpm: effectiveBpm, beatsPerMeasure, measuresCount, beatResolutions, trimStartSec: 0, trimEndSec: totalDurationSec, pcm: cleanPCM, sampleRate: recordedSampleRate });
      setMelodicData({ pitchCurve, allSteps: [...q.anacrusisSteps, ...q.gridSteps], pack, cleanPCM });
      updatePattern(activePattern.id, { pack, midiLocked: true, anacrusisSteps: q.anacrusisSteps, mainSteps: q.gridSteps, pitchCurve });
    } else {
      updateVariant(activePattern.id, activeVariant.variantKey, { recordingResult: { pcm: recordedPCM, sampleRate: recordedSampleRate } });
      setMelodicData({ pitchCurve: activePattern.pitchCurve || [], allSteps: [...(activePattern.anacrusisSteps || []), ...(activePattern.mainSteps || [])], pack, cleanPCM });
    }
    setActiveLivret('melodia');
  }, [recordedPCM, recordedSampleRate, totalDurationSec, effectiveBpm, beatsPerMeasure, measuresCount, beatResolutions, activePattern, activeVariant, updatePattern, updateVariant]);

  return (
    <div className="flex flex-col gap-3.5 w-full max-w-none">
      <LivretTabsBar activeLivret={activeLivret} onSelectLivret={setActiveLivret} canAccessMelodia={!!melodicData || !!activePattern.pack} />
      {activeLivret === 'treino' ? <LivretTreino /> : activeLivret === 'melodia' && (melodicData || activePattern.pack) ? (
        <LivretMelodia
          initialPack={melodicData?.pack ?? activePattern.pack!} cleanPCM={melodicData?.cleanPCM ?? recordedPCM ?? new Float32Array(0)}
          sampleRate={recordedSampleRate} totalDurationSec={totalDurationSec} anacrusisDurationSec={anacrusisDurationSec}
          beatsPerMeasure={beatsPerMeasure} measuresCount={measuresCount} pitchCurve={melodicData?.pitchCurve ?? []}
          initialSteps={melodicData?.allSteps ?? activePattern.mainSteps} outputDeviceId={selectedOutputDeviceId}
          pitchShiftSemitones={activeVariant.pitchShiftSemitones} onBackToPrise={() => setActiveLivret('prise')}
          onPackUpdated={(p) => { setMelodicData((prev) => (prev ? { ...prev, pack: p } : null)); updatePattern(activePattern.id, { pack: p }); }}
        />
      ) : (
        <>
          <PatternVariantSelector baseBpm={bpm} referencePitch={referencePitch} disabled={isCycleActive} onPlayPitchPreview={(p) => engine.playReferencePitchPreview(p, 1.5, selectedOutputDeviceId)} />
          <PendulumVisualizer engine={engine} isActive={isCycleActive} measuresCount={measuresCount} beatsPerMeasure={beatsPerMeasure} />
          {recordedPCM ? (
            <WaveformTrimEditor
              rawPCM={recordedPCM} sampleRate={recordedSampleRate} bpm={effectiveBpm} timeSignature={timeSignature}
              measuresCount={measuresCount} beatsPerMeasure={beatsPerMeasure} beatResolutions={beatResolutions}
              referencePitch={effectivePitch} outputDeviceId={selectedOutputDeviceId}
              onReset={() => updateVariant(activePattern.id, activeVariant.variantKey, { recordingResult: null })} onPackReady={handlePackReady}
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {(activeVariant.speedRatio !== 1.0 || activeVariant.pitchShiftSemitones !== 0) && (
                <div className="cordel-card p-2 bg-amber-950/30 border border-amber-500/40 text-[11px] font-mono text-amber-200 flex flex-wrap items-center justify-between gap-1 rounded-none">
                  <span>{t('variant_tempo_banner', { nominal: bpm, effective: effectiveBpm, ratio: Math.round(activeVariant.speedRatio * 100) })}</span>
                  {activeVariant.pitchShiftSemitones !== 0 && (
                    <span className="text-amber-300 font-bold">{t('variant_pitch_banner', { nominal: referencePitch, effective: effectivePitch, semitones: activeVariant.pitchShiftSemitones })}</span>
                  )}
                </div>
              )}
              <RecordActionButton isCycleActive={isCycleActive} measuresCount={measuresCount} onToggleRecord={handleToggleRecord} />
              <CuePatternSelector disabled={isCycleActive} />
              <PriseConfigGrid
                timeSignature={timeSignature} onTimeSignatureChange={setTimeSignature} bpm={bpm} onBpmChange={setBpm} measuresCount={measuresCount} onMeasuresCountChange={(c) => updatePattern(activePattern.id, { measuresCount: c as 1|2|3|4 })}
                beatResolutions={beatResolutions} onBeatResolutionsChange={setBeatResolutions} listeningMode={listeningMode} onListeningModeChange={setListeningMode} referencePitch={referencePitch} effectivePitch={effectivePitch} onReferencePitchChange={setReferencePitch}
                engine={engine} selectedDeviceId={selectedDeviceId} onSelectedDeviceChange={setSelectedDeviceId} selectedOutputDeviceId={selectedOutputDeviceId} onSelectedOutputDeviceChange={setSelectedOutputDeviceId} recordedSampleRate={recordedSampleRate} isCycleActive={isCycleActive}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};
