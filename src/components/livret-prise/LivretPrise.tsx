/**
 * LivretPrise.tsx
 * Livret 2 : Cabine d'enregistrement autour de « A Fita — Cabine » + tiroir d'options avancées (< 120 lignes).
 */
import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { RotateCcw, Scissors, Music } from 'lucide-react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { confirmAsync } from '../../stores/useCordelDialogStore';
import { AFitaFrame } from '../fita/AFitaFrame';
import { CabineMonitoringAndPunchBar } from './CabineMonitoringAndPunchBar';
import type { ComfortMonitoringPreset } from '../../audio/ComfortMonitoringNode';
import { getActiveBackingTrack, subscribeBackingTrack } from '../../utils/backingTrackStorage';
import { CabineTimelineRibbon } from './CabineTimelineRibbon';
import { RecordActionButton } from './RecordActionButton';
import { CuePatternSelector } from './CuePatternSelector';
import { CordelAccordion } from '../common/CordelAccordion';
import { PatternVariantSelector } from './PatternVariantSelector';
import { TakeModeSelector } from './TakeModeSelector';
import { ContinuousPrompterBanner } from './ContinuousPrompterBanner';
import { useContinuousTakeController } from './useContinuousTakeController';
import { usePriseRecorder } from './usePriseRecorder';
import { getBeatsPerMeasure, transposePitchNote } from '../../utils/musicalMath';

export const LivretPrise: React.FC = () => {
  const { project, activePattern, activeVariant, updatePattern, updateVariant, updatePatternAndVariant, cueMode, getPreviousConductorPattern, loadProject } = useToadaProject();
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

  const { isCycleActive, handleToggleRecord, peakDb, registerPeakListener, hasClipped, resetClipIndicator } = usePriseRecorder({
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

  const handleReset = useCallback(async () => {
    const ok = await confirmAsync({ title: t('resetRecordingTitle'), message: t('resetRecordingConfirm'), confirmLabel: t('dialogConfirm'), cancelLabel: t('dialogCancel'), variant: 'warning' });
    if (ok) updateVariant(activePattern.id, activeVariant.variantKey, { recordingResult: null });
  }, [t, updateVariant, activePattern.id, activeVariant.variantKey]);

  return (
    <div className="flex flex-col gap-5 w-full max-w-5xl mx-auto my-2">
      <TakeModeSelector mode={takeMode} onChangeMode={setTakeMode} disabled={isRecordingAny} />
      {takeMode !== 'pattern' && <ContinuousPrompterBanner info={prompterInfo} isActive={isContinuousActive} />}

      <AFitaFrame title={t('fitaTitleCabine')} isSpinning={isRecordingAny} showPatternNav={takeMode === 'pattern'}>
        <CabineTimelineRibbon
          frameless engine={engine} isActive={isRecordingAny} takeMode={takeMode} project={project} activePattern={activePattern}
          cuePattern={effectiveCuePattern} beatsPerMeasure={beatsPerMeasure} isPunchIn={Boolean(punchMeasureIndex && punchMeasureIndex >= 1 && hasRecording)}
          counterRoleCueEnabled={counterRoleCueEnabled} onToggleCounterRoleCue={() => setCounterRoleCueEnabled((v) => !v)} getContinuousLiveStatus={getContinuousLiveStatus}
        >
          <RecordActionButton isCycleActive={takeMode === 'pattern' ? isCycleActive : isContinuousActive} measuresCount={measuresCount} onToggleRecord={takeMode === 'pattern' ? handleToggleRecord : handleToggleContinuous} />
          {hasRecording && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-[var(--cordel-border-sub)]">
              <button type="button" onClick={() => setActiveLivret('calage')} className="cordel-btn-primary px-3 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"><Scissors className="w-3.5 h-3.5" /><span>{t('fanion3Short')}</span></button>
              <button type="button" onClick={() => setActiveLivret('melodia')} className="cordel-btn px-3 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"><Music className="w-3.5 h-3.5 text-theme-accent" /><span>{t('fanion4Short')}</span></button>
              <button type="button" onClick={handleReset} className="cordel-card-sm px-2.5 py-1.5 text-[11px] font-mono text-red-600 dark:text-red-400 flex items-center gap-1 cursor-pointer"><RotateCcw className="w-3 h-3" /><span>{t('resetRecordingTitle')}</span></button>
            </div>
          )}
        </CabineTimelineRibbon>
      </AFitaFrame>

      <CordelAccordion title={t('drawerCabineAdvancedTitle')} summaryBadge={`${recordedCount} var.`} defaultOpen={false}>
        <div className="flex flex-col gap-3 pt-2">
          <CabineMonitoringAndPunchBar
            listeningMode={listeningMode} comfortPreset={comfortPreset} comfortMix={comfortMix}
            onChangeComfortPreset={setComfortPreset} onChangeComfortMix={setComfortMix}
            hasBackingTrack={hasBackingTrack} backingInHeadphones={backingInHeadphones} onToggleBackingInHeadphones={() => setBackingInHeadphones((v) => !v)}
            measuresCount={measuresCount} hasRecording={hasRecording} punchMeasureIndex={punchMeasureIndex} onChangePunchMeasureIndex={setPunchMeasureIndex}
            peakDb={peakDb} registerPeakListener={registerPeakListener} hasClipped={hasClipped} onResetClipIndicator={resetClipIndicator} disabled={isRecordingAny}
          />
          <CuePatternSelector disabled={isRecordingAny} />
          <PatternVariantSelector baseBpm={bpm} referencePitch={referencePitch} disabled={isRecordingAny} onPlayPitchPreview={(p) => engine.playReferencePitchPreview(p, 1.5, selectedOutputDeviceId)} />
        </div>
      </CordelAccordion>
    </div>
  );
};
