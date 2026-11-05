/**
 * LivretMelodiaWorkspace.tsx
 * Espace de travail principal du Livret 4 (Melodia, Piano Roll synchronisé, Melodyne & Syllabes) (< 135 lignes).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { PitchCurvePoint, VocalPackExport, VocalStepData } from '../../types/vocalPack.types';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useStepsHistory, type LivretMelodiaSnapshot } from '../../hooks/useStepsHistory';
import { useMelodyneAudioProcessor } from '../../hooks/useMelodyneAudioProcessor';
import { useLivretMelodiaPlayback } from './useLivretMelodiaPlayback';
import { quantizePitchToSteps } from '../../audio/pitchToStepsQuantizer';
import type { ScaleType } from '../../audio/scaleQuantizer';
import { applyLyricsSyllablesToSteps } from '../../utils/syllableAligner';
import { downloadToadaPackJson } from '../../utils/toadaPackExporter';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { PianoRollEditor } from './PianoRollEditor';
import { MelodyneControlsBar } from './MelodyneControlsBar';
import { MelodicControls } from './MelodicControls';
import { LetraEditorPanel } from './LetraEditorPanel';
import { MelodiaNextStepFooter } from './MelodiaNextStepFooter';
import { HarmonyProfileSelector } from '../common/HarmonyProfileSelector';
import { DEFAULT_HARMONY_CONFIG } from '../../types/harmony.types';
import { moveBrick, type PianoRollTool } from './pianoRollInteractions';
import { buildUpdatedVocalPackExport } from '../../audio/livretResetHelper';
import { useMelodiaActions } from './useMelodiaActions';
import { useLanguage } from '../../i18n/LanguageContext';

export interface LivretMelodiaWorkspaceProps {
  initialPack: VocalPackExport; cleanPCM?: Float32Array; sampleRate?: number; totalDurationSec?: number;
  anacrusisDurationSec?: number; beatsPerMeasure?: number; measuresCount?: number; pitchCurve?: PitchCurvePoint[];
  initialSteps?: VocalStepData[]; outputDeviceId?: string; pitchShiftSemitones?: number;
  onBackToPrise?: () => void; onPackUpdated?: (pack: VocalPackExport) => void;
}

export const LivretMelodiaWorkspace: React.FC<LivretMelodiaWorkspaceProps> = ({
  initialPack, cleanPCM, sampleRate = 44100, totalDurationSec = 4, anacrusisDurationSec = 0, beatsPerMeasure = 4,
  measuresCount = 2, pitchCurve = [], initialSteps, outputDeviceId, pitchShiftSemitones = 0, onBackToPrise, onPackUpdated,
}) => {
  const { t } = useLanguage(), { activePattern, updatePattern, project, updateHarmonyConfig } = useToadaProject();
  const [activeTool, setActiveTool] = useState<PianoRollTool>('pointer'), [selectedStepIdx, setSelectedStepIdx] = useState<number | null>(null);
  const [tonic, setTonic] = useState(() => initialPack.metadata.referencePitch?.replace(/\d+$/, '') || 'C');
  const [scaleType, setScaleType] = useState<ScaleType>('chromatic'), [smoothingLevel, setSmoothingLevel] = useState(0.5);

  const rawPCM = useMemo(() => activePattern.rawAudioSamples ?? cleanPCM ?? new Float32Array(0), [activePattern.rawAudioSamples, cleanPCM]);
  const rawPitchCurve = useMemo(() => activePattern.rawPitchCurve ?? pitchCurve, [activePattern.rawPitchCurve, pitchCurve]);
  const hasAnac = activePattern.hasAnacrusis !== false, resPerBeat = initialPack.metadata.beatResolutions?.[0] || 4;
  const anacLen = hasAnac ? beatsPerMeasure * resPerBeat : 0, t1OffsetSec = hasAnac ? beatsPerMeasure * (60 / (initialPack.metadata.bpm || 88)) : 0.15;
  const activePCM = activePattern.correctedAudioSamples ?? rawPCM, harmonyConfig = project.harmonyConfig ?? DEFAULT_HARMONY_CONFIG;
  const rawDefaultSteps = initialSteps ?? [...(activePattern.anacrusisSteps || []), ...(activePattern.mainSteps || [])];
  const expectedStepsCount = ((hasAnac ? beatsPerMeasure : 0) + measuresCount * beatsPerMeasure + 1) * resPerBeat;
  const defaultSteps = useMemo(() => {
    if (rawDefaultSteps.length >= expectedStepsCount || rawDefaultSteps.length === 0) return rawDefaultSteps;
    const missing = expectedStepsCount - rawDefaultSteps.length, stepDur = (60 / (initialPack.metadata.bpm || 88)) / resPerBeat;
    return [...rawDefaultSteps, ...Array.from({ length: missing }, (_, k) => ({ stepIndex: rawDefaultSteps.length + k, active: false, note: '', midiNumber: 0, velocity: 0, decay: stepDur }))];
  }, [rawDefaultSteps, expectedStepsCount, initialPack.metadata.bpm, resPerBeat]);

  const { regions, selectedRegionId, selectedRegion, displayedCurve, isProcessing, setSelectedRegionId, addRegion, addWholePhraseRegion, applyAutoSweetSpot, syncMovedBrickRegion, updateSelectedRegion, updateBounds, deleteSelected, clearAllRegions, restoreRegions } = useMelodyneAudioProcessor({
    initialRegions: activePattern.melodyneRegions || [], rawAudio: rawPCM, sampleRate, totalDurationSec, rawPitchCurve, allSteps: defaultSteps,
    onAudioUpdated: (pcm, updatedRegions) => updatePattern(activePattern.id, { correctedAudioSamples: pcm, melodyneRegions: updatedRegions }),
  });

  const { steps: allSteps, setSteps: setAllSteps, commitSnapshot, undo, redo, canUndo, canRedo, historyCount } = useStepsHistory({
    initialSnapshot: { steps: defaultSteps, rawPitchCurve, melodyneRegions: regions, assignedLyricsText: activePattern.assignedLyricsText || '' }, maxHistory: 30,
    onRestore: (snap) => {
      restoreRegions(snap.melodyneRegions);
      updatePattern(activePattern.id, { rawPitchCurve: snap.rawPitchCurve, pitchCurve: snap.rawPitchCurve, melodyneRegions: snap.melodyneRegions, assignedLyricsText: snap.assignedLyricsText, anacrusisSteps: hasAnac ? snap.steps.slice(0, anacLen) : [], mainSteps: (hasAnac ? snap.steps.slice(anacLen) : snap.steps).map((s, idx) => ({ ...s, stepIndex: idx })) });
    },
  });

  const { player, playMode, setPlayMode, clickEnabled, setClickEnabled, isPlaying, setIsPlaying, seekStartSec, handleTogglePlay, handleSeek } = useLivretMelodiaPlayback({
    cleanPCM: activePCM, sampleRate, totalDurationSec, allSteps, bpm: initialPack.metadata.bpm, beatsPerMeasure, measuresCount,
    pitchShiftSemitones, hasAnacrusis: hasAnac, t1OffsetSec, outputDeviceId, harmonyGrid: activePattern.harmonyGrid, harmonyConfig,
  });

  const commitCurrentSnapshot = useCallback((partial?: Partial<LivretMelodiaSnapshot>) => {
    commitSnapshot({ steps: partial?.steps ?? allSteps, rawPitchCurve: partial?.rawPitchCurve ?? rawPitchCurve, melodyneRegions: partial?.melodyneRegions ?? regions, assignedLyricsText: partial?.assignedLyricsText ?? (activePattern.assignedLyricsText || '') });
  }, [commitSnapshot, allSteps, rawPitchCurve, regions, activePattern.assignedLyricsText]);

  const handleUpdateSteps = useCallback((newSteps: VocalStepData[], commit = true) => {
    setAllSteps(newSteps, commit);
    const updatedPack = buildUpdatedVocalPackExport(initialPack, newSteps, hasAnac, beatsPerMeasure, displayedCurve);
    updatePattern(activePattern.id, { pack: updatedPack, anacrusisSteps: hasAnac ? newSteps.slice(0, anacLen) : [], mainSteps: (hasAnac ? newSteps.slice(anacLen) : newSteps).map((s, idx) => ({ ...s, stepIndex: idx })), isMidiInitialized: true, ...(commit ? { midiLocked: true } : {}) });
  }, [setAllSteps, initialPack, hasAnac, beatsPerMeasure, displayedCurve, anacLen, activePattern.id, updatePattern]);

  const recompute = useCallback((smooth: number, ton: string, sc: ScaleType) => {
    const q = quantizePitchToSteps({ pitchCurve: rawPitchCurve, bpm: initialPack.metadata.bpm, beatsPerMeasure, measuresCount, beatResolutions: initialPack.metadata.beatResolutions, trimStartSec: 0, trimEndSec: totalDurationSec, hasAnacrusis: hasAnac, t1OffsetSec, smoothingLevel: smooth, tonic: ton, scaleType: sc, pcm: rawPCM, sampleRate, timeAnchors: activePattern.timeAnchors });
    const rawSteps = hasAnac ? [...q.anacrusisSteps, ...q.gridSteps] : q.gridSteps;
    const steps = (activePattern.assignedLyricsText || activePattern.timeAnchors?.length) ? applyLyricsSyllablesToSteps(rawSteps, activePattern.assignedLyricsText, activePattern.timeAnchors, beatsPerMeasure, resPerBeat) : rawSteps;
    commitCurrentSnapshot({ steps }); handleUpdateSteps(steps, false);
  }, [rawPitchCurve, initialPack, beatsPerMeasure, measuresCount, totalDurationSec, hasAnac, t1OffsetSec, rawPCM, sampleRate, activePattern.assignedLyricsText, activePattern.timeAnchors, resPerBeat, commitCurrentSnapshot, handleUpdateSteps]);

  const { handleReset, handleShiftOctave, handleAlignOctaveToBricks, handleDeleteSelected } = useMelodiaActions({
    rawPCM, sampleRate, totalDurationSec, activePattern, initialPack, beatsPerMeasure, measuresCount, hasAnac, t1OffsetSec, smoothingLevel, tonic, scaleType, rawPitchCurve, allSteps, selectedRegion, selectedRegionId, selectedStepIdx, regions, clearAllRegions, deleteSelected, commitCurrentSnapshot, setAllSteps, updatePattern, handleUpdateSteps, t,
  });

  useEffect(() => useVocalTransportStore.getState().registerHandlers({
    togglePlay: handleTogglePlay, stop: () => { player.stop(); setIsPlaying(false); }, undo, redo, deleteSelected: handleDeleteSelected,
    seekRelative: (d: number) => handleSeek(Math.max(0, Math.min(totalDurationSec, seekStartSec + d))),
    onMidiNote: (m: number) => {
      if (selectedStepIdx !== null) {
        const nextSteps = moveBrick(allSteps, selectedStepIdx, m);
        handleUpdateSteps(nextSteps);
        syncMovedBrickRegion(selectedStepIdx, nextSteps);
      }
    },
  }), [handleTogglePlay, player, undo, redo, handleDeleteSelected, handleSeek, totalDurationSec, seekStartSec, selectedStepIdx, allSteps, handleUpdateSteps, syncMovedBrickRegion, setIsPlaying]);

  useEffect(() => { useVocalTransportStore.getState().setIsPlaying(isPlaying); }, [isPlaying]);

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-end"><HarmonyProfileSelector config={harmonyConfig} onChange={updateHarmonyConfig} /></div>
      <PianoRollEditor
        allSteps={allSteps} pitchCurve={displayedCurve} rawPitchCurve={rawPitchCurve} totalDurationSec={totalDurationSec} anacrusisDurationSec={anacrusisDurationSec}
        beatsPerMeasure={beatsPerMeasure} measuresCount={measuresCount} beatResolutions={initialPack.metadata.beatResolutions} seekStartSec={seekStartSec} isPlaying={isPlaying}
        tonic={tonic} scaleType={scaleType} smoothingLevel={smoothingLevel} canUndo={canUndo} canRedo={canRedo} historyCount={historyCount}
        hasAnacrusis={hasAnac} bpm={initialPack.metadata.bpm} regions={regions} selectedRegionId={selectedRegionId} activeTool={activeTool} onSelectTool={setActiveTool}
        selectedStepIdx={selectedStepIdx} onSelectStep={setSelectedStepIdx} getPlayheadSec={() => player.getCurrentPlayheadSec()} onSeek={handleSeek} onUndo={undo} onRedo={redo}
        onSetTonic={(ton) => { setTonic(ton); recompute(smoothingLevel, ton, scaleType); }} onSetScaleType={(st) => { setScaleType(st); recompute(smoothingLevel, tonic, st); }}
        onSetSmoothingLevel={(lvl) => { setSmoothingLevel(lvl); recompute(lvl, tonic, scaleType); }} onUpdateSteps={handleUpdateSteps} onBrickMoved={syncMovedBrickRegion} onPlayNotePreview={(m) => player.playNotePreview(m)} onReExtractNotes={handleReset}
        onSelectRegion={setSelectedRegionId} onAddRegion={(s0, s1) => { commitCurrentSnapshot(); addRegion(s0, s1); }} onUpdateRegionBounds={updateBounds} onDeleteSelectedRegion={() => { commitCurrentSnapshot(); deleteSelected(); }}
        harmonyGrid={activePattern.harmonyGrid} onUpdateHarmonyGrid={(g) => updatePattern(activePattern.id, { harmonyGrid: g })} pitchShiftSemitones={pitchShiftSemitones}
      />
      <MelodyneControlsBar
        selectedRegion={selectedRegion} regionsCount={regions.length} isProcessing={isProcessing} isToolActive={activeTool === 'melodyne_cut'} onActivateTool={() => setActiveTool('melodyne_cut')}
        onAddWholePhrase={() => { commitCurrentSnapshot(); addWholePhraseRegion(); }}
        onAutoSweetSpot={() => { commitCurrentSnapshot(); applyAutoSweetSpot(); window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: t('melodyneAutoSweetToast'), type: 'success' } })); }}
        onUpdateSelected={updateSelectedRegion} onDeleteSelected={() => { commitCurrentSnapshot(); deleteSelected(); }}
        onShiftOctave={handleShiftOctave} onAlignOctaveToBricks={handleAlignOctaveToBricks}
        onClearAllMelodyne={() => { commitCurrentSnapshot({ melodyneRegions: [] }); clearAllRegions(); window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: t('melodynePurgeToast'), type: 'info' } })); }}
      />
      <MelodicControls
        isPlaying={isPlaying} playMode={playMode} clickEnabled={clickEnabled} onTogglePlay={handleTogglePlay} onResetSeek={() => handleSeek(0)}
        onSetPlayMode={(m) => { setPlayMode(m); player.setPlayMode(m, clickEnabled); }} onToggleClick={() => setClickEnabled((p) => { const n = !p; player.setPlayMode(playMode, n); return n; })}
        onBackToPrise={onBackToPrise ?? (() => useVocalTransportStore.getState().setActiveLivret('prise'))}
        onDownloadPack={() => { const u = buildUpdatedVocalPackExport(initialPack, allSteps, hasAnac, beatsPerMeasure, displayedCurve); onPackUpdated?.(u); downloadToadaPackJson(project, u); }}
      />
      <LetraEditorPanel allSteps={allSteps} onUpdateSteps={handleUpdateSteps} onCommitHistory={() => commitCurrentSnapshot()} />
      <MelodiaNextStepFooter />
    </div>
  );
};
