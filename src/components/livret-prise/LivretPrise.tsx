/**
 * LivretPrise.tsx
 * Conteneur du Livret 1 (Prise & Balancier) avec navigation Livret 1/2,
 * grille 3 colonnes Desktop parfaitement alignée horizontalement et support bilingue.
 */
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
import { useLanguage } from '../../i18n/LanguageContext';
import type { TimeSignatureString, VocalPackExport, PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';

export const LivretPrise: React.FC = () => {
  const { t } = useLanguage();
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
  const [melodicData, setMelodicData] = useState<{ pitchCurve: PitchCurvePoint[]; allSteps: VocalStepData[]; pack: VocalPackExport; cleanPCM: Float32Array } | null>(null);

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
    await new Promise((r) => setTimeout(r, 180));

    const countdownSec = beatsPerMeasure * beatDuration;
    const singingSec = (1 + measuresCount) * beatsPerMeasure * beatDuration;
    const cycleStart = ctx.currentTime + 0.08;
    const anacrusisStart = cycleStart + countdownSec;
    const sig = buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, sampleRate);
    const captureStart = anacrusisStart - (getSavedLatencyOffsetMs(sig) / 1000);

    recorder.start(captureStart, singingSec);
    setIsCycleActive(true);
    await engine.startCycle(
      { bpm, timeSignature, measuresCount, referencePitch, listeningMode, outputDeviceId: selectedOutputDeviceId },
      () => { setRecordedPCM(recorder.stop()); setIsCycleActive(false); }, cycleStart
    );
  }, [engine, recorder, isCycleActive, selectedDeviceId, selectedOutputDeviceId, bpm, timeSignature, measuresCount, referencePitch, listeningMode, beatsPerMeasure, beatDuration]);

  const handlePackReady = useCallback((pack: VocalPackExport) => {
    if (!recordedPCM) return;
    const cleanPCM = createPaddedPreviewBuffer(recordedPCM, recordedSampleRate, totalDurationSec, 0, totalDurationSec, 0, true, true);
    const pitchCurve = extractContinuousPitchCurve(cleanPCM, { sampleRate: recordedSampleRate, totalDurationSec, trimStartSec: 0, trimEndSec: totalDurationSec });
    const q = quantizePitchToSteps({ pitchCurve, bpm, beatsPerMeasure, measuresCount, beatResolutions, trimStartSec: 0, trimEndSec: totalDurationSec, pcm: cleanPCM, sampleRate: recordedSampleRate });
    setMelodicData({ pitchCurve, allSteps: [...q.anacrusisSteps, ...q.gridSteps], pack, cleanPCM });
    setActiveLivret('melodia');
  }, [recordedPCM, recordedSampleRate, totalDurationSec, bpm, beatsPerMeasure, measuresCount, beatResolutions]);

  return (
    <div className="flex flex-col gap-3.5 w-full max-w-none">
      {melodicData && (
        <div className="flex items-center justify-center gap-2 border-b border-theme-border/40 pb-2">
          <button type="button" onClick={() => setActiveLivret('prise')} className={`px-3 py-1 text-xs font-mono rounded-lg transition-all ${activeLivret === 'prise' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' : 'text-theme-ink/60 hover:text-theme-ink'}`}>
            {t('tabLivret1')}
          </button>
          <button type="button" onClick={() => setActiveLivret('melodia')} className={`px-3 py-1 text-xs font-mono rounded-lg transition-all ${activeLivret === 'melodia' ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' : 'text-theme-ink/60 hover:text-theme-ink'}`}>
            {t('tabLivret2')}
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
              onReset={() => { setRecordedPCM(null); setMelodicData(null); }} onPackReady={handlePackReady}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <RecordActionButton isCycleActive={isCycleActive} measuresCount={measuresCount} onToggleRecord={handleToggleRecord} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch pt-1">
                <MetricConfigPanel timeSignature={timeSignature} onTimeSignatureChange={setTimeSignature} bpm={bpm} onBpmChange={setBpm} measuresCount={measuresCount} onMeasuresCountChange={setMeasuresCount} beatResolutions={beatResolutions} onBeatResolutionsChange={setBeatResolutions} disabled={isCycleActive} />
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
