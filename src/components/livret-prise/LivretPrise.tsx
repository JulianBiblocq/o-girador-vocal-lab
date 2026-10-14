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
import { LivretMelodia } from '../livret-melodia/LivretMelodia';
import { extractContinuousPitchCurve } from '../../audio/pitchExtractor';
import { quantizePitchToSteps } from '../../audio/stepQuantizer';
import { createPaddedPreviewBuffer } from '../../utils/wavEncoder';
import { getDefaultBeatResolutions } from '../../utils/alignmentMath';
import { buildDeviceSignature } from '../../utils/deviceSignature';
import { getSavedLatencyOffsetMs } from '../../utils/latencyStorage';
import type { TimeSignatureString, VocalPackExport, PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';

export const LivretPrise: React.FC = () => {
  const engine = useMemo(() => new MetronomeEngine(), []);
  const recorder = useMemo(() => new VocalRecorderEngine(), []);

  const [activeLivret, setActiveLivret] = useState<'prise' | 'melodia'>('prise');
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
  const [melodicData, setMelodicData] = useState<{ pitchCurve: PitchCurvePoint[]; allSteps: VocalStepData[]; pack: VocalPackExport; cleanPCM: Float32Array; } | null>(null);

  const beatsPerMeasure = getBeatsPerMeasure(timeSignature);
  const beatDuration = 60 / bpm;
  const anacrusisDurationSec = beatsPerMeasure * beatDuration;
  const totalDurationSec = (1 + measuresCount) * beatsPerMeasure * beatDuration;

  useEffect(() => () => { engine.stop(); recorder.cleanup(); closeSharedAudioContext(); }, [engine, recorder]);

  const handleToggleRecord = useCallback(async () => {
    if (isCycleActive) { engine.stop(); setRecordedPCM(recorder.stop()); setIsCycleActive(false); return; }
    const ctx = await engine.initContext();
    const sampleRate = await recorder.prepare(ctx, selectedDeviceId);
    setRecordedSampleRate(sampleRate);
    await new Promise((resolve) => setTimeout(resolve, 180));

    const countdownDurationSec = beatsPerMeasure * beatDuration;
    const singingDurationSec = (1 + measuresCount) * beatsPerMeasure * beatDuration;
    const cycleStartTime = ctx.currentTime + 0.08;
    const anacrusisStartTime = cycleStartTime + countdownDurationSec;

    const sig = buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, sampleRate);
    const captureStartTime = anacrusisStartTime - (getSavedLatencyOffsetMs(sig) / 1000);

    recorder.start(captureStartTime, singingDurationSec);
    setIsCycleActive(true);

    await engine.startCycle(
      { bpm, timeSignature, measuresCount, referencePitch, listeningMode, outputDeviceId: selectedOutputDeviceId },
      () => { setRecordedPCM(recorder.stop()); setIsCycleActive(false); },
      cycleStartTime
    );
  }, [engine, recorder, isCycleActive, selectedDeviceId, selectedOutputDeviceId, bpm, timeSignature, measuresCount, referencePitch, listeningMode, beatsPerMeasure, beatDuration]);

  const handlePackReady = useCallback((pack: VocalPackExport) => {
    if (!recordedPCM) return;
    const cleanPCM = createPaddedPreviewBuffer(recordedPCM, recordedSampleRate, totalDurationSec, 0, totalDurationSec, 0, true, true);
    const pitchCurve = extractContinuousPitchCurve(cleanPCM, { sampleRate: recordedSampleRate, totalDurationSec, trimStartSec: 0, trimEndSec: totalDurationSec });
    const quantized = quantizePitchToSteps({ pitchCurve, bpm, beatsPerMeasure, measuresCount, beatResolutions, trimStartSec: 0, trimEndSec: totalDurationSec, pcm: cleanPCM, sampleRate: recordedSampleRate });
    const allSteps = [...quantized.anacrusisSteps, ...quantized.gridSteps];
    setMelodicData({ pitchCurve, allSteps, pack, cleanPCM });
    setActiveLivret('melodia');
  }, [recordedPCM, recordedSampleRate, totalDurationSec, bpm, beatsPerMeasure, measuresCount, beatResolutions]);

  return (
    <div className="flex flex-col gap-3 max-w-2xl mx-auto w-full">
      {melodicData && (
        <div className="flex items-center justify-center gap-2 border-b border-theme-border/40 pb-2">
          <button type="button" onClick={() => setActiveLivret('prise')} className={`px-3 py-1 text-xs font-mono rounded-lg transition-all ${activeLivret === 'prise' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' : 'text-theme-ink/60 hover:text-theme-ink'}`}>
            🎙️ Livret 1 : Prise
          </button>
          <button type="button" onClick={() => setActiveLivret('melodia')} className={`px-3 py-1 text-xs font-mono rounded-lg transition-all ${activeLivret === 'melodia' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' : 'text-theme-ink/60 hover:text-theme-ink'}`}>
            🎵 Livret 2 : Melodia & Letra
          </button>
        </div>
      )}

      {activeLivret === 'melodia' && melodicData ? (
        <LivretMelodia
          initialPack={melodicData.pack} cleanPCM={melodicData.cleanPCM} sampleRate={recordedSampleRate}
          totalDurationSec={totalDurationSec} anacrusisDurationSec={anacrusisDurationSec} beatsPerMeasure={beatsPerMeasure}
          measuresCount={measuresCount} pitchCurve={melodicData.pitchCurve} initialSteps={melodicData.allSteps}
          outputDeviceId={selectedOutputDeviceId} onBackToPrise={() => setActiveLivret('prise')}
          onPackUpdated={(p) => setMelodicData((prev) => (prev ? { ...prev, pack: p } : null))}
        />
      ) : (
        <>
          <PendulumVisualizer engine={engine} isActive={isCycleActive} measuresCount={measuresCount} beatsPerMeasure={beatsPerMeasure} />
          {recordedPCM ? (
            <WaveformTrimEditor
              rawPCM={recordedPCM} sampleRate={recordedSampleRate} bpm={bpm} timeSignature={timeSignature}
              measuresCount={measuresCount} beatsPerMeasure={beatsPerMeasure} beatResolutions={beatResolutions}
              referencePitch={referencePitch} outputDeviceId={selectedOutputDeviceId}
              onReset={() => { setRecordedPCM(null); setMelodicData(null); }}
              onPackReady={handlePackReady}
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              <CalibrationBanner inputDeviceId={selectedDeviceId} outputDeviceId={selectedOutputDeviceId} sampleRate={recordedSampleRate} onCalibrationComplete={() => {}} disabled={isCycleActive} />
              <RecordActionButton isCycleActive={isCycleActive} measuresCount={measuresCount} onToggleRecord={handleToggleRecord} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <MetricConfigPanel timeSignature={timeSignature} onTimeSignatureChange={setTimeSignature} bpm={bpm} onBpmChange={setBpm} measuresCount={measuresCount} onMeasuresCountChange={setMeasuresCount} beatResolutions={beatResolutions} onBeatResolutionsChange={setBeatResolutions} disabled={isCycleActive} />
                <div className="flex flex-col gap-3">
                  <ListeningModePanel listeningMode={listeningMode} onListeningModeChange={setListeningMode} referencePitch={referencePitch} onReferencePitchChange={setReferencePitch} onPlayReferencePreview={() => engine.playReferencePitchPreview(referencePitch, 1.5, selectedOutputDeviceId)} disabled={isCycleActive} />
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
