/**
 * LivretMelodia.tsx
 * Conteneur principal du Livret 2 « Melodia & Letra » : Piano Roll Zéro Rouge,
 * écoute comparative 3-états ('voice', 'synth', 'duo') et éditeur de Letra.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { PitchCurvePoint, VocalPackExport, VocalStepData } from '../../types/vocalPack.types';
import { MelodicPreviewPlayer, type MelodicPlayMode } from '../../audio/MelodicPreviewPlayer';
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
  initialSteps: VocalStepData[];
  outputDeviceId?: string;
  onBackToPrise: () => void;
  onPackUpdated: (pack: VocalPackExport) => void;
}

export const LivretMelodia: React.FC<LivretMelodiaProps> = (props) => {
  const { initialPack, cleanPCM, sampleRate, totalDurationSec, anacrusisDurationSec, beatsPerMeasure, pitchCurve, initialSteps, outputDeviceId, onBackToPrise, onPackUpdated } = props;

  const [allSteps, setAllSteps] = useState<VocalStepData[]>(initialSteps);
  const [playMode, setPlayMode] = useState<MelodicPlayMode>('duo');
  const [clickEnabled, setClickEnabled] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playheadSec, setPlayheadSec] = useState<number>(-1);

  const player = useMemo(() => new MelodicPreviewPlayer(), []);

  useEffect(() => () => player.stop(), [player]);

  useEffect(() => {
    if (!isPlaying) { setPlayheadSec(-1); return; }
    let animId: number;
    const tick = () => {
      setPlayheadSec(player.getCurrentPlayheadSec());
      if (player.getIsPlaying()) animId = requestAnimationFrame(tick);
      else { setIsPlaying(false); setPlayheadSec(-1); }
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, player]);

  const handleTogglePlay = useCallback(async () => {
    if (isPlaying) { player.stop(); setIsPlaying(false); return; }
    setIsPlaying(true);
    await player.play({
      cleanPCM, sampleRate, totalDurationSec, allSteps, bpm: initialPack.metadata.bpm,
      beatsPerMeasure, playMode, clickEnabled, outputDeviceId,
      onEnded: () => setIsPlaying(false),
    });
  }, [player, isPlaying, cleanPCM, sampleRate, totalDurationSec, allSteps, initialPack, beatsPerMeasure, playMode, clickEnabled, outputDeviceId]);

  const handleSetPlayMode = useCallback((mode: MelodicPlayMode) => {
    setPlayMode(mode);
    player.setPlayMode(mode, clickEnabled);
  }, [player, clickEnabled]);

  const handleToggleClick = useCallback(() => {
    setClickEnabled((prev) => {
      const next = !prev;
      player.setPlayMode(playMode, next);
      return next;
    });
  }, [player, playMode]);

  const handleDownloadPack = useCallback(() => {
    const anacrusisStepsCount = beatsPerMeasure * (initialPack.metadata.beatResolutions[0] || 4);
    const anacrusisSteps = allSteps.slice(0, anacrusisStepsCount);
    const gridSteps = allSteps.slice(anacrusisStepsCount).map((s, idx) => ({ ...s, stepIndex: idx }));

    const updatedPack: VocalPackExport = {
      ...initialPack,
      alignment: {
        ...initialPack.alignment,
        anacrusis: { ...initialPack.alignment.anacrusis, steps: anacrusisSteps },
      },
      grid: { steps: gridSteps, totalSteps: gridSteps.length },
      pitchCurve,
    };
    onPackUpdated(updatedPack);

    const blob = new Blob([JSON.stringify(updatedPack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocal-pack-${initialPack.metadata.timeSignature.replace('/', '-')}-${initialPack.metadata.bpm}bpm.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [allSteps, beatsPerMeasure, initialPack, pitchCurve, onPackUpdated]);

  return (
    <div className="flex flex-col gap-3 w-full">
      <PianoRollEditor
        allSteps={allSteps} pitchCurve={pitchCurve} totalDurationSec={totalDurationSec}
        anacrusisDurationSec={anacrusisDurationSec} playheadSec={playheadSec} isPlaying={isPlaying}
        onUpdateSteps={setAllSteps} onPlayNotePreview={(m) => player.playNotePreview(m)}
      />

      <LetraEditorPanel allSteps={allSteps} onUpdateSteps={setAllSteps} />

      <MelodicControls
        isPlaying={isPlaying} playMode={playMode} clickEnabled={clickEnabled}
        onTogglePlay={handleTogglePlay} onSetPlayMode={handleSetPlayMode}
        onToggleClick={handleToggleClick} onBackToPrise={onBackToPrise}
        onDownloadPack={handleDownloadPack}
      />
    </div>
  );
};
