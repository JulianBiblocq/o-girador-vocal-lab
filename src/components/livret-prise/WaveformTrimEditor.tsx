import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { WaveformGridCanvas } from './WaveformGridCanvas';
import { WaveformOverlayCanvas } from './WaveformOverlayCanvas';
import { WaveformZoomBar } from './WaveformZoomBar';
import { PreviewControls } from './PreviewControls';
import { LatencyNudgeBar } from './LatencyNudgeBar';
import { PreviewPlayer } from '../../audio/PreviewPlayer';
import { useWaveformZoom } from '../../hooks/useWaveformZoom';
import { usePlayheadTracker } from '../../hooks/usePlayheadTracker';
import { computeAlignmentMeta } from '../../utils/alignmentMath';
import { getPatternT1OffsetSec, getPatternTotalDurationSec } from '../../utils/anacrusisTimingHelper';
import { generateVocalPack } from '../../utils/packGenerator';
import { getSavedLatencyOffsetMs } from '../../utils/latencyStorage';
import { useLanguage } from '../../i18n/LanguageContext';
import { ChordGridBar } from '../common/ChordGridBar';
import { HarmonyProfileSelector } from '../common/HarmonyProfileSelector';
import type { TimeSignatureString, VocalPackExport } from '../../types/vocalPack.types';
import type { PatternHarmonyGrid, HarmonyConfig } from '../../types/harmony.types';

export interface WaveformTrimEditorProps {
  rawPCM: Float32Array; sampleRate: number; bpm: number; timeSignature: TimeSignatureString;
  measuresCount: number; beatsPerMeasure: number; beatResolutions: number[]; referencePitch: string;
  initialTrimStartSec?: number; initialTrimEndSec?: number; initialT1OffsetSec?: number; hasAnacrusis?: boolean; outputDeviceId?: string;
  harmonyGrid?: PatternHarmonyGrid; harmonyConfig?: HarmonyConfig; pitchShiftSemitones?: number;
  onUpdateGrid?: (newGrid: PatternHarmonyGrid) => void; onUpdateHarmonyConfig?: (config: HarmonyConfig) => void;
  onReset: () => void; onTrimChange?: (startSec: number, endSec: number) => void; onT1OffsetChange?: (t1Sec: number) => void; onPackReady: (pack: VocalPackExport) => void;
}

