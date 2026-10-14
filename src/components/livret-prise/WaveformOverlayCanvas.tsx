import React, { useEffect, useRef, useCallback } from 'react';
import { extractNormalizedPeaks } from '../../utils/peaksExtractor';

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
  onLatencyOffsetChange?: (offsetMs: number) => void;
  playheadSec: number;
  isPlaying: boolean;
}

export const WaveformOverlayCanvas: React.FC<WaveformOverlayCanvasProps> = ({
  rawPCM, width, height, totalDurationSec, trimStartSec, trimEndSec,
  latencyOffsetMs, onTrimChange, onLatencyOffsetChange, playheadSec, isPlaying,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksCacheRef = useRef<Float32Array | null>(null);
  const dragModeRef = useRef<'start' | 'end' | 'wave' | null>(null);
  const dragStartXRef = useRef<number>(0);
  const initialOffsetMsRef = useRef<number>(0);

  useEffect(() => {
    peaksCacheRef.current = extractNormalizedPeaks(rawPCM, 600);
  }, [rawPCM]);

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

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const offsetSec = latencyOffsetMs / 1000;
    const xOffset = (offsetSec / totalDurationSec) * width;
    const xTrimStart = Math.max(0, (trimStartSec / totalDurationSec) * width);
    const xTrimEnd = Math.min(width, (trimEndSec / totalDurationSec) * width);
    const cy = height / 2;

    const peaks = peaksCacheRef.current;
    if (peaks) {
      const bins = peaks.length;
      const barWidth = width / bins;
      for (let i = 0; i < bins; i++) {
        const x = (i * barWidth) + xOffset;
        if (x < -barWidth || x > width) continue;
        const amp = peaks[i] * (height / 2);
        const isInTrim = x >= xTrimStart && x <= xTrimEnd;
        ctx.fillStyle = isInTrim ? '#ab3a26' : 'rgba(244, 236, 216, 0.2)';
        ctx.fillRect(x, cy - amp, Math.max(1, barWidth - 0.5), amp * 2);
      }
    }

    // Assombrissement des zones rognées
    ctx.fillStyle = 'rgba(10, 10, 10, 0.65)';
    ctx.fillRect(0, 0, xTrimStart, height);
    ctx.fillRect(xTrimEnd, 0, width - xTrimEnd, height);

    // Poignées Début & Fin
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(xTrimStart, 0); ctx.lineTo(xTrimStart, height); ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(xTrimStart - 4, 0, 8, 14); ctx.fillRect(xTrimStart - 4, height - 14, 8, 14);

    ctx.strokeStyle = '#f87171';
    ctx.beginPath(); ctx.moveTo(xTrimEnd, 0); ctx.lineTo(xTrimEnd, height); ctx.stroke();
    ctx.fillStyle = '#f87171';
    ctx.fillRect(xTrimEnd - 4, 0, 8, 14); ctx.fillRect(xTrimEnd - 4, height - 14, 8, 14);

    // Tête de lecture temps réel calée sur l'axe de la grille
    if (isPlaying && playheadSec >= 0) {
      const xPlay = (playheadSec / totalDurationSec) * width;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xPlay, 0); ctx.lineTo(xPlay, height); ctx.stroke();
    }
    ctx.restore();
  }, [width, height, totalDurationSec, trimStartSec, trimEndSec, latencyOffsetMs, playheadSec, isPlaying]);

  useEffect(() => { draw(); }, [draw]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const xStart = (trimStartSec / totalDurationSec) * width;
    const xEnd = (trimEndSec / totalDurationSec) * width;

    if (Math.abs(x - xStart) <= 18) {
      dragModeRef.current = 'start';
    } else if (Math.abs(x - xEnd) <= 18) {
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
      onTrimChange(Math.min(trimEndSec - 0.05, Math.max(0, timeAtX)), trimEndSec);
    } else if (dragModeRef.current === 'end') {
      onTrimChange(trimStartSec, Math.max(trimStartSec + 0.05, Math.min(totalDurationSec, timeAtX)));
    } else if (dragModeRef.current === 'wave' && onLatencyOffsetChange) {
      const deltaPx = e.clientX - dragStartXRef.current;
      const deltaSec = (deltaPx / width) * totalDurationSec;
      const deltaMs = Math.round(deltaSec * 1000);
      onLatencyOffsetChange(initialOffsetMsRef.current + deltaMs);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragModeRef.current) {
      dragModeRef.current = null;
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="absolute inset-0 cursor-ew-resize touch-none select-none"
    />
  );
};
