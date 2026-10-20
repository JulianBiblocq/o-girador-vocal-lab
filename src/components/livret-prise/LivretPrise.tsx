/**
 * LivretPrise.tsx
 * Livret 1 : Prise vocale calée en haut, Bibliothèque & Conducteur regroupés avec réglages métriques (< 125 lignes).
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { TimeSignatureString } from '../../types/vocalPack.types';
import type { TessituraRange } from '../../types/tessitura.types';
import { DEFAULT_TESSITURA } from '../../types/tessitura.types';
import { MetronomeEngine, type ListeningMode } from '../../audio/MetronomeEngine';
import { VocalRecorderEngine } from '../../audio/VocalRecorderEngine';
import { closeSharedAudioContext } from '../../audio/sharedAudioContext';
import { LivretTabsBar } from './LivretTabsBar';
import { PriseRecordingSection } from './PriseRecordingSection';
import { PatternLibraryBar } from '../conductor/PatternLibraryBar';
import { ToadaConductorStrip } from '../conductor/ToadaConductorStrip';
import { PriseConfigGrid } from './PriseConfigGrid';
import { LivretMelodia } from '../livret-melodia/LivretMelodia';
import { LivretTreino } from '../livret-treino/LivretTreino';
import { PatternLyricsBanner } from './PatternLyricsBanner';
import { MasterTakeSlicerModal } from '../slicer/MasterTakeSlicerModal';
import { usePriseRecorder } from './usePriseRecorder';
import { useLivretMelodicInit, type MelodicData } from './useLivretMelodicInit';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { confirmAsync } from '../../stores/useCordelDialogStore';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { getBeatsPerMeasure, transposePitchNote } from '../../utils/musicalMath';
import { getDefaultBeatResolutions } from '../../utils/alignmentMath';
import { getPatternT1OffsetSec, getPatternTotalDurationSec } from '../../utils/anacrusisTimingHelper';
import { decodeAudioFile } from '../../utils/directAudioImporter';

export const LivretPrise: React.FC = () => {
  const {
    project, activePattern, activeVariant, updatePattern, updateVariant, cueMode, getPreviousConductorPattern,
    updateScopedBpm, updateScopedMeasuresCount, updateScopedHasAnacrusis, updateScopedReferencePitch, updateScopedTimeSignature, updateScopedTessitura,
  } = useToadaProject();
  const { t } = useLanguage();
  const engine = useMemo(() => new MetronomeEngine(), []);
  const recorder = useMemo(() => new VocalRecorderEngine(), []);
  const { activeLivret, setActiveLivret, viewRoleMode } = useVocalTransportStore();

  const [selectedDeviceId, setSelectedDeviceId] = useState(''), [selectedOutputDeviceId, setSelectedOutputDeviceId] = useState('');
  const [timeSignature, setTimeSignature] = useState<TimeSignatureString>(project.timeSignature);
  const [bpm, setBpm] = useState(activePattern.baseBpm ?? project.bpm ?? 55);
  const [referencePitch, setReferencePitch] = useState(activePattern.referencePitch ?? 'C4');
  const [beatResolutions, setBeatResolutions] = useState<number[]>(() => getDefaultBeatResolutions('4/4'));
  const [listeningMode, setListeningMode] = useState<ListeningMode>('headphones');
  const [recordedSampleRate, setRecordedSampleRate] = useState(44100);
  const [melodicData, setMelodicData] = useState<MelodicData | null>(null);
  const [isSlicerOpen, setIsSlicerOpen] = useState(false);

  useEffect(() => { setBpm(activePattern.baseBpm ?? project.bpm ?? 55); setReferencePitch(activePattern.referencePitch ?? 'C4'); }, [activePattern.id]);
  useEffect(() => () => { engine.stop(); recorder.cleanup(); closeSharedAudioContext(); }, [engine, recorder]);

  const measuresCount = activePattern.measuresCount, recordedPCM = activeVariant.recordingResult?.pcm ?? null;
  const beatsPerMeasure = getBeatsPerMeasure(timeSignature), effectiveBpm = Math.max(30, Math.round(bpm * activeVariant.speedRatio));
  const effectivePitch = useMemo(() => transposePitchNote(referencePitch, activeVariant.pitchShiftSemitones), [referencePitch, activeVariant.pitchShiftSemitones]);
  const hasAnacrusis = activePattern.hasAnacrusis !== false, beatDuration = 60 / effectiveBpm;
  const measureDurationSec = beatsPerMeasure * beatDuration;
  const t1OffsetSec = getPatternT1OffsetSec(hasAnacrusis, measureDurationSec);
  const totalDurationSec = getPatternTotalDurationSec(hasAnacrusis, measuresCount, measureDurationSec, 0.25);
  const anacrusisDurationSec = t1OffsetSec;

  const { isCycleActive, handleToggleRecord } = usePriseRecorder({
    engine, recorder, activePattern, activeVariant, cueMode, getPreviousConductorPattern, projectPatterns: project.patterns,
    timeSignature, measuresCount, hasAnacrusis, beatsPerMeasure, beatDuration, effectiveBpm, effectivePitch,
    listeningMode, selectedDeviceId, selectedOutputDeviceId, updateVariant, recordedSampleRate, setRecordedSampleRate, activeLivret,
    harmonyConfig: project.harmonyConfig,
  });

  const { handlePackReady, handleRecalculatePitch } = useLivretMelodicInit({
    recordedPCM, recordedSampleRate, totalDurationSec, effectiveBpm, beatsPerMeasure, measuresCount, beatResolutions,
    hasAnacrusis, t1OffsetSec, activePattern, activeVariant, updatePattern, setActiveLivret, setMelodicData,
  });

  const handleResetRecording = useCallback(async () => {
    const ok = await confirmAsync({ title: t('resetRecordingTitle'), message: t('resetRecordingConfirm'), confirmLabel: t('dialogConfirm'), cancelLabel: t('dialogCancel'), variant: 'warning' });
    if (ok) updateVariant(activePattern.id, activeVariant.variantKey, { recordingResult: null });
  }, [t, updateVariant, activePattern.id, activeVariant.variantKey]);

  const handleDirectImportAudio = useCallback(async (f: File) => {
    const res = await decodeAudioFile(f);
    updateVariant(activePattern.id, activeVariant.variantKey, { recordingResult: { pcm: res.pcm, sampleRate: res.sampleRate }, trimStartSec: 0, trimEndSec: Math.min(totalDurationSec, res.durationSec) });
    setRecordedSampleRate(res.sampleRate);
  }, [activePattern.id, activeVariant.variantKey, totalDurationSec, updateVariant]);

  const handleTessituraChange = useCallback((newTessitura: TessituraRange) => {
    updatePattern(activePattern.id, { tessitura: newTessitura });
    updateScopedTessitura(newTessitura);
    if (recordedPCM) handleRecalculatePitch(newTessitura);
  }, [activePattern.id, updatePattern, updateScopedTessitura, recordedPCM, handleRecalculatePitch]);

  return (
    <div className="flex flex-col gap-3.5 w-full max-w-none">
      {viewRoleMode !== 'eleve' && (
        <LivretTabsBar activeLivret={activeLivret} onSelectLivret={setActiveLivret} canAccessMelodia={!!melodicData || !!activePattern.pack} />
      )}
      {activeLivret === 'treino' ? <LivretTreino /> : activeLivret === 'melodia' && (melodicData || activePattern.pack) ? (
        <LivretMelodia
          initialPack={melodicData?.pack ?? activePattern.pack!} cleanPCM={melodicData?.cleanPCM ?? recordedPCM ?? new Float32Array(0)}
          sampleRate={recordedSampleRate} totalDurationSec={totalDurationSec} anacrusisDurationSec={anacrusisDurationSec} beatsPerMeasure={beatsPerMeasure} measuresCount={measuresCount} pitchCurve={melodicData?.pitchCurve ?? []}
          initialSteps={melodicData?.allSteps ?? [...(activePattern.anacrusisSteps || []), ...(activePattern.mainSteps || [])]} outputDeviceId={selectedOutputDeviceId} pitchShiftSemitones={activeVariant.pitchShiftSemitones} onBackToPrise={() => setActiveLivret('prise')}
          onPackUpdated={(p) => { setMelodicData((prev) => (prev ? { ...prev, pack: p } : null)); updatePattern(activePattern.id, { pack: p }); }}
        />
      ) : (
        <>
          <PriseRecordingSection
            engine={engine} isCycleActive={isCycleActive} bpm={bpm} effectiveBpm={effectiveBpm}
            timeSignature={timeSignature} measuresCount={measuresCount} beatsPerMeasure={beatsPerMeasure}
            beatResolutions={beatResolutions} referencePitch={referencePitch} effectivePitch={effectivePitch} selectedOutputDeviceId={selectedOutputDeviceId} recordedPCM={recordedPCM} recordedSampleRate={recordedSampleRate} activeVariant={activeVariant}
            hasAnacrusis={hasAnacrusis}
            onToggleRecord={handleToggleRecord} onTrimChange={(s, e) => updateVariant(activePattern.id, activeVariant.variantKey, { trimStartSec: s, trimEndSec: e })} onPackReady={handlePackReady} onResetRecording={handleResetRecording}
            onOpenSlicerModal={() => setIsSlicerOpen(true)} onDirectImportAudio={handleDirectImportAudio}
          />
          <PatternLyricsBanner />
          <div className="w-full grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch pt-1">
            <div className="xl:col-span-5 h-full"><PatternLibraryBar /></div> <div className="xl:col-span-7 h-full"><ToadaConductorStrip /></div>
          </div>
          <PriseConfigGrid
            timeSignature={timeSignature} onTimeSignatureChange={(ts) => { setTimeSignature(ts); updateScopedTimeSignature(ts); }}
            bpm={bpm} onBpmChange={(v) => { setBpm(v); updateScopedBpm(v); }}
            measuresCount={measuresCount} onMeasuresCountChange={(c) => updateScopedMeasuresCount(c as 1|2|3|4)}
            beatResolutions={beatResolutions} onBeatResolutionsChange={setBeatResolutions}
            hasAnacrusis={hasAnacrusis} onHasAnacrusisChange={(has) => updateScopedHasAnacrusis(has)}
            listeningMode={listeningMode} onListeningModeChange={setListeningMode}
            referencePitch={referencePitch} effectivePitch={effectivePitch} onReferencePitchChange={(p) => { setReferencePitch(p); updateScopedReferencePitch(p); }}
            tessitura={activePattern.tessitura ?? DEFAULT_TESSITURA} onTessituraChange={handleTessituraChange} onRecalculatePitch={() => handleRecalculatePitch()} hasRecording={!!recordedPCM}
            engine={engine} selectedDeviceId={selectedDeviceId} onSelectedDeviceChange={setSelectedDeviceId} selectedOutputDeviceId={selectedOutputDeviceId} onSelectedOutputDeviceChange={setSelectedOutputDeviceId} recordedSampleRate={recordedSampleRate} isCycleActive={isCycleActive}
          />
        </>
      )}
      <MasterTakeSlicerModal isOpen={isSlicerOpen} onClose={() => setIsSlicerOpen(false)} />
    </div>
  );
};
