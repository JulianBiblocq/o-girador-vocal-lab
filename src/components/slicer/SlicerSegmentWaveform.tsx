/**
 * SlicerSegmentWaveform.tsx
 * Canvas interactif avec magnétisme sur grille Métronome et Shift+Glisser calage (< 145 lignes).
 */
import React, { useRef, useEffect, useCallback } from 'react';
import type { SliceSegment } from '../../types/slicerSegments.types';
import { drawSegmentWaveform } from './slicerSegmentDrawer';

interface SlicerSegmentWaveformProps {
  pcm: Float32Array; durationSec: number; segments: SliceSegment[]; selectedSegmentId: string | null;
  playheadSec: number; bpm: number; gridOffsetSec: number; cascadeMove?: boolean;
  onSegmentsChange: (segments: SliceSegment[]) => void; onSelectSegment: (id: string | null) => void;
  onSeek: (sec: number) => void; onAddSegmentAtSec: (sec: number) => void;
  onGridOffsetChange?: (offset: number) => void;
}

export const SlicerSegmentWaveform: React.FC<SlicerSegmentWaveformProps> = ({
  pcm, durationSec, segments, selectedSegmentId, playheadSec, bpm, gridOffsetSec, cascadeMove = false,
  onSegmentsChange, onSelectSegment, onSeek, onAddSegmentAtSec, onGridOffsetChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ mode: 'body' | 'start' | 'end' | 'grid'; segId?: string; startSec: number; origStart?: number; origEnd?: number } | null>(null);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    return { x, sec: durationSec > 0 ? (x / rect.width) * durationSec : 0, width: rect.width };
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
    drawSegmentWaveform(ctx, { width: w, height: h, dpr, pcm, durationSec, segments, selectedSegmentId, playheadSec, bpm, gridOffsetSec });
  }, [pcm, durationSec, segments, selectedSegmentId, playheadSec, bpm, gridOffsetSec]);

  useEffect(() => { render(); }, [render]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, sec, width } = getCanvasCoords(e);
    if (e.shiftKey) {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { mode: 'grid', startSec: sec };
      return;
    }

    const hitTolPx = 9;
    for (let i = 0; i < segments.length - 1; i++) {
      const s1 = segments[i], s2 = segments[i + 1];
      if (Math.abs(s1.endSec - s2.startSec) <= 0.05 && Math.abs(x - (s1.endSec / durationSec) * width) <= hitTolPx) {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = { mode: 'joint', segId: s1.id, segId2: s2.id, startSec: sec } as any;
        onSelectSegment(s1.id); return;
      }
    }
    for (const seg of segments) {
      const xs = (seg.startSec / durationSec) * width, xe = (seg.endSec / durationSec) * width;
      if (Math.abs(x - xs) <= hitTolPx) {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = { mode: 'start', segId: seg.id, startSec: sec, origStart: seg.startSec };
        onSelectSegment(seg.id); return;
      }
      if (Math.abs(x - xe) <= hitTolPx) {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = { mode: 'end', segId: seg.id, startSec: sec, origEnd: seg.endSec };
        onSelectSegment(seg.id); return;
      }
    }
    const clickedSeg = segments.find((s) => sec >= s.startSec && sec <= s.endSec);
    if (clickedSeg) {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { mode: 'body', segId: clickedSeg.id, startSec: sec, origStart: clickedSeg.startSec, origEnd: clickedSeg.endSec };
      onSelectSegment(clickedSeg.id);
    } else { onSelectSegment(null); onSeek(sec); }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const { sec } = getCanvasCoords(e);
    const { mode, segId, startSec, origStart = 0, origEnd = 0 } = dragRef.current as any;
    const delta = sec - startSec;

    if (mode === 'grid') {
      const newOff = Math.max(0, gridOffsetSec + delta);
      onGridOffsetChange?.(Math.round(newOff * 100) / 100);
      dragRef.current.startSec = sec;
      return;
    }
    if (mode === 'joint') {
      const { segId: sId1, segId2: sId2 } = dragRef.current as any;
      const cut = Math.max(0.1, Math.min(durationSec - 0.1, sec));
      onSegmentsChange(segments.map((s) => s.id === sId1 ? { ...s, endSec: cut } : s.id === sId2 ? { ...s, startSec: cut } : s));
      return;
    }
    if (mode === 'body' && segId) {
      const segIdx = segments.findIndex((s) => s.id === segId);
      if (segIdx < 0) return;
      const targetSeg = segments[segIdx];
      const beatDur = 60 / (bpm || 55), measureDur = beatDur * 4;
      const anacDur = targetSeg.hasAnacrusis !== false ? (targetSeg.anacrusisBeats ?? 2) * beatDur : 0;
      const rawTargetT1 = origStart + delta + anacDur;
      const nearestT1 = Math.round((rawTargetT1 - gridOffsetSec) / measureDur) * measureDur + gridOffsetSec;
      const snapT1 = Math.abs(rawTargetT1 - nearestT1) < 0.35 ? nearestT1 : rawTargetT1;
      const clampedStart = Math.max(0, snapT1 - anacDur);
      const shift = clampedStart - targetSeg.startSec;

      onSegmentsChange(segments.map((s, idx) => {
        if (s.id === segId) { const len = origEnd - origStart; return { ...s, startSec: clampedStart, endSec: Math.min(durationSec, clampedStart + len) }; }
        if (cascadeMove && idx > segIdx) return { ...s, startSec: Math.max(0, s.startSec + shift), endSec: Math.min(durationSec, s.endSec + shift) };
        return s;
      }));
    } else if (segId) {
      onSegmentsChange(segments.map((s) => s.id !== segId ? s : mode === 'start'
        ? { ...s, startSec: Math.max(0, Math.min(sec, s.endSec - 0.2)) }
        : { ...s, endSec: Math.min(durationSec, Math.max(sec, s.startSec + 0.2)) }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} dragRef.current = null; }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { sec } = getCanvasCoords(e);
    const seg = segments.find((s) => sec > s.startSec + 0.35 && sec < s.endSec - 0.35);
    if (seg) {
      const cut = Math.round(sec * 100) / 100;
      const s1: SliceSegment = { ...seg, endSec: cut };
      const s2: SliceSegment = { ...seg, id: `seg-${Date.now()}`, startSec: cut, metricT1Sec: cut, targetPatternId: 'new' };
      onSegmentsChange(segments.flatMap((s) => s.id === seg.id ? [s1, s2] : [s]));
      onSelectSegment(s2.id);
    } else { onAddSegmentAtSec(sec); }
  };

  return (
    <div className="w-full h-36 bg-[var(--cordel-surface)] border border-[var(--cordel-border-panel)] rounded relative select-none">
      <canvas
        ref={canvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick} onContextMenu={(e) => e.preventDefault()} className="w-full h-full block cursor-crosshair"
      />
    </div>
  );
};
