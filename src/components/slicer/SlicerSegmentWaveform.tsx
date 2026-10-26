/**
 * SlicerSegmentWaveform.tsx
 * Canvas interactif multi-tranches avec poignées déplaçables et tête de lecture (< 140 lignes).
 */
import React, { useRef, useEffect, useCallback } from 'react';
import type { SliceSegment } from '../../types/slicerSegments.types';
import { drawSegmentWaveform } from './slicerSegmentDrawer';

interface SlicerSegmentWaveformProps {
  pcm: Float32Array;
  durationSec: number;
  segments: SliceSegment[];
  selectedSegmentId: string | null;
  playheadSec: number;
  onSegmentsChange: (segments: SliceSegment[]) => void;
  onSelectSegment: (id: string | null) => void;
  onSeek: (sec: number) => void;
  onAddSegmentAtSec: (sec: number) => void;
}

export const SlicerSegmentWaveform: React.FC<SlicerSegmentWaveformProps> = ({
  pcm, durationSec, segments, selectedSegmentId, playheadSec,
  onSegmentsChange, onSelectSegment, onSeek, onAddSegmentAtSec,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ segId: string; handle: 'start' | 'end' } | null>(null);

  const getCanvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const sec = durationSec > 0 ? (x / rect.width) * durationSec : 0;
    return { x, sec, width: rect.width };
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w <= 0 || h <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawSegmentWaveform(ctx, { width: w, height: h, dpr, pcm, durationSec, segments, selectedSegmentId, playheadSec });
  }, [pcm, durationSec, segments, selectedSegmentId, playheadSec]);

  useEffect(() => { render(); }, [render]);

  const findHitHandle = (x: number, width: number): { segId: string; handle: 'start' | 'end' } | null => {
    const hitTolPx = 9;
    for (const seg of segments) {
      const xs = (seg.startSec / durationSec) * width;
      const xe = (seg.endSec / durationSec) * width;
      if (Math.abs(x - xs) <= hitTolPx) return { segId: seg.id, handle: 'start' };
      if (Math.abs(x - xe) <= hitTolPx) return { segId: seg.id, handle: 'end' };
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, sec, width } = getCanvasCoords(e);
    const hit = findHitHandle(x, width);
    if (hit) {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = hit;
      onSelectSegment(hit.segId);
      return;
    }

    const clickedSeg = segments.find((s) => sec >= s.startSec && sec <= s.endSec);
    if (clickedSeg) onSelectSegment(clickedSeg.id);
    else onSelectSegment(null);

    onSeek(sec);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const { sec } = getCanvasCoords(e);
    const { segId, handle } = dragRef.current;

    const next = segments.map((s) => {
      if (s.id !== segId) return s;
      if (handle === 'start') {
        return { ...s, startSec: Math.max(0, Math.min(sec, s.endSec - 0.2)) };
      }
      return { ...s, endSec: Math.min(durationSec, Math.max(sec, s.startSec + 0.2)) };
    });
    onSegmentsChange(next);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    dragRef.current = null;
  };

  const handleDoubleClick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { sec } = getCanvasCoords(e);
    onAddSegmentAtSec(sec);
  };

  return (
    <div className="w-full h-36 bg-[var(--cordel-surface)] border border-[var(--cordel-border-panel)] rounded relative select-none">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full block cursor-crosshair"
      />
    </div>
  );
};
