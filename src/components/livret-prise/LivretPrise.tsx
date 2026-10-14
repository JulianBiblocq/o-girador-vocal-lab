/**
 * LivretPrise.tsx
 * Livret 1 (Prise & Trim) synchronisé avec la Toada active et la pré-écoute d'appel (M-2 / M-1).
 */
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { MetronomeEngine, type ListeningMode } from '../../audio/MetronomeEngine';
import { VocalRecorderEngine } from '../../audio/VocalRecorderEngine';
import { closeSharedAudioContext } from '../../audio/sharedAudioContext';
import { scheduleCuePatternAudio, type CuePlaybackHandle } from '../../audio/cueAudioHelper';
import { PendulumVisualizer } from '../PendulumVisualizer';
import { WaveformTrimEditor } from './WaveformTrimEditor';
import { LivretMelodia } from '../livret-melodia/LivretMelodia';
import { RecordActionButton } from './RecordActionButton';
import { MetricConfigPanel } from './MetricConfigPanel';
import { ListeningModePanel } from './ListeningModePanel';
import { DeviceSelector } from './DeviceSelector';
import { CalibrationBanner } from './CalibrationBanner';
import { LivretTabsBar } from './LivretTabsBar';
import { CuePatternSelector } from './CuePatternSelector';
import { getBeatsPerMeasure } from '../../utils/musicalMath';
import { getDefaultBeatResolutions } from '../../utils/alignmentMath';
import { extractContinuousPitchCurve } from '../../audio/pitchExtractor';
import { quantizePitchToSteps } from '../../audio/stepQuantizer';
import { createPaddedPreviewBuffer } from '../../utils/wavEncoder';
import { buildDeviceSignature } from '../../utils/deviceSignature';
import { getSavedLatencyOffsetMs } from '../../utils/latencyStorage';
import { useToadaProject } from '../../context/ToadaProjectContext';
import type { TimeSignatureString, VocalPackExport, PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';

export const LivretPrise: React.FC = () => {
  const { project, activePattern, updatePattern, cueMode, getPreviousConductorPattern } = useToadaProject();
  const engine = useMemo(() => new MetronomeEngine(), []);
  const recorder = useMemo(() => new VocalRecorderEngine(), []);
  const cueHandleRef = useRef<CuePlaybackHandle | null>(null);

  const [activeLivret, setActiveLivret] = useState<'prise' | 'melodia'>('prise');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(''); const [selectedOutputDeviceId, setSelectedOutputDeviceId] = useState<string>('');
  const [timeSignature, setTimeSignature] = useState<TimeSignatureString>(project.timeSignature);
  const [bpm, setBpm] = useState<number>(project.bpm);
  const [beatResolutions, setBeatResolutions] = useState<number[]>(() => getDefaultBeatResolutions('4/4'));
  const [listeningMode, setListeningMode] = useState<ListeningMode>('headphones'); const [referencePitch, setReferencePitch] = useState<string>('C4');
  const [isCycleActive, setIsCycleActive] = useState<boolean>(false); const [recordedSampleRate, setRecordedSampleRate] = useState<number>(44100);
  const [melodicData, setMelodicData] = useState<{ pitchCurve: PitchCurvePoint[]; allSteps: VocalStepData[]; pack: VocalPackExport; cleanPCM: Float32Array } | null>(null);

  const measuresCount = activePattern.measuresCount;
  const recordedPCM = activePattern.recordingResult?.pcm ?? null;
  const beatsPerMeasure = getBeatsPerMeasure(timeSignature);
  const beatDuration = 60 / bpm;
  const anacrusisDurationSec = beatsPerMeasure * beatDuration;
  const totalDurationSec = (1 + measuresCount) * beatsPerMeasure * beatDuration;

  useEffect(() => () => { engine.stop(); recorder.cleanup(); cueHandleRef.current?.stop(); closeSharedAudioContext(); }, [engine, recorder]);

  const handleToggleRecord = useCallback(async () => {
    if (isCycleActive) {
      engine.stop();
      cueHandleRef.current?.stop();
      const pcm = recorder.stop();
      updatePattern(activePattern.id, { recordingResult: { pcm, sampleRate: recordedSampleRate } });
      setIsCycleActive(false);
      return;
    }
    const ctx = await engine.initContext();
    const sampleRate = await recorder.prepare(ctx, selectedDeviceId);
    setRecordedSampleRate(sampleRate);
    await new Promise((r) => setTimeout(r, 180));

    const countdownSec = beatsPerMeasure * beatDuration;
    const singingSec = (1 + measuresCount) * beatsPerMeasure * beatDuration;
    const cycleStart = ctx.currentTime + 0.08;
    const anacrusisStart = cycleStart + countdownSec;
    const sig = buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, sampleRate);
    const captureStart = anacrusisStart - (getSavedLatencyOffsetMs(sig) / 1000);

    const effectiveCue = cueMode === 'none' ? null : cueMode === 'auto_previous' ? getPreviousConductorPattern() : project.patterns.find((p) => p.id === cueMode);
    if (effectiveCue && listeningMode === 'headphones') {
      cueHandleRef.current = scheduleCuePatternAudio(ctx, effectiveCue, cycleStart, beatsPerMeasure, beatDuration);
    }

    recorder.start(captureStart, singingSec);
    setIsCycleActive(true);
    await engine.startCycle(
      { bpm, timeSignature, measuresCount, referencePitch, listeningMode, outputDeviceId: selectedOutputDeviceId },
      () => {
        cueHandleRef.current?.stop();
        const pcm = recorder.stop();
        updatePattern(activePattern.id, { recordingResult: { pcm, sampleRate } });
        setIsCycleActive(false);
      },
      cycleStart
    );
  }, [engine, recorder, isCycleActive, selectedDeviceId, selectedOutputDeviceId, bpm, timeSignature, measuresCount, referencePitch, listeningMode, beatsPerMeasure, beatDuration, cueMode, getPreviousConductorPattern, project.patterns, activePattern.id, updatePattern, recordedSampleRate]);

  const handlePackReady = useCallback((pack: VocalPackExport) => {
    if (!recordedPCM) return;
    const cleanPCM = createPaddedPreviewBuffer(recordedPCM, recordedSampleRate, totalDurationSec, 0, totalDurationSec, 0, true, true);
    const pitchCurve = extractContinuousPitchCurve(cleanPCM, { sampleRate: recordedSampleRate, totalDurationSec, trimStartSec: 0, trimEndSec: totalDurationSec });
    const q = quantizePitchToSteps({ pitchCurve, bpm, beatsPerMeasure, measuresCount, beatResolutions, trimStartSec: 0, trimEndSec: totalDurationSec, pcm: cleanPCM, sampleRate: recordedSampleRate });
    setMelodicData({ pitchCurve, allSteps: [...q.anacrusisSteps, ...q.gridSteps], pack, cleanPCM });
    updatePattern(activePattern.id, { pack });
    setActiveLivret('melodia');
  }, [recordedPCM, recordedSampleRate, totalDurationSec, bpm, beatsPerMeasure, measuresCount, beatResolutions, activePattern.id, updatePattern]);

  return (
    <div className="flex flex-col gap-3.5 w-full max-w-none">
      {melodicData && <LivretTabsBar activeLivret={activeLivret} onSelectLivret={setActiveLivret} />}
      {activeLivret === 'melodia' && melodicData ? (
        <LivretMelodia
          initialPack={melodicData.pack} cleanPCM={melodicData.cleanPCM} sampleRate={recordedSampleRate}
          totalDurationSec={totalDurationSec} anacrusisDurationSec={anacrusisDurationSec} beatsPerMeasure={beatsPerMeasure}
          measuresCount={measuresCount} pitchCurve={melodicData.pitchCurve} initialSteps={melodicData.allSteps}
          outputDeviceId={selectedOutputDeviceId} onBackToPrise={() => setActiveLivret('prise')}
          onPackUpdated={(p) => { setMelodicData((prev) => (prev ? { ...prev, pack: p } : null)); updatePattern(activePattern.id, { pack: p }); }}
        />
      ) : (
        <>
          <PendulumVisualizer engine={engine} isActive={isCycleActive} measuresCount={measuresCount} beatsPerMeasure={beatsPerMeasure} />
          {recordedPCM ? (
            <WaveformTrimEditor
              rawPCM={recordedPCM} sampleRate={recordedSampleRate} bpm={bpm} timeSignature={timeSignature}
              measuresCount={measuresCount} beatsPerMeasure={beatsPerMeasure} beatResolutions={beatResolutions}
              referencePitch={referencePitch} outputDeviceId={selectedOutputDeviceId}
              onReset={() => { updatePattern(activePattern.id, { recordingResult: null, pack: null }); setMelodicData(null); }}
              onPackReady={handlePackReady}
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              <RecordActionButton isCycleActive={isCycleActive} measuresCount={measuresCount} onToggleRecord={handleToggleRecord} />
              <CuePatternSelector disabled={isCycleActive} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch pt-1">
                <MetricConfigPanel timeSignature={timeSignature} onTimeSignatureChange={setTimeSignature} bpm={bpm} onBpmChange={setBpm} measuresCount={measuresCount} onMeasuresCountChange={(c) => updatePattern(activePattern.id, { measuresCount: c as 1|2|3|4 })} beatResolutions={beatResolutions} onBeatResolutionsChange={setBeatResolutions} disabled={isCycleActive} />
                <ListeningModePanel listeningMode={listeningMode} onListeningModeChange={setListeningMode} referencePitch={referencePitch} onReferencePitchChange={setReferencePitch} onPlayReferencePreview={() => engine.playReferencePitchPreview(referencePitch, 1.5, selectedOutputDeviceId)} disabled={isCycleActive} />
                <div className="h-full flex flex-col justify-between gap-4">
                  <CalibrationBanner inputDeviceId={selectedDeviceId} outputDeviceId={selectedOutputDeviceId} sampleRate={recordedSampleRate} onCalibrationComplete={() => {}} disabled={isCycleActive} />
                  <DeviceSelector selectedDeviceId={selectedDeviceId} onDeviceChange={setSelectedDeviceId} selectedOutputDeviceId={selectedOutputDeviceId} onOutputDeviceChange={(id) => { setSelectedOutputDeviceId(id); engine.setOutputDevice(id); }} disabled={isCycleActive} />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
