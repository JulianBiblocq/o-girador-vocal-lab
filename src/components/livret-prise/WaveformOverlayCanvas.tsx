import React, { useEffect, useRef, useCallback } from 'react';
import { extractNormalizedPeaks } from '../../utils/peaksExtractor';
import { drawWaveformOverlay } from './waveformOverlayDrawer';
import { useLanguage } from '../../i18n/LanguageContext';

interface WaveformOverlayCanvasProps {
  rawPCM: Float32Array;
  sampleRate: number;
  width: number;
  height: number;
  totalDurationSec: number;
  trimStartSec: number;
  trimEndSec: number;
  latencyOffsetMs: number;
  onTrimChange: (start: number, end: number) => void;
  onTrimCommit?: (start: number, end: number) => void;
  onLatencyOffsetChange?: (offsetMs: number) => void;
  playheadSec: number;
  isPlaying: boolean;
}

export const WaveformOverlayCanvas: React.FC<WaveformOverlayCanvasProps> = ({
  rawPCM, width, height, totalDurationSec, trimStartSec, trimEndSec,
  latencyOffsetMs, onTrimChange, onTrimCommit, onLatencyOffsetChange, playheadSec, isPlaying,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksCacheRef = useRef<Float32Array | null>(null);
  const dragModeRef = useRef<'start' | 'end' | 'wave' | null>(null);
  const dragStartXRef = useRef<number>(0);
  const initialOffsetMsRef = useRef<number>(0);
  const latestTrimRef = useRef<{ start: number; end: number }>({ start: trimStartSec, end: trimEndSec });
  const { t } = useLanguage();
  const [themeTick, setThemeTick] = React.useState(0);

  useEffect(() => {
    latestTrimRef.current = { start: trimStartSec, end: trimEndSec };
  }, [trimStartSec, trimEndSec]);

  useEffect(() => {
    const obs = new MutationObserver(() => setThemeTick((v) => v + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    peaksCacheRef.current = extractNormalizedPeaks(rawPCM, Math.min(rawPCM.length, Math.max(600, width * 2)));
  }, [rawPCM, width]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawWaveformOverlay(ctx, {
      width, height, dpr, peaks: peaksCacheRef.current, totalDurationSec,
      trimStartSec, trimEndSec, latencyOffsetMs, playheadSec, isPlaying,
      trimStartLabel: t('trimStartFlag'),
      trimEndLabel: t('trimEndFlag'),
    });
  }, [width, height, totalDurationSec, trimStartSec, trimEndSec, latencyOffsetMs, playheadSec, isPlaying, t, themeTick]);

  useEffect(() => { draw(); }, [draw]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const xStart = (trimStartSec / totalDurationSec) * width;
    const xEnd = (trimEndSec / totalDurationSec) * width;

    if (x >= xStart - 14 && x <= xStart + 42) {
      dragModeRef.current = 'start';
    } else if (x >= xEnd - 42 && x <= xEnd + 14) {
      dragModeRef.current = 'end';
    } else if (onLatencyOffsetChange) {
      dragModeRef.current = 'wave';
      dragStartXRef.current = e.clientX;
      initialOffsetMsRef.current = latencyOffsetMs;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragModeRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(width, e.clientX - rect.left));
    const timeAtX = (x / width) * totalDurationSec;

    if (dragModeRef.current === 'start') {
      const nextStart = Math.min(trimEndSec - 0.05, Math.max(0, timeAtX));
      latestTrimRef.current = { start: nextStart, end: trimEndSec };
      onTrimChange(nextStart, trimEndSec);
    } else if (dragModeRef.current === 'end') {
      const nextEnd = Math.max(trimStartSec + 0.05, Math.min(totalDurationSec, timeAtX));
      latestTrimRef.current = { start: trimStartSec, end: nextEnd };
      onTrimChange(trimStartSec, nextEnd);
    } else if (dragModeRef.current === 'wave' && onLatencyOffsetChange) {
      const deltaPx = e.clientX - dragStartXRef.current;
      const deltaSec = (deltaPx / width) * totalDurationSec;
      onLatencyOffsetChange(initialOffsetMsRef.current + Math.round(deltaSec * 1000));
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragModeRef.current) {
      const mode = dragModeRef.current;
      dragModeRef.current = null;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      if (mode === 'start' || mode === 'end') {
        onTrimCommit?.(latestTrimRef.current.start, latestTrimRef.current.end);
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="absolute inset-0 cursor-ew-resize touch-none select-none"
    />
  );
};
