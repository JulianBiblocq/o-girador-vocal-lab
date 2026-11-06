/**
 * LivretPrise.tsx
 * Livret 2 : Cabine d'enregistrement avec Retour Confort, Mémoire de Crête (-0.5 dBFS), Baque casque & Punch-in (< 140 lignes).
 */
import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { confirmAsync } from '../../stores/useCordelDialogStore';
import { PatternCompassBar } from '../common/PatternCompassBar';
import { PreTakeSetupAssistantBar } from '../prise/PreTakeSetupAssistantBar';
import { StudioSettingsStatusBar } from './StudioSettingsStatusBar';
import { CabineMonitoringAndPunchBar } from './CabineMonitoringAndPunchBar';
import type { ComfortMonitoringPreset } from '../../audio/ComfortMonitoringNode';
import { getActiveBackingTrack, subscribeBackingTrack } from '../../utils/backingTrackStorage';
import { PatternLyricsBanner } from './PatternLyricsBanner';
import { ChordGridBar } from '../common/ChordGridBar';
import { CabineTimelineRibbon } from './CabineTimelineRibbon';
import { RecordActionButton } from './RecordActionButton';
import { CuePatternSelector } from './CuePatternSelector';
import { HarmonyProfileSelector } from '../common/HarmonyProfileSelector';
import { CordelAccordion } from '../common/CordelAccordion';
import { PatternVariantSelector } from './PatternVariantSelector';
import { TakeModeSelector } from './TakeModeSelector';
import { ContinuousPrompterBanner } from './ContinuousPrompterBanner';
import { useContinuousTakeController } from './useContinuousTakeController';
import { usePriseRecorder } from './usePriseRecorder';
import { getBeatsPerMeasure, transposePitchNote } from '../../utils/musicalMath';
import { RotateCcw, Scissors, Music } from 'lucide-react';

