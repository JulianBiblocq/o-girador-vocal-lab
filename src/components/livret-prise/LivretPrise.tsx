import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { MetronomeEngine, getBeatsPerMeasure, type ListeningMode } from '../../audio/MetronomeEngine';
import { VocalRecorderEngine } from '../../audio/VocalRecorderEngine';
import { closeSharedAudioContext } from '../../audio/sharedAudioContext';
import { PendulumVisualizer } from '../PendulumVisualizer';
import { RecordActionButton } from './RecordActionButton';
import { CalibrationBanner } from './CalibrationBanner';
import { DeviceSelector } from './DeviceSelector';
import { MetricConfigPanel } from './MetricConfigPanel';
import { ListeningModePanel } from './ListeningModePanel';
import { WaveformTrimEditor } from './WaveformTrimEditor';
import { PackDownloadBanner } from './PackDownloadBanner';
import { getDefaultBeatResolutions } from '../../utils/alignmentMath';
import { buildDeviceSignature } from '../../utils/deviceSignature';
import { getSavedLatencyOffsetMs } from '../../utils/latencyStorage';
import type { TimeSignatureString, VocalPackExport } from '../../types/vocalPack.types';

export const LivretPrise: React.FC = () => {
  const engine = useMemo(() => new MetronomeEngine(), []);
  const recorder = useMemo(() => new VocalRecorderEngine(), []);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [selectedOutputDeviceId, setSelectedOutputDeviceId] = useState<string>('');
  const [timeSignature, setTimeSignature] = useState<TimeSignatureString>('4/4');
  const [bpm, setBpm] = useState<number>(100);
  const [measuresCount, setMeasuresCount] = useState<number>(2);
  const [beatResolutions, setBeatResolutions] = useState<number[]>(() => getDefaultBeatResolutions('4/4'));
  const [listeningMode, setListeningMode] = useState<ListeningMode>('headphones');
  const [referencePitch, setReferencePitch] = useState<string>('C4');

  const [isCycleActive, setIsCycleActive] = useState<boolean>(false);
  const [recordedPCM, setRecordedPCM] = useState<Float32Array | null>(null);
  const [recordedSampleRate, setRecordedSampleRate] = useState<number>(44100);
  const [exportedPack, setExportedPack] = useState<VocalPackExport | null>(null);

  const beatsPerMeasure = getBeatsPerMeasure(timeSignature);

  useEffect(() => {
    return () => {
      engine.stop();
      recorder.cleanup();
      closeSharedAudioContext();
    };
  }, [engine, recorder]);

  const handleToggleRecord = useCallback(async () => {
    if (isCycleActive) {
      engine.stop();
      const pcm = recorder.stop();
      setRecordedPCM(pcm);
      setIsCycleActive(false);
      return;
    }

    const ctx = await engine.initContext();
    const sampleRate = await recorder.prepare(ctx, selectedDeviceId);
    setRecordedSampleRate(sampleRate);
    await new Promise((resolve) => setTimeout(resolve, 180));

    const beatDuration = 60 / bpm;
    const countdownDurationSec = beatsPerMeasure * beatDuration;
    const singingDurationSec = (1 + measuresCount) * beatsPerMeasure * beatDuration;

    const cycleStartTime = ctx.currentTime + 0.08;
    const anacrusisStartTime = cycleStartTime + countdownDurationSec;

    const sig = buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, sampleRate);
    const latencyOffsetMs = getSavedLatencyOffsetMs(sig);
    const captureStartTime = anacrusisStartTime - (latencyOffsetMs / 1000);

    recorder.start(captureStartTime, singingDurationSec);
    setIsCycleActive(true);

    await engine.startCycle(
      { bpm, timeSignature, measuresCount, referencePitch, listeningMode, outputDeviceId: selectedOutputDeviceId },
      () => {
        const pcm = recorder.stop();
        setRecordedPCM(pcm);
        setIsCycleActive(false);
      },
      cycleStartTime
    );
  }, [engine, recorder, isCycleActive, selectedDeviceId, selectedOutputDeviceId, bpm, timeSignature, measuresCount, referencePitch, listeningMode, beatsPerMeasure]);

  return (
    <div className="flex flex-col gap-3 max-w-2xl mx-auto w-full">
      <PendulumVisualizer engine={engine} isActive={isCycleActive} measuresCount={measuresCount} beatsPerMeasure={beatsPerMeasure} />

      {recordedPCM ? (
        <div key="waveform-view-block" className="flex flex-col gap-3">
          <WaveformTrimEditor
            rawPCM={recordedPCM} sampleRate={recordedSampleRate} bpm={bpm} timeSignature={timeSignature}
            measuresCount={measuresCount} beatsPerMeasure={beatsPerMeasure} beatResolutions={beatResolutions}
            referencePitch={referencePitch} outputDeviceId={selectedOutputDeviceId}
            onReset={() => { setRecordedPCM(null); setExportedPack(null); }}
            onPackReady={(pack) => setExportedPack(pack)}
          />
          {exportedPack && <PackDownloadBanner exportedPack={exportedPack} />}
        </div>
      ) : (
        <div key="setup-view-block" className="flex flex-col gap-2.5">
          <CalibrationBanner
            inputDeviceId={selectedDeviceId} outputDeviceId={selectedOutputDeviceId}
            sampleRate={recordedSampleRate} onCalibrationComplete={() => {}} disabled={isCycleActive}
          />
          <RecordActionButton isCycleActive={isCycleActive} measuresCount={measuresCount} onToggleRecord={handleToggleRecord} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <MetricConfigPanel
              timeSignature={timeSignature} onTimeSignatureChange={setTimeSignature} bpm={bpm} onBpmChange={setBpm}
              measuresCount={measuresCount} onMeasuresCountChange={setMeasuresCount} beatResolutions={beatResolutions}
              onBeatResolutionsChange={setBeatResolutions} disabled={isCycleActive}
            />
            <div className="flex flex-col gap-3">
              <ListeningModePanel
                listeningMode={listeningMode} onListeningModeChange={setListeningMode} referencePitch={referencePitch}
                onReferencePitchChange={setReferencePitch} onPlayReferencePreview={() => engine.playReferencePitchPreview(referencePitch, 1.5, selectedOutputDeviceId)}
                disabled={isCycleActive}
              />
              <DeviceSelector
                selectedDeviceId={selectedDeviceId} onDeviceChange={setSelectedDeviceId} selectedOutputDeviceId={selectedOutputDeviceId}
                onOutputDeviceChange={(id) => { setSelectedOutputDeviceId(id); engine.setOutputDevice(id); }} disabled={isCycleActive}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
