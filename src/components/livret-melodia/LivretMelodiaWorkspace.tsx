/**
 * LivretMelodiaWorkspace.tsx — Espace de travail Cubase VariAudio du Livret 4 (< 140 lignes).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { PitchCurvePoint, VocalPackExport, VocalStepData } from '../../types/vocalPack.types';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useStepsHistory, type LivretMelodiaSnapshot } from '../../hooks/useStepsHistory';
import { useMelodyneAudioProcessor } from '../../hooks/useMelodyneAudioProcessor';
import { useLivretMelodiaPlayback } from './useLivretMelodiaPlayback';
import { buildAllowedPitchClasses, detectBestScaleFromPitchCurve, type ScaleType } from '../../audio/scaleQuantizer';
import { resolveProjectDualScale, applyDualScaleToProject } from '../../utils/scaleTranspositionHelper';
import { getOrComputeTroupeTransposedPCM } from '../../audio/formantPreservingPitchShifter';
import { downloadToadaPackJson } from '../../utils/toadaPackExporter';
import { checkPatternIsAligned } from '../common/PatternCompassBar';
import { AmbitusReminderBanner } from '../common/AmbitusReminderBanner';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { ScaleLockBar } from './ScaleLockBar'; import { PianoRollEditor } from './PianoRollEditor';
import { MelodicControls } from './MelodicControls'; import { LetraEditorPanel } from './LetraEditorPanel';
import { MelodiaNextStepFooter } from './MelodiaNextStepFooter'; import { HarmonyProfileSelector } from '../common/HarmonyProfileSelector';
import { DEFAULT_HARMONY_CONFIG } from '../../types/harmony.types';
import { moveBrick, setAllBricksMelodynePullPct, type PianoRollTool } from './pianoRollInteractions';
import { buildUpdatedVocalPackExport, upgradeStalePatternStepsIfNeeded, extractProjectRawLyricsSource } from '../../audio/livretResetHelper';
import { useMelodiaActions } from './useMelodiaActions';
import { useLanguage } from '../../i18n/LanguageContext';

export interface LivretMelodiaWorkspaceProps {
  initialPack: VocalPackExport; cleanPCM?: Float32Array; sampleRate?: number; totalDurationSec?: number;
  anacrusisDurationSec?: number; beatsPerMeasure?: number; measuresCount?: number; pitchCurve?: PitchCurvePoint[];
  initialSteps?: VocalStepData[]; outputDeviceId?: string; pitchShiftSemitones?: number;
  onBackToPrise?: () => void; onPackUpdated?: (pack: VocalPackExport) => void; onAnalyzeFullProjectScale?: () => void;
}
export const LivretMelodiaWorkspace: React.FC<LivretMelodiaWorkspaceProps> = ({
  initialPack, cleanPCM, sampleRate = 44100, totalDurationSec = 4, anacrusisDurationSec = 0, beatsPerMeasure = 4,
  measuresCount = 2, pitchCurve = [], initialSteps, outputDeviceId, pitchShiftSemitones = 0, onBackToPrise, onPackUpdated, onAnalyzeFullProjectScale,
}) => {
  const { t, language } = useLanguage(), { activePattern, updatePattern, project, loadProject, updateHarmonyConfig, togglePatternFoldNotes, setAllPatternsFoldNotes } = useToadaProject();
  const [activeTool, setActiveTool] = useState<PianoRollTool>('pointer'), [selectedStepIdx, setSelectedStepIdx] = useState<number | null>(null);
  const rawPitchCurve = useMemo(() => activePattern.rawPitchCurve ?? pitchCurve, [activePattern.rawPitchCurve, pitchCurve]);
  const dualScale = useMemo(() => resolveProjectDualScale(project, language), [project, language]);
  const initialScale = useMemo(() => detectBestScaleFromPitchCurve(rawPitchCurve, project.toadaMeta?.tonaliteChanteeOrigine || project.toadaMeta?.tonaliteDefaut || initialPack.metadata.referencePitch), [rawPitchCurve, project.toadaMeta?.tonaliteChanteeOrigine, project.toadaMeta?.tonaliteDefaut, initialPack.metadata.referencePitch]);
  const hasStoredScale = Boolean(project.sungScaleRoot || project.toadaMeta?.tonaliteDefaut);
  const [tonic, setTonic] = useState(() => hasStoredScale ? dualScale.sungScaleRoot : initialScale.tonic);
  const [scaleType, setScaleType] = useState<ScaleType>(() => hasStoredScale ? dualScale.sungScaleMode : 'chromatic');
  const [customPitchClasses, setCustomPitchClasses] = useState<number[] | null>(null), [smoothingLevel, setSmoothingLevel] = useState(0);
  const transpositionSemitones = dualScale.transpositionSemitones, listenTarget: 'sung' | 'troupe' = project.previewListenTarget ?? (transpositionSemitones !== 0 ? 'troupe' : 'sung');
  const alignedCount = useMemo(() => project.patterns.filter(checkPatternIsAligned).length, [project.patterns]);
  useEffect(() => {
    if (project.sungScaleRoot || project.toadaMeta?.tonaliteDefaut) { setTonic(dualScale.sungScaleRoot); setScaleType(dualScale.sungScaleMode); }
  }, [project.sungScaleRoot, project.toadaMeta?.tonaliteDefaut, dualScale.sungScaleRoot, dualScale.sungScaleMode]);
  const allowedPitchClasses = useMemo(() => (scaleType !== 'chromatic' || (customPitchClasses && customPitchClasses.length < 12) ? buildAllowedPitchClasses(tonic, scaleType, customPitchClasses) : null), [tonic, scaleType, customPitchClasses]);
  const rawPCM = useMemo(() => activePattern.rawAudioSamples ?? cleanPCM ?? new Float32Array(0), [activePattern.rawAudioSamples, cleanPCM]);
  const hasAnac = activePattern.hasAnacrusis !== false, resPerBeat = initialPack.metadata.beatResolutions?.[0] || 4;
  const anacLen = hasAnac ? beatsPerMeasure * resPerBeat : 0, t1OffsetSec = hasAnac ? beatsPerMeasure * (60 / (initialPack.metadata.bpm || 88)) : 0.15;
  const activePCM = activePattern.correctedAudioSamples ?? rawPCM, harmonyConfig = project.harmonyConfig ?? DEFAULT_HARMONY_CONFIG;
  const effectivePlayShift = pitchShiftSemitones + (listenTarget === 'troupe' ? transpositionSemitones : 0);
  const playbackPCM = useMemo(() => (listenTarget === 'troupe' && transpositionSemitones !== 0 ? getOrComputeTroupeTransposedPCM(activePCM, sampleRate, transpositionSemitones) : activePCM), [activePCM, sampleRate, listenTarget, transpositionSemitones]);

  const rawDefaultSteps = initialSteps ?? [...(activePattern.anacrusisSteps || []), ...(activePattern.mainSteps || [])];
  const expectedStepsCount = ((hasAnac ? beatsPerMeasure : 0) + measuresCount * beatsPerMeasure + 1) * resPerBeat;
  const rawTxtCode = useMemo(() => extractProjectRawLyricsSource(project, activePattern), [project, activePattern]);
  const defaultSteps = useMemo(() => upgradeStalePatternStepsIfNeeded({
    rawDefaultSteps, expectedStepsCount, rawPitchCurve, activePattern, initialPack, beatsPerMeasure, measuresCount, hasAnac, t1OffsetSec, resPerBeat, totalDurationSec, tonic, scaleType, rawPCM, sampleRate, rawTxtCode,
  }), [rawDefaultSteps, expectedStepsCount, rawPitchCurve, activePattern, initialPack, beatsPerMeasure, measuresCount, hasAnac, t1OffsetSec, resPerBeat, totalDurationSec, tonic, scaleType, rawPCM, sampleRate, rawTxtCode]);

  const { regions, selectedRegionId, selectedRegion, displayedCurve, syncMovedBrickRegion, deleteSelected, clearAllRegions, restoreRegions } = useMelodyneAudioProcessor({
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
    cleanPCM: playbackPCM, sampleRate, totalDurationSec, allSteps, bpm: initialPack.metadata.bpm, beatsPerMeasure, measuresCount,
    pitchShiftSemitones: effectivePlayShift, hasAnacrusis: hasAnac, t1OffsetSec, outputDeviceId, harmonyGrid: activePattern.harmonyGrid, harmonyConfig,
  });

  useEffect(() => {
    if (activePattern.foldNotesView && playMode !== 'voice') { setPlayMode('voice'); player.setPlayMode('voice', clickEnabled); }
  }, [activePattern.foldNotesView, playMode, clickEnabled, setPlayMode, player]);

  const commitCurrentSnapshot = useCallback((partial?: Partial<LivretMelodiaSnapshot>) => {
    commitSnapshot({ steps: partial?.steps ?? allSteps, rawPitchCurve: partial?.rawPitchCurve ?? rawPitchCurve, melodyneRegions: partial?.melodyneRegions ?? regions, assignedLyricsText: partial?.assignedLyricsText ?? (activePattern.assignedLyricsText || '') });
  }, [commitSnapshot, allSteps, rawPitchCurve, regions, activePattern.assignedLyricsText]);

  const handleUpdateSteps = useCallback((newSteps: VocalStepData[], commit = true) => {
    const norm = newSteps.map((s, idx) => ({ ...s, stepIndex: idx }));
    setAllSteps(norm, commit);
    let nextLyrics = activePattern.assignedLyricsText;
    if (commit && nextLyrics) {
      for (const st of norm) { const syl = (st.syllable || '').trim(); if (syl.includes("'")) nextLyrics = nextLyrics.replace(new RegExp(`\\b${syl.replace(/'/g, '\\s+')}\\b`, 'gi'), syl); }
    }
    const updatedPack = buildUpdatedVocalPackExport(initialPack, norm, hasAnac, beatsPerMeasure, displayedCurve);
    updatePattern(activePattern.id, { pack: updatedPack, anacrusisSteps: hasAnac ? norm.slice(0, anacLen) : [], mainSteps: (hasAnac ? norm.slice(anacLen) : norm).map((s, idx) => ({ ...s, stepIndex: idx })), isMidiInitialized: true, ...(commit ? { midiLocked: true, ...(nextLyrics !== activePattern.assignedLyricsText ? { assignedLyricsText: nextLyrics } : {}) } : {}) });
  }, [setAllSteps, initialPack, hasAnac, beatsPerMeasure, displayedCurve, anacLen, activePattern.id, activePattern.assignedLyricsText, updatePattern]);

  const { handleSnapToGreenLine, handleAnalyzeFullSongMelody, handleReset, handleDeleteSelected } = useMelodiaActions({
    project, loadProject, rawPCM, sampleRate, totalDurationSec, activePattern, initialPack, beatsPerMeasure, measuresCount, hasAnac, t1OffsetSec, smoothingLevel, tonic, scaleType, customPitchClasses, rawPitchCurve, allSteps, selectedRegion, selectedRegionId, selectedStepIdx, regions, clearAllRegions, deleteSelected, commitCurrentSnapshot, setAllSteps, updatePattern, handleUpdateSteps, t, rawTxtCode,
  });

  const globalVariAudioPct = useMemo(() => {
    const roots = allSteps.filter((s) => s.active && s.note !== '───');
    return roots.length === 0 ? 0 : Math.round(roots.reduce((acc, s) => acc + (s.melodynePullPct ?? 0), 0) / roots.length);
  }, [allSteps]);

  useEffect(() => useVocalTransportStore.getState().registerHandlers({
    togglePlay: handleTogglePlay, stop: () => { player.stop(); setIsPlaying(false); }, undo, redo, deleteSelected: handleDeleteSelected,
    seekRelative: (d: number) => handleSeek(Math.max(0, Math.min(totalDurationSec, seekStartSec + d))),
    onMidiNote: (m: number) => { if (selectedStepIdx !== null && !activePattern.foldNotesView) { const nextSteps = moveBrick(allSteps, selectedStepIdx, m); handleUpdateSteps(nextSteps); syncMovedBrickRegion(selectedStepIdx, nextSteps); } },
  }), [handleTogglePlay, player, undo, redo, handleDeleteSelected, handleSeek, totalDurationSec, seekStartSec, selectedStepIdx, activePattern.foldNotesView, allSteps, handleUpdateSteps, syncMovedBrickRegion, setIsPlaying]);
  useEffect(() => { useVocalTransportStore.getState().setIsPlaying(isPlaying); }, [isPlaying]);

  return (
    <div className="flex flex-col gap-3 w-full">
      <AmbitusReminderBanner />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex-1 min-w-[280px]">
          <ScaleLockBar tonic={tonic} scaleType={scaleType} customPitchClasses={customPitchClasses} pitchCurve={rawPitchCurve} defaultKeyStr={project.toadaMeta?.tonaliteChanteeOrigine || project.toadaMeta?.tonaliteDefaut || initialPack.metadata.referencePitch} transpositionSemitones={transpositionSemitones} listenTarget={listenTarget} onUpdateScale={(ton, st, cust) => { setTonic(ton); setScaleType(st); setCustomPitchClasses(cust); loadProject(applyDualScaleToProject(project, ton, st, transpositionSemitones, activePattern.referencePitch, language)); handleSnapToGreenLine(ton, st, cust); }} onChangeTransposition={(nextSt) => loadProject({ ...applyDualScaleToProject(project, tonic, scaleType === 'chromatic' ? 'natural_minor' : scaleType, nextSt, activePattern.referencePitch, language), previewListenTarget: 'troupe' })} onChangeListenTarget={(target) => loadProject({ ...project, previewListenTarget: target })} onAnalyzeFullProjectScale={onAnalyzeFullProjectScale} />
        </div>
        <HarmonyProfileSelector config={harmonyConfig} onChange={updateHarmonyConfig} />
      </div>
      <PianoRollEditor allSteps={allSteps} pitchCurve={displayedCurve} rawPitchCurve={rawPitchCurve} totalDurationSec={totalDurationSec} anacrusisDurationSec={anacrusisDurationSec} beatsPerMeasure={beatsPerMeasure} measuresCount={measuresCount} beatResolutions={initialPack.metadata.beatResolutions} seekStartSec={seekStartSec} isPlaying={isPlaying} tonic={tonic} scaleType={scaleType} smoothingLevel={smoothingLevel} canUndo={canUndo} canRedo={canRedo} historyCount={historyCount} allowedPitchClasses={allowedPitchClasses} hasAnacrusis={hasAnac} bpm={initialPack.metadata.bpm} activeTool={activeTool} onSelectTool={setActiveTool} foldNotesView={Boolean(activePattern.foldNotesView)} onToggleFoldNotes={(folded) => { togglePatternFoldNotes(activePattern.id, folded); if (folded) { setPlayMode('voice'); player.setPlayMode('voice', clickEnabled); } }} onApplyFoldToAllPatterns={(folded) => { setAllPatternsFoldNotes(folded); if (folded) { setPlayMode('voice'); player.setPlayMode('voice', clickEnabled); } window.dispatchEvent(new CustomEvent('app-toast', { detail: { type: 'info', message: folded ? `Notes repliées (Rythme) appliquées aux ${project.patterns.length} patterns` : `Notes dépliées (Mélodie) appliquées aux ${project.patterns.length} patterns` } })); }} alignedPatternsCount={alignedCount} totalPatternsCount={project.patterns.length} selectedStepIdx={selectedStepIdx} onSelectStep={setSelectedStepIdx} getPlayheadSec={() => player.getCurrentPlayheadSec()} onSeek={handleSeek} onUndo={undo} onRedo={redo} onSetTonic={(ton) => { setTonic(ton); handleSnapToGreenLine(ton, scaleType, customPitchClasses); }} onSetScaleType={(st) => { setScaleType(st); handleSnapToGreenLine(tonic, st, customPitchClasses); }} onSetSmoothingLevel={setSmoothingLevel} onUpdateSteps={handleUpdateSteps} onBrickMoved={syncMovedBrickRegion} onPlayNotePreview={(m) => player.playNotePreview(m + (listenTarget === 'troupe' ? transpositionSemitones : 0))} onSnapToGreenLine={() => handleSnapToGreenLine(tonic, scaleType, customPitchClasses)} onAnalyzeFullSongMelody={handleAnalyzeFullSongMelody} onReExtractNotes={handleReset} globalVariAudioPct={globalVariAudioPct} onChangeGlobalVariAudioPct={(pct) => { const next = setAllBricksMelodynePullPct(allSteps, pct); commitCurrentSnapshot({ steps: next }); handleUpdateSteps(next, true); }} onPurgeVariAudio={() => { const next = setAllBricksMelodynePullPct(allSteps, 0); commitCurrentSnapshot({ steps: next, melodyneRegions: [] }); clearAllRegions(); handleUpdateSteps(next, true); }} harmonyGrid={activePattern.harmonyGrid} onUpdateHarmonyGrid={(g) => updatePattern(activePattern.id, { harmonyGrid: g })} pitchShiftSemitones={pitchShiftSemitones} patternId={activePattern.id} />
      <MelodicControls isPlaying={isPlaying} playMode={playMode} clickEnabled={clickEnabled} onTogglePlay={handleTogglePlay} onResetSeek={() => handleSeek(0)} onSetPlayMode={(m) => { setPlayMode(m); player.setPlayMode(m, clickEnabled); }} onToggleClick={() => setClickEnabled((p) => { const n = !p; player.setPlayMode(playMode, n); return n; })} onBackToPrise={onBackToPrise ?? (() => useVocalTransportStore.getState().setActiveLivret('prise'))} onDownloadPack={() => { const u = buildUpdatedVocalPackExport(initialPack, allSteps, hasAnac, beatsPerMeasure, displayedCurve); onPackUpdated?.(u); downloadToadaPackJson(project, u); }} />
      <LetraEditorPanel allSteps={allSteps} onUpdateSteps={handleUpdateSteps} onCommitHistory={() => commitCurrentSnapshot()} />
      <MelodiaNextStepFooter />
    </div>
  );
};
