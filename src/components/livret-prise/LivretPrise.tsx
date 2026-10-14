import React, { useState, useMemo, useCallback } from 'react';
import { Mic, Square } from 'lucide-react';
import { MetronomeEngine, getBeatsPerMeasure, type ListeningMode } from '../../audio/MetronomeEngine';
import { VocalRecorderEngine } from '../../audio/VocalRecorderEngine';
import { PendulumVisualizer } from '../PendulumVisualizer';
import { DeviceSelector } from './DeviceSelector';
import { MetricConfigPanel } from './MetricConfigPanel';
import { ListeningModePanel } from './ListeningModePanel';
import { WaveformTrimEditor } from './WaveformTrimEditor';
import { PackDownloadBanner } from './PackDownloadBanner';
import { getDefaultBeatResolutions } from '../../utils/alignmentMath';
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

  const handleToggleRecord = useCallback(async () => {
    if (isCycleActive) {
      engine.stop();
      const pcm = recorder.stop();
      setRecordedPCM(pcm);
      setIsCycleActive(false);
      return;
    }

    const ctx = await engine.initContext(selectedOutputDeviceId);
    const sampleRate = await recorder.prepare(ctx, selectedDeviceId);
    setRecordedSampleRate(sampleRate);

    const beatDuration = 60 / bpm;
    const totalDurationSec = (beatsPerMeasure + measuresCount * beatsPerMeasure) * beatDuration;
    const syncStartTime = ctx.currentTime + 0.05;

    recorder.start(syncStartTime, totalDurationSec);
    setIsCycleActive(true);

    await engine.startCycle(
      { bpm, timeSignature, measuresCount, referencePitch, listeningMode, outputDeviceId: selectedOutputDeviceId },
      () => {
        const pcm = recorder.stop();
        setRecordedPCM(pcm);
        setIsCycleActive(false);
      },
      syncStartTime
    );
  }, [engine, recorder, isCycleActive, selectedDeviceId, selectedOutputDeviceId, bpm, timeSignature, measuresCount, referencePitch, listeningMode, beatsPerMeasure]);

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full">
      <PendulumVisualizer
        engine={engine}
        isActive={isCycleActive}
        measuresCount={measuresCount}
        beatsPerMeasure={beatsPerMeasure}
      />

      {recordedPCM ? (
        <div key="waveform-view-block" className="flex flex-col gap-3">
          <WaveformTrimEditor
            rawPCM={recordedPCM}
            sampleRate={recordedSampleRate}
            bpm={bpm}
            timeSignature={timeSignature}
            measuresCount={measuresCount}
            beatsPerMeasure={beatsPerMeasure}
            beatResolutions={beatResolutions}
            referencePitch={referencePitch}
            outputDeviceId={selectedOutputDeviceId}
            onReset={() => { setRecordedPCM(null); setExportedPack(null); }}
            onPackReady={(pack) => setExportedPack(pack)}
          />
          {exportedPack && <PackDownloadBanner exportedPack={exportedPack} />}
        </div>
      ) : (
        <div key="record-button-block">
          <button
            type="button"
            onClick={handleToggleRecord}
            className={`w-full py-3.5 px-6 cordel-btn-primary text-sm tracking-widest uppercase cursor-pointer transition-colors ${
              isCycleActive ? 'bg-red-900 hover:bg-red-800' : ''
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              {isCycleActive ? (
                <>
                  <Square className="w-5 h-5 fill-current" />
                  <span>ARRÊTER LA PRISE</span>
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 text-red-500 fill-current animate-pulse" />
                  <span>ENREGISTRER LA VOIX (1 M ÉLAN + {measuresCount} M CHANT)</span>
                </>
              )}
            </div>
          </button>
        </div>
      )}

      {!recordedPCM && (
        <div key="config-panels-block" className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <MetricConfigPanel
            timeSignature={timeSignature}
            onTimeSignatureChange={setTimeSignature}
            bpm={bpm}
            onBpmChange={setBpm}
            measuresCount={measuresCount}
            onMeasuresCountChange={setMeasuresCount}
            beatResolutions={beatResolutions}
            onBeatResolutionsChange={setBeatResolutions}
            disabled={isCycleActive}
          />

          <div className="flex flex-col gap-3">
            <ListeningModePanel
              listeningMode={listeningMode}
              onListeningModeChange={setListeningMode}
              referencePitch={referencePitch}
              onReferencePitchChange={setReferencePitch}
              onPlayReferencePreview={() => engine.playReferencePitchPreview(referencePitch, 1.5, selectedOutputDeviceId)}
              disabled={isCycleActive}
            />

            <DeviceSelector
              selectedDeviceId={selectedDeviceId}
              onDeviceChange={setSelectedDeviceId}
              selectedOutputDeviceId={selectedOutputDeviceId}
              onOutputDeviceChange={setSelectedOutputDeviceId}
              disabled={isCycleActive}
            />
          </div>
        </div>
      )}
    </div>
  );
};
