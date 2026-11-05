/**
 * useLivretMelodiaPlayback.ts
 * Hook de lecture MelodicPreviewPlayer avec support de l'accompagnement harmonique (< 90 lignes).
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { MelodicPreviewPlayer, type MelodicPlayMode } from '../../audio/MelodicPreviewPlayer';
import type { VocalStepData } from '../../types/vocalPack.types';
import type { HarmonyConfig, PatternHarmonyGrid } from '../../types/harmony.types';

interface UseLivretMelodiaPlaybackProps {
  cleanPCM: Float32Array;
  sampleRate: number;
  totalDurationSec: number;
  allSteps: VocalStepData[];
  bpm: number;
  beatsPerMeasure: number;
  measuresCount: number;
  pitchShiftSemitones?: number;
  hasAnacrusis?: boolean;
  t1OffsetSec?: number;
  outputDeviceId?: string;
  harmonyGrid?: PatternHarmonyGrid;
  harmonyConfig?: HarmonyConfig;
}

export function useLivretMelodiaPlayback(props: UseLivretMelodiaPlaybackProps) {
  const [playMode, setPlayMode] = useState<MelodicPlayMode>('duo');
  const [clickEnabled, setClickEnabled] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekStartSec, setSeekStartSec] = useState(0);

  const player = useMemo(() => new MelodicPreviewPlayer(), []);
  useEffect(() => () => player.stop(), [player]);

  const {
    cleanPCM, sampleRate, totalDurationSec, allSteps, bpm, beatsPerMeasure,
    measuresCount, pitchShiftSemitones, hasAnacrusis, t1OffsetSec, outputDeviceId,
    harmonyGrid, harmonyConfig,
  } = props;

  useEffect(() => {
    if (isPlaying && cleanPCM && cleanPCM.length > 0) {
      player.updateVoiceBuffer(cleanPCM, sampleRate);
    }
  }, [cleanPCM, sampleRate, isPlaying, player]);

  const handleTogglePlay = useCallback(async () => {
    if (isPlaying) { player.stop(); setIsPlaying(false); return; }
    setIsPlaying(true);
    await player.play({
      cleanPCM, sampleRate, totalDurationSec, allSteps, bpm, beatsPerMeasure,
      playMode, clickEnabled, pitchShiftSemitones, seekStartSec, hasAnacrusis,
      t1OffsetSec, outputDeviceId, harmonyGrid, harmonyConfig, measuresCount,
      onEnded: () => setIsPlaying(false),
    });
  }, [player, isPlaying, cleanPCM, sampleRate, totalDurationSec, allSteps, bpm, beatsPerMeasure, playMode, clickEnabled, pitchShiftSemitones, seekStartSec, hasAnacrusis, t1OffsetSec, outputDeviceId, harmonyGrid, harmonyConfig, measuresCount]);

  const handleSeek = useCallback((sec: number) => {
    setSeekStartSec(sec);
    if (isPlaying) {
      player.stop();
      player.play({
        cleanPCM, sampleRate, totalDurationSec, allSteps, bpm, beatsPerMeasure,
        playMode, clickEnabled, pitchShiftSemitones, seekStartSec: sec, hasAnacrusis,
        t1OffsetSec, outputDeviceId, harmonyGrid, harmonyConfig, measuresCount,
        onEnded: () => setIsPlaying(false),
      });
    }
  }, [isPlaying, player, cleanPCM, sampleRate, totalDurationSec, allSteps, bpm, beatsPerMeasure, playMode, clickEnabled, pitchShiftSemitones, hasAnacrusis, t1OffsetSec, outputDeviceId, harmonyGrid, harmonyConfig, measuresCount]);

  return {
    player, playMode, setPlayMode, clickEnabled, setClickEnabled,
    isPlaying, setIsPlaying, seekStartSec, setSeekStartSec,
    handleTogglePlay, handleSeek,
  };
}