export const LivretPrise: React.FC = () => {
  const { project, activePattern, activeVariant, updatePattern, updateVariant, updatePatternAndVariant, cueMode, getPreviousConductorPattern, updateHarmonyConfig, loadProject } = useToadaProject();
  const { engine, recorder, selectedDeviceId, selectedOutputDeviceId, listeningMode, recordedSampleRate, setRecordedSampleRate } = useAudioHardware();
  const { t } = useLanguage();
  const activeLivret = useVocalTransportStore((s) => s.activeLivret), setActiveLivret = useVocalTransportStore((s) => s.setActiveLivret);

  const [comfortPreset, setComfortPreset] = useState<ComfortMonitoringPreset>('off');
  const [comfortMix, setComfortMix] = useState<number>(0.35);
  const [backingInHeadphones, setBackingInHeadphones] = useState<boolean>(true);
  const [punchMeasureIndex, setPunchMeasureIndex] = useState<number | null>(null);
  const [hasBackingTrack, setHasBackingTrack] = useState<boolean>(() => Boolean(getActiveBackingTrack(project.id)?.enabled));

  useEffect(() => {
    setHasBackingTrack(Boolean(getActiveBackingTrack(project.id)?.enabled));
    return subscribeBackingTrack(() => setHasBackingTrack(Boolean(getActiveBackingTrack(project.id)?.enabled)));
  }, [project.id]);
  useEffect(() => { setPunchMeasureIndex(null); }, [activePattern.id]);

  const bpm = activePattern.bpm ?? activePattern.baseBpm ?? project.bpm ?? 88, referencePitch = activePattern.referencePitch ?? 'C4';
  const timeSignature = project.timeSignature, measuresCount = activePattern.measuresCount, hasAnacrusis = activePattern.hasAnacrusis !== false;
  const beatsPerMeasure = getBeatsPerMeasure(timeSignature), effectiveBpm = Math.max(30, Math.round(bpm * activeVariant.speedRatio));
  const effectivePitch = useMemo(() => transposePitchNote(referencePitch, activeVariant.pitchShiftSemitones), [referencePitch, activeVariant.pitchShiftSemitones]);
  const beatDuration = 60 / effectiveBpm;

  const { isCycleActive, handleToggleRecord, peakDb, hasClipped, resetClipIndicator } = usePriseRecorder({
    engine, recorder, activePattern, activeVariant, cueMode, getPreviousConductorPattern,
    projectPatterns: project.patterns, timeSignature, measuresCount, hasAnacrusis,
    beatsPerMeasure, beatDuration, effectiveBpm, effectivePitch, listeningMode,
    selectedDeviceId, selectedOutputDeviceId, updateVariant, updatePattern, updatePatternAndVariant, recordedSampleRate,
    setRecordedSampleRate, activeLivret, harmonyConfig: project.harmonyConfig,
    comfortPreset, comfortMix, backingInHeadphones, punchMeasureIndex,
  });

  const { takeMode, setTakeMode, isContinuousActive, prompterInfo, counterRoleCueEnabled, setCounterRoleCueEnabled, getContinuousLiveStatus, handleToggleContinuous } = useContinuousTakeController({
    project, loadProject, engine, recorder, listeningMode, selectedDeviceId, selectedOutputDeviceId, activeLivret,
  });

  const effectiveCuePattern = useMemo(
    () => (cueMode === 'none' ? null : cueMode === 'auto_previous' ? getPreviousConductorPattern() : project.patterns.find((p) => p.id === cueMode) ?? null),
    [cueMode, getPreviousConductorPattern, project.patterns]
  );

  const isRecordingAny = isCycleActive || isContinuousActive;
  const hasRecording = activeVariant.recordingResult !== null && activeVariant.recordingResult.pcm.length > 0;
  const recordedCount = Object.values(activePattern.variants || {}).filter((v) => v.recordingResult !== null).length;
  const isMainVariant = activeVariant.speedRatio === 1.0 && activeVariant.pitchShiftSemitones === 0;

  const handleReset = useCallback(async () => {
    const ok = await confirmAsync({ title: t('resetRecordingTitle'), message: t('resetRecordingConfirm'), confirmLabel: t('dialogConfirm'), cancelLabel: t('dialogCancel'), variant: 'warning' });
    if (ok) updateVariant(activePattern.id, activeVariant.variantKey, { recordingResult: null });
  }, [t, updateVariant, activePattern.id, activeVariant.variantKey]);

  return (
    <div className="flex flex-col gap-3 w-full">
      <PreTakeSetupAssistantBar />
      <TakeModeSelector mode={takeMode} onChangeMode={setTakeMode} disabled={isRecordingAny} />
      {takeMode !== 'pattern' && <ContinuousPrompterBanner info={prompterInfo} isActive={isContinuousActive} />}
      <PatternCompassBar />
      <StudioSettingsStatusBar />
      <CabineMonitoringAndPunchBar
        listeningMode={listeningMode} comfortPreset={comfortPreset} comfortMix={comfortMix}
        onChangeComfortPreset={setComfortPreset} onChangeComfortMix={setComfortMix}
        hasBackingTrack={hasBackingTrack} backingInHeadphones={backingInHeadphones} onToggleBackingInHeadphones={() => setBackingInHeadphones((v) => !v)}
        measuresCount={measuresCount} hasRecording={hasRecording} punchMeasureIndex={punchMeasureIndex} onChangePunchMeasureIndex={setPunchMeasureIndex}
        peakDb={peakDb} hasClipped={hasClipped} onResetClipIndicator={resetClipIndicator} disabled={isRecordingAny}
      />

      <div className="flex flex-col gap-2">
        <PatternLyricsBanner />
        <div className="cordel-card p-1.5 rounded">
          <ChordGridBar harmonyGrid={activePattern.harmonyGrid} measuresCount={measuresCount} beatsPerMeasure={beatsPerMeasure} hasAnacrusis={hasAnacrusis} onUpdateGrid={(g) => updatePattern(activePattern.id, { harmonyGrid: g })} />
        </div>
      </div>

      <CabineTimelineRibbon
        engine={engine} isActive={isRecordingAny} takeMode={takeMode} project={project} activePattern={activePattern}
        cuePattern={effectiveCuePattern} beatsPerMeasure={beatsPerMeasure} isPunchIn={Boolean(punchMeasureIndex && punchMeasureIndex >= 1 && hasRecording)}
        counterRoleCueEnabled={counterRoleCueEnabled} onToggleCounterRoleCue={() => setCounterRoleCueEnabled((v) => !v)} getContinuousLiveStatus={getContinuousLiveStatus}
      >
        <RecordActionButton isCycleActive={takeMode === 'pattern' ? isCycleActive : isContinuousActive} measuresCount={measuresCount} onToggleRecord={takeMode === 'pattern' ? handleToggleRecord : handleToggleContinuous} />
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-[var(--cordel-border-sub)]">
          <div className="flex-1 min-w-[200px]"><CuePatternSelector disabled={isRecordingAny} /></div>
          <div className="shrink-0"><HarmonyProfileSelector config={project.harmonyConfig ?? { enabled: true, profile: 'maracatu', volume: 0.7 }} onChange={updateHarmonyConfig} disabled={isRecordingAny} /></div>
        </div>
        {hasRecording && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-[var(--cordel-border-sub)]">
            <button type="button" onClick={() => setActiveLivret('calage')} className="cordel-btn-primary px-3 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"><Scissors className="w-3.5 h-3.5" /><span>{t('goToCalageBtn')}</span></button>
            <button type="button" onClick={() => setActiveLivret('melodia')} className="cordel-btn px-3 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"><Music className="w-3.5 h-3.5 text-theme-accent" /><span>{t('goToMelodiaBtn')}</span></button>
            <button type="button" onClick={handleReset} className="cordel-card-sm px-2.5 py-1.5 text-[11px] font-mono text-red-500 hover:text-red-400 flex items-center gap-1 cursor-pointer"><RotateCcw className="w-3 h-3" /><span>{t('resetRecordingTitle')}</span></button>
          </div>
        )}
      </CabineTimelineRibbon>

      <CordelAccordion title={t('grainPlayerAccordionTitle')} summaryBadge={t('grainPlayerAccordionSummary', { recorded: recordedCount, active: isMainVariant ? t('variantMainLabel') : `${Math.round(activeVariant.speedRatio * 100)}% / ${activeVariant.pitchShiftSemitones}st` })} storageKey={`variants_${activePattern.id}`} defaultOpen={false}>
        <PatternVariantSelector baseBpm={bpm} referencePitch={referencePitch} disabled={isRecordingAny} onPlayPitchPreview={(p) => engine.playReferencePitchPreview(p, 1.5, selectedOutputDeviceId)} />
      </CordelAccordion>
    </div>
  );
};