export const WaveformTrimEditor: React.FC<WaveformTrimEditorProps> = (props) => {
  const {
    rawPCM, sampleRate, bpm, timeSignature, measuresCount, beatsPerMeasure,
    beatResolutions, referencePitch, initialTrimStartSec, initialTrimEndSec, initialT1OffsetSec,
    hasAnacrusis = true, outputDeviceId, harmonyGrid, harmonyConfig, pitchShiftSemitones = 0,
    onUpdateGrid, onUpdateHarmonyConfig, onReset, onTrimChange, onT1OffsetChange, onPackReady,
  } = props;
  const { t } = useLanguage(), containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);
  const player = useMemo(() => new PreviewPlayer(), []);
  const { zoomLevel, setZoom, zoomIn, zoomOut, scrollToSec, scrollContainerRef } = useWaveformZoom(1.0);

  const beatDuration = 60 / bpm, measureDurationSec = beatsPerMeasure * beatDuration;
  const [t1OffsetSec, setT1OffsetSec] = useState<number>(() => getPatternT1OffsetSec(hasAnacrusis, measureDurationSec, initialT1OffsetSec));
  useEffect(() => {
    if (typeof initialT1OffsetSec === 'number' && initialT1OffsetSec >= 0) setT1OffsetSec(initialT1OffsetSec);
  }, [initialT1OffsetSec]);

  const recordedDurationSec = rawPCM.length / sampleRate;
  const totalDurationSec = Math.max(recordedDurationSec, getPatternTotalDurationSec(hasAnacrusis, measuresCount, measureDurationSec, 0.25, beatDuration, t1OffsetSec));

  const [trimStartSec, setTrimStartSec] = useState<number>(() => initialTrimStartSec ?? 0);
  const [trimEndSec, setTrimEndSec] = useState<number>(() => (initialTrimEndSec && initialTrimEndSec > 0 ? initialTrimEndSec : totalDurationSec));
  const [latencyOffsetMs, setLatencyOffsetMs] = useState<number>(getSavedLatencyOffsetMs);
  const [isPlaying, setIsPlaying] = useState<boolean>(false), [clickEnabled, setClickEnabled] = useState<boolean>(true);
  const [highPassEnabled, setHighPassEnabled] = useState<boolean>(true), [tonePolishEnabled, setTonePolishEnabled] = useState<boolean>(true);

  const playheadSec = usePlayheadTracker(player, isPlaying, () => setIsPlaying(false));

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const obs = new ResizeObserver(([entry]) => { if (entry) setContainerWidth(Math.max(200, Math.floor(entry.contentRect.width))); });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => () => player.stop(), [player]);
  const alignment = useMemo(() => computeAlignmentMeta(t1OffsetSec, trimStartSec, trimEndSec, bpm, hasAnacrusis), [t1OffsetSec, trimStartSec, trimEndSec, bpm, hasAnacrusis]);

  const handleTogglePlay = useCallback(async () => {
    if (isPlaying) { player.stop(); setIsPlaying(false); return; }
    setIsPlaying(true);
    await player.play(rawPCM, sampleRate, {
      trimStartSec, trimEndSec, latencyOffsetMs, bpm, beatsPerMeasure, totalDurationSec,
      clickEnabled, hasAnacrusis, t1OffsetSec, highPassFilterEnabled: highPassEnabled, enableTonePolish: tonePolishEnabled, normalizeRMS: true, outputDeviceId,
      harmonyGrid, harmonyConfig, measuresCount, pitchShiftSemitones,
      onEnded: () => setIsPlaying(false),
    });
  }, [player, isPlaying, rawPCM, sampleRate, trimStartSec, trimEndSec, latencyOffsetMs, bpm, beatsPerMeasure, totalDurationSec, clickEnabled, hasAnacrusis, t1OffsetSec, highPassEnabled, tonePolishEnabled, outputDeviceId, harmonyGrid, harmonyConfig, measuresCount, pitchShiftSemitones]);

  const handleProceed = useCallback(() => {
    player.stop(); setIsPlaying(false);
    onPackReady(generateVocalPack({
      rawPCM, sampleRate, trimStartSec, trimEndSec, latencyOffsetMs, bpm, timeSignature,
      measuresCount, beatsPerMeasure, beatResolutions, referencePitch, alignment,
      highPassFilterEnabled: highPassEnabled, enableTonePolish: tonePolishEnabled, normalizeRMS: true,
    }));
  }, [player, rawPCM, sampleRate, trimStartSec, trimEndSec, latencyOffsetMs, bpm, timeSignature, measuresCount, beatsPerMeasure, beatResolutions, referencePitch, alignment, highPassEnabled, tonePolishEnabled, onPackReady]);

  const zoomedWidth = Math.max(containerWidth, Math.round(containerWidth * zoomLevel));

  return (
    <div className="flex flex-col gap-2 w-full">
      {harmonyConfig && onUpdateGrid && onUpdateHarmonyConfig && (
        <div className="cordel-card flex items-center justify-between gap-2 p-1.5 rounded">
          <ChordGridBar harmonyGrid={harmonyGrid} measuresCount={measuresCount} beatsPerMeasure={beatsPerMeasure} hasAnacrusis={hasAnacrusis} onUpdateGrid={onUpdateGrid} />
          <HarmonyProfileSelector config={harmonyConfig} onChange={onUpdateHarmonyConfig} />
        </div>
      )}
      <WaveformZoomBar
        zoomLevel={zoomLevel} onSetZoom={setZoom} onZoomIn={zoomIn} onZoomOut={zoomOut}
        onSeeStart={() => scrollToSec(trimStartSec, totalDurationSec, containerWidth)}
        onSeeEnd={() => scrollToSec(trimEndSec, totalDurationSec, containerWidth)}
      />
      <div ref={containerRef} className="w-full cordel-card overflow-hidden select-none rounded">
        <div ref={scrollContainerRef} className="w-full h-36 overflow-x-auto overflow-y-hidden relative cordel-scrollbar">
          <div style={{ width: `${zoomedWidth}px`, height: '144px', position: 'relative' }}>
            <WaveformGridCanvas width={zoomedWidth} height={144} totalDurationSec={totalDurationSec} t1OffsetSec={t1OffsetSec} hasAnacrusis={hasAnacrusis} bpm={bpm} measuresCount={measuresCount} beatsPerMeasure={beatsPerMeasure} beatResolutions={beatResolutions} />
            <WaveformOverlayCanvas rawPCM={rawPCM} sampleRate={sampleRate} width={zoomedWidth} height={144} totalDurationSec={totalDurationSec} trimStartSec={trimStartSec} trimEndSec={trimEndSec} latencyOffsetMs={latencyOffsetMs} playheadSec={playheadSec} isPlaying={isPlaying} onTrimChange={(s, e) => { setTrimStartSec(s); setTrimEndSec(e); onTrimChange?.(s, e); }} onLatencyOffsetChange={setLatencyOffsetMs} />
          </div>
        </div>
      </div>
      <p className="text-[11px] font-mono text-theme-ink/80 text-center leading-snug px-1">{t('trimHelpNotice')}</p>
      <div className="flex flex-col sm:flex-row items-center gap-2 w-full">
        <div className="flex-1 w-full"><LatencyNudgeBar latencyOffsetMs={latencyOffsetMs} onChange={setLatencyOffsetMs} disabled={isPlaying} /></div>
        <div className="cordel-card flex items-center justify-between gap-2 p-1.5 rounded text-xs font-mono shrink-0">
          <span className="font-bold text-theme-ink/80">{t('calageAnchorT1Label') || 'Ancre T1'}</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => { const n = Math.max(0, Math.round((t1OffsetSec - 0.01) * 1000) / 1000); setT1OffsetSec(n); onT1OffsetChange?.(n); }} className="cordel-btn px-1.5 py-0.5 text-xs font-mono font-bold cursor-pointer">◀ -10ms</button>
            <span className="font-bold text-theme-wood px-1">{t1OffsetSec.toFixed(3)}s</span>
            <button type="button" onClick={() => { const n = Math.round((t1OffsetSec + 0.01) * 1000) / 1000; setT1OffsetSec(n); onT1OffsetChange?.(n); }} className="cordel-btn px-1.5 py-0.5 text-xs font-mono font-bold cursor-pointer">+10ms ▶</button>
          </div>
        </div>
      </div>
      <PreviewControls
        isPlaying={isPlaying} onTogglePlay={handleTogglePlay} clickEnabled={clickEnabled} onToggleClick={() => setClickEnabled((p) => { const n = !p; player.setClickEnabled(n); return n; })}
        highPassEnabled={highPassEnabled} onToggleHighPass={() => setHighPassEnabled((v) => !v)} tonePolishEnabled={tonePolishEnabled} onToggleTonePolish={() => setTonePolishEnabled((p) => { const n = !p; player.setTonePolishEnabled(n); return n; })}
        onReset={onReset} onProceedToExtraction={handleProceed} alignment={alignment} hasAnacrusis={hasAnacrusis}
      />
    </div>
  );
};
