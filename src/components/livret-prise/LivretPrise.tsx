/**
 * LivretPrise.tsx
 * Livret 2 : Cabine d'enregistrement avec mode pattern & prise continue sur le Conducteur (< 145 lignes).
 */
import React, { useMemo, useCallback } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { confirmAsync } from '../../stores/useCordelDialogStore';
import { PatternCompassBar } from '../common/PatternCompassBar';
import { LatencyReminderBanner } from '../common/LatencyReminderBanner';
import { StudioSettingsStatusBar } from './StudioSettingsStatusBar';
import { PatternLyricsBanner } from './PatternLyricsBanner';
import { ChordGridBar } from '../common/ChordGridBar';
import { PendulumVisualizer } from '../PendulumVisualizer';
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
  const {
    project, activePattern, activeVariant, updatePattern, updateVariant,
    cueMode, getPreviousConductorPattern, updateHarmonyConfig, loadProject,
  } = useToadaProject();
  const {
    engine, recorder, selectedDeviceId, selectedOutputDeviceId,
    listeningMode, recordedSampleRate, setRecordedSampleRate,
  } = useAudioHardware();
  const { t } = useLanguage();
  const { activeLivret, setActiveLivret } = useVocalTransportStore();

  const bpm = activePattern.bpm ?? activePattern.baseBpm ?? project.bpm ?? 88;
  const referencePitch = activePattern.referencePitch ?? 'C4';
  const timeSignature = project.timeSignature;
  const measuresCount = activePattern.measuresCount;
  const hasAnacrusis = activePattern.hasAnacrusis !== false;
  const beatsPerMeasure = getBeatsPerMeasure(timeSignature);
  const effectiveBpm = Math.max(30, Math.round(bpm * activeVariant.speedRatio));
  const effectivePitch = useMemo(() => transposePitchNote(referencePitch, activeVariant.pitchShiftSemitones), [referencePitch, activeVariant.pitchShiftSemitones]);
  const beatDuration = 60 / effectiveBpm;

  const { isCycleActive, handleToggleRecord } = usePriseRecorder({
    engine, recorder, activePattern, activeVariant, cueMode, getPreviousConductorPattern,
    projectPatterns: project.patterns, timeSignature, measuresCount, hasAnacrusis,
    beatsPerMeasure, beatDuration, effectiveBpm, effectivePitch, listeningMode,
    selectedDeviceId, selectedOutputDeviceId, updateVariant, updatePattern, recordedSampleRate,
    setRecordedSampleRate, activeLivret, harmonyConfig: project.harmonyConfig,
  });

  const {
    takeMode, setTakeMode, isContinuousActive, prompterInfo, handleToggleContinuous,
  } = useContinuousTakeController({
    project, loadProject, engine, recorder, listeningMode,
    selectedDeviceId, selectedOutputDeviceId, activeLivret,
  });

  const isRecordingAny = isCycleActive || isContinuousActive;
  const hasRecording = activeVariant.recordingResult !== null && activeVariant.recordingResult.pcm.length > 0;
  const recordedCount = Object.values(activePattern.variants || {}).filter((v) => v.recordingResult !== null).length;
  const isMainVariant = activeVariant.speedRatio === 1.0 && activeVariant.pitchShiftSemitones === 0;

  const handleReset = useCallback(async () => {
    const ok = await confirmAsync({
      title: t('resetRecordingTitle'), message: t('resetRecordingConfirm'),
      confirmLabel: t('dialogConfirm'), cancelLabel: t('dialogCancel'), variant: 'warning',
    });
    if (ok) updateVariant(activePattern.id, activeVariant.variantKey, { recordingResult: null });
  }, [t, updateVariant, activePattern.id, activeVariant.variantKey]);

  return (
    <div className="flex flex-col gap-3 w-full">
      <LatencyReminderBanner />
      <TakeModeSelector mode={takeMode} onChangeMode={setTakeMode} disabled={isRecordingAny} />
      {takeMode !== 'pattern' && <ContinuousPrompterBanner info={prompterInfo} isActive={isContinuousActive} />}
      <PatternCompassBar />
      <StudioSettingsStatusBar />

      <div className="flex flex-col gap-2">
        <PatternLyricsBanner />
        <div className="cordel-card p-1.5 rounded">
          <ChordGridBar
            harmonyGrid={activePattern.harmonyGrid}
            measuresCount={measuresCount}
            beatsPerMeasure={beatsPerMeasure}
            hasAnacrusis={hasAnacrusis}
            onUpdateGrid={(g) => updatePattern(activePattern.id, { harmonyGrid: g })}
          />
        </div>
      </div>

      <PendulumVisualizer engine={engine} isActive={isRecordingAny} measuresCount={measuresCount} beatsPerMeasure={beatsPerMeasure}>
        <RecordActionButton
          isCycleActive={takeMode === 'pattern' ? isCycleActive : isContinuousActive}
          measuresCount={measuresCount}
          onToggleRecord={takeMode === 'pattern' ? handleToggleRecord : handleToggleContinuous}
        />
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-[var(--cordel-border-sub)]">
          <div className="flex-1 min-w-[200px]"><CuePatternSelector disabled={isRecordingAny} /></div>
          <div className="shrink-0"><HarmonyProfileSelector config={project.harmonyConfig ?? { enabled: true, profile: 'maracatu', volume: 0.7 }} onChange={updateHarmonyConfig} disabled={isRecordingAny} /></div>
        </div>
        {hasRecording && (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-[var(--cordel-border-sub)]">
            <button type="button" onClick={() => setActiveLivret('calage')} className="cordel-btn-primary px-3 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer">
              <Scissors className="w-3.5 h-3.5" /><span>{t('goToCalageBtn')}</span>
            </button>
            <button type="button" onClick={() => setActiveLivret('melodia')} className="cordel-btn px-3 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer">
              <Music className="w-3.5 h-3.5 text-theme-accent" /><span>{t('goToMelodiaBtn')}</span>
            </button>
            <button type="button" onClick={handleReset} className="cordel-card-sm px-2.5 py-1.5 text-[11px] font-mono text-red-500 hover:text-red-400 flex items-center gap-1 cursor-pointer">
              <RotateCcw className="w-3 h-3" /><span>{t('resetRecordingTitle')}</span>
            </button>
          </div>
        )}
      </PendulumVisualizer>

      <CordelAccordion
        title={t('grainPlayerAccordionTitle')}
        summaryBadge={t('grainPlayerAccordionSummary', { recorded: recordedCount, active: isMainVariant ? 'Principale' : `${Math.round(activeVariant.speedRatio * 100)}% / ${activeVariant.pitchShiftSemitones}st` })}
        storageKey={`variants_${activePattern.id}`}
        defaultOpen={false}
      >
        <PatternVariantSelector baseBpm={bpm} referencePitch={referencePitch} disabled={isRecordingAny} onPlayPitchPreview={(p) => engine.playReferencePitchPreview(p, 1.5, selectedOutputDeviceId)} />
      </CordelAccordion>
    </div>
  );
};
