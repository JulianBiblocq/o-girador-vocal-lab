import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { WaveformGridCanvas } from './WaveformGridCanvas';
import { WaveformOverlayCanvas } from './WaveformOverlayCanvas';
import { WaveformZoomBar } from './WaveformZoomBar';
import { PreviewControls } from './PreviewControls';
import { LatencyNudgeBar } from './LatencyNudgeBar';
import { PreviewPlayer } from '../../audio/PreviewPlayer';
import { useWaveformZoom } from '../../hooks/useWaveformZoom';
import { computeAlignmentMeta } from '../../utils/alignmentMath';
import { generateVocalPack } from '../../utils/packGenerator';
import { getSavedLatencyOffsetMs } from '../../utils/latencyStorage';
import { useLanguage } from '../../i18n/LanguageContext';
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
  outputDeviceId?: string;
  onReset: () => void;
  onPackReady: (pack: VocalPackExport) => void;
}

export const WaveformTrimEditor: React.FC<WaveformTrimEditorProps> = (props) => {
  const { rawPCM, sampleRate, bpm, timeSignature, measuresCount, beatsPerMeasure, beatResolutions, referencePitch, outputDeviceId, onReset, onPackReady } = props;
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);
  const player = useMemo(() => new PreviewPlayer(), []);
  const { zoomLevel, setZoom, zoomIn, zoomOut, scrollToSec, scrollContainerRef } = useWaveformZoom(1.0);

  const beatDuration = 60 / bpm;
  const anacrusisDurationSec = beatsPerMeasure * beatDuration;
  const totalDurationSec = (beatsPerMeasure + measuresCount * beatsPerMeasure) * beatDuration;

  const [trimStartSec, setTrimStartSec] = useState<number>(0);
  const [trimEndSec, setTrimEndSec] = useState<number>(totalDurationSec);
  const [latencyOffsetMs, setLatencyOffsetMs] = useState<number>(getSavedLatencyOffsetMs);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playheadSec, setPlayheadSec] = useState<number>(-1);
  const [clickEnabled, setClickEnabled] = useState<boolean>(true);
  const [highPassEnabled, setHighPassEnabled] = useState<boolean>(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => { if (entry) setContainerWidth(Math.max(200, Math.floor(entry.contentRect.width))); });
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

  const alignment = useMemo(() => computeAlignmentMeta(anacrusisDurationSec, trimStartSec, trimEndSec, bpm), [anacrusisDurationSec, trimStartSec, trimEndSec, bpm]);

  const handleTogglePlay = useCallback(async () => {
    if (isPlaying) { player.stop(); setIsPlaying(false); return; }
    setIsPlaying(true);
    await player.play(rawPCM, sampleRate, {
      trimStartSec, trimEndSec, latencyOffsetMs, bpm, beatsPerMeasure, totalDurationSec,
      clickEnabled, highPassFilterEnabled: highPassEnabled, normalizeRMS: true, outputDeviceId,
      onEnded: () => setIsPlaying(false),
    });
  }, [player, isPlaying, rawPCM, sampleRate, trimStartSec, trimEndSec, latencyOffsetMs, bpm, beatsPerMeasure, totalDurationSec, clickEnabled, highPassEnabled, outputDeviceId]);

  const handleToggleClick = useCallback(() => {
    setClickEnabled((prev) => { const next = !prev; player.setClickEnabled(next); return next; });
  }, [player]);

  const handleProceed = useCallback(() => {
    player.stop();
    setIsPlaying(false);
    onPackReady(generateVocalPack({
      rawPCM, sampleRate, trimStartSec, trimEndSec, latencyOffsetMs, bpm, timeSignature,
      measuresCount, beatsPerMeasure, beatResolutions, referencePitch, alignment,
      highPassFilterEnabled: highPassEnabled, normalizeRMS: true,
    }));
  }, [player, rawPCM, sampleRate, trimStartSec, trimEndSec, latencyOffsetMs, bpm, timeSignature, measuresCount, beatsPerMeasure, beatResolutions, referencePitch, alignment, highPassEnabled, onPackReady]);

  const zoomedWidth = Math.max(containerWidth, Math.round(containerWidth * zoomLevel));

  return (
    <div className="flex flex-col gap-2 w-full">
      <WaveformZoomBar
        zoomLevel={zoomLevel} onSetZoom={setZoom} onZoomIn={zoomIn} onZoomOut={zoomOut}
        onSeeStart={() => scrollToSec(trimStartSec, totalDurationSec, containerWidth)}
        onSeeEnd={() => scrollToSec(trimEndSec, totalDurationSec, containerWidth)}
      />
      <div ref={containerRef} className="w-full cordel-card overflow-hidden select-none bg-black/40">
        <div ref={scrollContainerRef} className="w-full h-36 overflow-x-auto overflow-y-hidden relative cordel-scrollbar">
          <div style={{ width: `${zoomedWidth}px`, height: '144px', position: 'relative' }}>
            <WaveformGridCanvas
              width={zoomedWidth} height={144} totalDurationSec={totalDurationSec}
              anacrusisDurationSec={anacrusisDurationSec} measuresCount={measuresCount}
              beatsPerMeasure={beatsPerMeasure} beatResolutions={beatResolutions}
            />
            <WaveformOverlayCanvas
              rawPCM={rawPCM} sampleRate={sampleRate} width={zoomedWidth} height={144}
              totalDurationSec={totalDurationSec} trimStartSec={trimStartSec} trimEndSec={trimEndSec}
              latencyOffsetMs={latencyOffsetMs} playheadSec={playheadSec} isPlaying={isPlaying}
              onTrimChange={(s, e) => { setTrimStartSec(s); setTrimEndSec(e); }}
              onLatencyOffsetChange={setLatencyOffsetMs}
            />
          </div>
        </div>
      </div>
      <p className="text-[11px] font-mono text-theme-ink/80 text-center leading-snug px-1">
        {t('trimHelpNotice')}
      </p>
      <LatencyNudgeBar latencyOffsetMs={latencyOffsetMs} onChange={setLatencyOffsetMs} disabled={isPlaying} />
      <PreviewControls
        isPlaying={isPlaying} onTogglePlay={handleTogglePlay}
        clickEnabled={clickEnabled} onToggleClick={handleToggleClick}
        highPassEnabled={highPassEnabled} onToggleHighPass={() => setHighPassEnabled((v) => !v)}
        onReset={onReset} onProceedToExtraction={handleProceed} alignment={alignment}
      />
    </div>
  );
};
