/**
 * LivretMelodia.tsx
 * Conteneur du Livret 2 « Melodia & Letra » : Piano Roll avec vrai clavier,
 * quantification dynamique par gamme, lissage instantané et éditeur de Letra.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { PitchCurvePoint, VocalPackExport, VocalStepData } from '../../types/vocalPack.types';
import { MelodicPreviewPlayer, type MelodicPlayMode } from '../../audio/MelodicPreviewPlayer';
import { quantizePitchToSteps } from '../../audio/stepQuantizer';
import type { ScaleType } from '../../audio/scaleQuantizer';
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
  const { initialPack, cleanPCM, sampleRate, totalDurationSec, anacrusisDurationSec, beatsPerMeasure, measuresCount, pitchCurve, initialSteps, outputDeviceId, onBackToPrise, onPackUpdated } = props;

  const [allSteps, setAllSteps] = useState<VocalStepData[]>(initialSteps);
  const [playMode, setPlayMode] = useState<MelodicPlayMode>('duo');
  const [clickEnabled, setClickEnabled] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playheadSec, setPlayheadSec] = useState<number>(-1);
  const [tonic, setTonic] = useState<string>(() => initialPack.metadata.referencePitch?.replace(/\d+$/, '') || 'C');
  const [scaleType, setScaleType] = useState<ScaleType>('chromatic');
  const [smoothingLevel, setSmoothingLevel] = useState<number>(0.5);

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

  const recompute = useCallback((lvl: number, t: string, st: ScaleType) => {
    const q = quantizePitchToSteps({
      pitchCurve, bpm: initialPack.metadata.bpm, beatsPerMeasure, measuresCount,
      beatResolutions: initialPack.metadata.beatResolutions, trimStartSec: 0, trimEndSec: totalDurationSec,
      smoothingLevel: lvl, tonic: t, scaleType: st,
    });
    const newSteps = [...q.anacrusisSteps, ...q.gridSteps];
    setAllSteps((prev) => newSteps.map((s, idx) => ({ ...s, syllable: prev[idx]?.syllable || '' })));
  }, [pitchCurve, initialPack, beatsPerMeasure, measuresCount, totalDurationSec]);

  const handleTogglePlay = useCallback(async () => {
    if (isPlaying) { player.stop(); setIsPlaying(false); return; }
    setIsPlaying(true);
    await player.play({
      cleanPCM, sampleRate, totalDurationSec, allSteps, bpm: initialPack.metadata.bpm,
      beatsPerMeasure, playMode, clickEnabled, outputDeviceId, onEnded: () => setIsPlaying(false),
    });
  }, [player, isPlaying, cleanPCM, sampleRate, totalDurationSec, allSteps, initialPack, beatsPerMeasure, playMode, clickEnabled, outputDeviceId]);

  const handleDownloadPack = useCallback(() => {
    const anacrusisCount = beatsPerMeasure * (initialPack.metadata.beatResolutions[0] || 4);
    const anacrusisSteps = allSteps.slice(0, anacrusisCount);
    const gridSteps = allSteps.slice(anacrusisCount).map((s, idx) => ({ ...s, stepIndex: idx }));

    const updatedPack: VocalPackExport = {
      ...initialPack,
      alignment: { ...initialPack.alignment, anacrusis: { ...initialPack.alignment.anacrusis, steps: anacrusisSteps } },
      grid: { steps: gridSteps, totalSteps: gridSteps.length },
      pitchCurve,
    };
    onPackUpdated(updatedPack);

    const blob = new Blob([JSON.stringify(updatedPack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `vocal-pack-${initialPack.metadata.timeSignature.replace('/', '-')}-${initialPack.metadata.bpm}bpm.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [allSteps, beatsPerMeasure, initialPack, pitchCurve, onPackUpdated]);

  return (
    <div className="flex flex-col gap-3 w-full">
      <PianoRollEditor
        allSteps={allSteps} pitchCurve={pitchCurve} totalDurationSec={totalDurationSec} anacrusisDurationSec={anacrusisDurationSec}
        playheadSec={playheadSec} isPlaying={isPlaying} tonic={tonic} scaleType={scaleType} smoothingLevel={smoothingLevel}
        onSetTonic={(t) => { setTonic(t); recompute(smoothingLevel, t, scaleType); }}
        onSetScaleType={(st) => { setScaleType(st); recompute(smoothingLevel, tonic, st); }}
        onSetSmoothingLevel={(lvl) => { setSmoothingLevel(lvl); recompute(lvl, tonic, scaleType); }}
        onUpdateSteps={setAllSteps} onPlayNotePreview={(m) => player.playNotePreview(m)}
      />
      <LetraEditorPanel allSteps={allSteps} onUpdateSteps={setAllSteps} />
      <MelodicControls
        isPlaying={isPlaying} playMode={playMode} clickEnabled={clickEnabled}
        onTogglePlay={handleTogglePlay} onSetPlayMode={(m) => { setPlayMode(m); player.setPlayMode(m, clickEnabled); }}
        onToggleClick={() => setClickEnabled((p) => { const n = !p; player.setPlayMode(playMode, n); return n; })}
        onBackToPrise={onBackToPrise} onDownloadPack={handleDownloadPack}
      />
    </div>
  );
};
