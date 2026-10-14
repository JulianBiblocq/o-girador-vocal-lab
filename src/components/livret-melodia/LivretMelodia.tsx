/**
 * LivretMelodia.tsx
 * Conteneur du Livret 2 : Piano Roll zoomable avec règle Seek,
 * Transport centré entre Piano Roll et Letra, raccourcis Espace & Ctrl+Z/Y.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { PitchCurvePoint, VocalPackExport } from '../../types/vocalPack.types';
import { MelodicPreviewPlayer, type MelodicPlayMode } from '../../audio/MelodicPreviewPlayer';
import { quantizePitchToSteps } from '../../audio/stepQuantizer';
import type { ScaleType } from '../../audio/scaleQuantizer';
import { useStepsHistory } from '../../hooks/useStepsHistory';
import { PianoRollEditor } from './PianoRollEditor';
import { LetraEditorPanel } from './LetraEditorPanel';
import { MelodicControls } from './MelodicControls';

interface LivretMelodiaProps {
  initialPack: VocalPackExport;
  cleanPCM: Float32Array;
  sampleRate: number;
  totalDurationSec: number;
  anacrusisDurationSec: number;
  beatsPerMeasure: number;
  measuresCount: number;
  pitchCurve: PitchCurvePoint[];
  initialSteps: any[];
  outputDeviceId?: string;
  onBackToPrise: () => void;
  onPackUpdated: (pack: VocalPackExport) => void;
}

export const LivretMelodia: React.FC<LivretMelodiaProps> = (props) => {
  const { initialPack, cleanPCM, sampleRate, totalDurationSec, anacrusisDurationSec, beatsPerMeasure, measuresCount, pitchCurve, initialSteps, outputDeviceId, onBackToPrise, onPackUpdated } = props;

  const { steps: allSteps, setSteps: setAllSteps, undo, redo, canUndo, canRedo, historyCount } = useStepsHistory(initialSteps, 10);
  const [playMode, setPlayMode] = useState<MelodicPlayMode>('duo');
  const [clickEnabled, setClickEnabled] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [seekStartSec, setSeekStartSec] = useState<number>(0);
  const [tonic, setTonic] = useState<string>(() => initialPack.metadata.referencePitch?.replace(/\d+$/, '') || 'C');
  const [scaleType, setScaleType] = useState<ScaleType>('chromatic');
  const [smoothingLevel, setSmoothingLevel] = useState<number>(0.5);

  const player = useMemo(() => new MelodicPreviewPlayer(), []);
  useEffect(() => () => player.stop(), [player]);

  const handleTogglePlay = useCallback(async () => {
    if (isPlaying) { player.stop(); setIsPlaying(false); return; }
    setIsPlaying(true);
    await player.play({
      cleanPCM, sampleRate, totalDurationSec, allSteps, bpm: initialPack.metadata.bpm,
      beatsPerMeasure, playMode, clickEnabled, seekStartSec, outputDeviceId, onEnded: () => setIsPlaying(false),
    });
  }, [player, isPlaying, cleanPCM, sampleRate, totalDurationSec, allSteps, initialPack, beatsPerMeasure, playMode, clickEnabled, seekStartSec, outputDeviceId]);

  const handleSeek = useCallback((sec: number) => {
    setSeekStartSec(sec);
    if (isPlaying) {
      player.play({
        cleanPCM, sampleRate, totalDurationSec, allSteps, bpm: initialPack.metadata.bpm,
        beatsPerMeasure, playMode, clickEnabled, seekStartSec: sec, outputDeviceId, onEnded: () => setIsPlaying(false),
      });
    }
  }, [isPlaying, player, cleanPCM, sampleRate, totalDurationSec, allSteps, initialPack, beatsPerMeasure, playMode, clickEnabled, outputDeviceId]);

  // Raccourcis Espace & Ctrl+Z / Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable;
      if (e.code === 'Space' && !isInput) { e.preventDefault(); handleTogglePlay(); }
      if ((e.ctrlKey || e.metaKey) && !isInput) {
        if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
        else if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); redo(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, undo, redo]);

  const recompute = useCallback((lvl: number, t: string, st: ScaleType) => {
    const q = quantizePitchToSteps({
      pitchCurve, bpm: initialPack.metadata.bpm, beatsPerMeasure, measuresCount,
      beatResolutions: initialPack.metadata.beatResolutions, trimStartSec: 0, trimEndSec: totalDurationSec,
      smoothingLevel: lvl, tonic: t, scaleType: st,
    });
    const newSteps = [...q.anacrusisSteps, ...q.gridSteps];
    setAllSteps((prev) => newSteps.map((s, idx) => ({ ...s, syllable: prev[idx]?.syllable || '' })));
  }, [pitchCurve, initialPack, beatsPerMeasure, measuresCount, totalDurationSec, setAllSteps]);

  const handleDownloadPack = useCallback(() => {
    const anacrusisCount = beatsPerMeasure * (initialPack.metadata.beatResolutions[0] || 4);
    const updatedPack: VocalPackExport = {
      ...initialPack,
      alignment: { ...initialPack.alignment, anacrusis: { ...initialPack.alignment.anacrusis, steps: allSteps.slice(0, anacrusisCount) } },
      grid: { steps: allSteps.slice(anacrusisCount).map((s, idx) => ({ ...s, stepIndex: idx })), totalSteps: allSteps.length - anacrusisCount },
      pitchCurve,
    };
    onPackUpdated(updatedPack);
    const blob = new Blob([JSON.stringify(updatedPack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `vocal-pack-${initialPack.metadata.timeSignature.replace('/', '-')}-${initialPack.metadata.bpm}bpm.json`;
    a.click(); URL.revokeObjectURL(url);
  }, [allSteps, beatsPerMeasure, initialPack, pitchCurve, onPackUpdated]);

  return (
    <div className="flex flex-col gap-3 w-full">
      <PianoRollEditor
        allSteps={allSteps} pitchCurve={pitchCurve} totalDurationSec={totalDurationSec} anacrusisDurationSec={anacrusisDurationSec}
        beatsPerMeasure={beatsPerMeasure} beatResolutions={initialPack.metadata.beatResolutions} seekStartSec={seekStartSec}
        isPlaying={isPlaying} tonic={tonic} scaleType={scaleType} smoothingLevel={smoothingLevel} canUndo={canUndo} canRedo={canRedo} historyCount={historyCount}
        getPlayheadSec={() => player.getCurrentPlayheadSec()} onSeek={handleSeek} onUndo={undo} onRedo={redo}
        onSetTonic={(t) => { setTonic(t); recompute(smoothingLevel, t, scaleType); }}
        onSetScaleType={(st) => { setScaleType(st); recompute(smoothingLevel, tonic, st); }}
        onSetSmoothingLevel={(lvl) => { setSmoothingLevel(lvl); recompute(lvl, tonic, scaleType); }}
        onUpdateSteps={(steps) => setAllSteps(steps, true)} onPlayNotePreview={(m) => player.playNotePreview(m)}
      />
      <MelodicControls
        isPlaying={isPlaying} playMode={playMode} clickEnabled={clickEnabled} onTogglePlay={handleTogglePlay}
        onResetSeek={() => handleSeek(0)} onSetPlayMode={(m) => { setPlayMode(m); player.setPlayMode(m, clickEnabled); }}
        onToggleClick={() => setClickEnabled((p) => { const n = !p; player.setPlayMode(playMode, n); return n; })}
        onBackToPrise={onBackToPrise} onDownloadPack={handleDownloadPack}
      />
      <LetraEditorPanel allSteps={allSteps} onUpdateSteps={(steps) => setAllSteps(steps, true)} />
    </div>
  );
};
