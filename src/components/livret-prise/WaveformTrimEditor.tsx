import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { WaveformGridCanvas } from './WaveformGridCanvas';
import { WaveformOverlayCanvas } from './WaveformOverlayCanvas';
import { PreviewControls } from './PreviewControls';
import { PreviewPlayer } from '../../audio/PreviewPlayer';
import { computeAlignmentMeta } from '../../utils/alignmentMath';
import { generateVocalPack } from '../../utils/packGenerator';
import type { TimeSignatureString, VocalPackExport } from '../../types/vocalPack.types';

interface WaveformTrimEditorProps {
  rawPCM: Float32Array;
  sampleRate: number;
  bpm: number;
  timeSignature: TimeSignatureString;
  measuresCount: number;
  beatsPerMeasure: number;
  beatResolutions: number[];
  referencePitch: string;
  onReset: () => void;
  onPackReady: (pack: VocalPackExport) => void;
}

export const WaveformTrimEditor: React.FC<WaveformTrimEditorProps> = ({
  rawPCM, sampleRate, bpm, timeSignature, measuresCount,
  beatsPerMeasure, beatResolutions, referencePitch, onReset, onPackReady,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);
  const player = useMemo(() => new PreviewPlayer(), []);

  const beatDuration = 60 / bpm;
  const anacrusisDurationSec = beatsPerMeasure * beatDuration;
  const totalDurationSec = (beatsPerMeasure + measuresCount * beatsPerMeasure) * beatDuration;

  const [trimStartSec, setTrimStartSec] = useState<number>(0);
  const [trimEndSec, setTrimEndSec] = useState<number>(totalDurationSec);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playheadSec, setPlayheadSec] = useState<number>(-1);
  const [clickEnabled, setClickEnabled] = useState<boolean>(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(Math.max(200, Math.floor(entry.contentRect.width)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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

  const alignment = useMemo(() => {
    return computeAlignmentMeta(anacrusisDurationSec, trimStartSec, trimEndSec, bpm);
  }, [anacrusisDurationSec, trimStartSec, trimEndSec, bpm]);

  const handleTogglePlay = useCallback(async () => {
    if (isPlaying) { player.stop(); setIsPlaying(false); return; }
    setIsPlaying(true);
    await player.play(rawPCM, sampleRate, {
      trimStartSec, trimEndSec, bpm, beatsPerMeasure, totalDurationSec, clickEnabled,
      onEnded: () => setIsPlaying(false),
    });
  }, [player, isPlaying, rawPCM, sampleRate, trimStartSec, trimEndSec, bpm, beatsPerMeasure, totalDurationSec, clickEnabled]);

  const handleProceed = useCallback(() => {
    player.stop();
    setIsPlaying(false);
    const pack = generateVocalPack({
      rawPCM, sampleRate, trimStartSec, trimEndSec, bpm, timeSignature,
      measuresCount, beatsPerMeasure, beatResolutions, referencePitch, alignment,
    });
    onPackReady(pack);
  }, [player, rawPCM, sampleRate, trimStartSec, trimEndSec, bpm, timeSignature, measuresCount, beatsPerMeasure, beatResolutions, referencePitch, alignment, onPackReady]);

  return (
    <div className="flex flex-col gap-3 w-full">
      <div ref={containerRef} className="w-full h-36 relative cordel-card overflow-hidden select-none bg-black/40">
        <WaveformGridCanvas
          width={containerWidth} height={144} totalDurationSec={totalDurationSec}
          anacrusisDurationSec={anacrusisDurationSec} measuresCount={measuresCount}
          beatsPerMeasure={beatsPerMeasure} beatResolutions={beatResolutions}
        />
        <WaveformOverlayCanvas
          rawPCM={rawPCM} sampleRate={sampleRate} width={containerWidth} height={144}
          totalDurationSec={totalDurationSec} trimStartSec={trimStartSec} trimEndSec={trimEndSec}
          onTrimChange={(s, e) => { setTrimStartSec(s); setTrimEndSec(e); }}
          playheadSec={playheadSec} isPlaying={isPlaying}
        />
      </div>

      <PreviewControls
        isPlaying={isPlaying} onTogglePlay={handleTogglePlay}
        clickEnabled={clickEnabled} onToggleClick={() => setClickEnabled((v) => !v)}
        onReset={onReset} onProceedToExtraction={handleProceed} alignment={alignment}
      />
    </div>
  );
};
