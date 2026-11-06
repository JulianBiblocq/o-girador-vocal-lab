/**
 * SlicerSegmentWaveform.tsx
 * Canvas interactif avec Zoom horizontal (1x..12x + Molette), défilement et précision chirurgicale (< 140 lignes).
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { SliceSegment } from '../../types/slicerSegments.types';
import { drawSegmentWaveform } from './slicerSegmentDrawer';
import { calculateSliceMetricT1Sec, splitSliceSegment } from '../../utils/slicerAlignmentHelper';
import { useSlicerViewport, SLICER_ZOOM_PRESETS, formatSlicerDragTooltip } from './useSlicerViewport';

interface SlicerSegmentWaveformProps {
  pcm: Float32Array; durationSec: number; segments: SliceSegment[]; selectedSegmentId: string | null;
  playheadSec: number; bpm: number; gridOffsetSec: number; cascadeMove?: boolean;
  onSegmentsChange: (segments: SliceSegment[]) => void; onSelectSegment: (id: string | null) => void;
  onSeek: (sec: number) => void; onAddSegmentAtSec: (sec: number) => void; onGridOffsetChange?: (offset: number) => void;
}

export const SlicerSegmentWaveform: React.FC<SlicerSegmentWaveformProps> = ({
  pcm, durationSec, segments, selectedSegmentId, playheadSec, bpm, gridOffsetSec, cascadeMove = false,
  onSegmentsChange, onSelectSegment, onSeek, onAddSegmentAtSec, onGridOffsetChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null), [dragTooltip, setDragTooltip] = useState<string | null>(null);
  const dragRef = useRef<{ mode: 'body' | 'start' | 'end' | 'grid' | 'joint' | 'pan'; segId?: string; segId2?: string; startSec: number; startX?: number; origScroll?: number; origStart?: number; origEnd?: number } | null>(null);
  const { zoomLevel, scrollStartSec, visibleDurationSec, maxScrollSec, isInteractingRef, setScrollStartSec, setZoomWithAnchor, panBySec, secToX, xToSec, getSecPerPixel } = useSlicerViewport({ durationSec, segments, selectedSegmentId, playheadSec });

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect(), x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    return { x, sec: xToSec(x, rect.width), width: rect.width };
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth, h = canvas.clientHeight, dpr = window.devicePixelRatio || 1;
    if (w <= 0 || h <= 0) return;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    const ctx = canvas.getContext('2d');
    if (ctx) drawSegmentWaveform(ctx, { width: w, height: h, dpr, pcm, durationSec, segments, selectedSegmentId, playheadSec, bpm, gridOffsetSec, viewStartSec: scrollStartSec, viewDurationSec: visibleDurationSec, zoomLevel });
  }, [pcm, durationSec, segments, selectedSegmentId, playheadSec, bpm, gridOffsetSec, scrollStartSec, visibleDurationSec, zoomLevel]);

  useEffect(() => { render(); }, [render]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, sec, width } = getCanvasCoords(e);
    isInteractingRef.current = true;
    if (e.button === 1 || e.altKey) { e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { mode: 'pan', startSec: sec, startX: x, origScroll: scrollStartSec }; return; }
    if (e.shiftKey) { e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { mode: 'grid', startSec: sec }; return; }
    const hitTolPx = 9;
    for (let i = 0; i < segments.length - 1; i++) {
      const s1 = segments[i], s2 = segments[i + 1];
      if (Math.abs(s1.endSec - s2.startSec) <= 0.05 && Math.abs(x - secToX(s1.endSec, width)) <= hitTolPx) {
        e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { mode: 'joint', segId: s1.id, segId2: s2.id, startSec: sec };
        setDragTooltip(formatSlicerDragTooltip('joint', s1.endSec, bpm, gridOffsetSec)); onSelectSegment(s1.id); return;
      }
    }
    for (const seg of segments) {
      if (Math.abs(x - secToX(seg.startSec, width)) <= hitTolPx) {
        e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { mode: 'start', segId: seg.id, startSec: sec, origStart: seg.startSec }; onSelectSegment(seg.id); return;
      }
      if (Math.abs(x - secToX(seg.endSec, width)) <= hitTolPx) {
        e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { mode: 'end', segId: seg.id, startSec: sec, origEnd: seg.endSec }; onSelectSegment(seg.id); return;
      }
    }
    const clickedSeg = segments.find((s) => sec >= s.startSec && sec <= s.endSec);
    if (clickedSeg) {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { mode: 'body', segId: clickedSeg.id, startSec: sec, origStart: clickedSeg.startSec, origEnd: clickedSeg.endSec };
      onSelectSegment(clickedSeg.id);
    } else { isInteractingRef.current = false; onSelectSegment(null); onSeek(sec); }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const { x, sec, width } = getCanvasCoords(e);
    const { mode, segId, segId2, startSec, startX = 0, origScroll = 0, origStart = 0, origEnd = 0 } = dragRef.current;
    if (mode === 'pan') { setScrollStartSec(origScroll - (x - startX) * getSecPerPixel(width)); return; }
    const delta = sec - startSec;
    if (mode === 'grid') {
      const newOff = Math.max(0, Math.round((gridOffsetSec + delta) * 1000) / 1000);
      onGridOffsetChange?.(newOff); setDragTooltip(formatSlicerDragTooltip('grid', newOff, bpm, newOff)); dragRef.current.startSec = sec; return;
    }
    if (mode === 'joint') {
      const cut = Math.max(0.05, Math.min(durationSec - 0.05, sec));
      setDragTooltip(formatSlicerDragTooltip('joint', cut, bpm, gridOffsetSec));
      onSegmentsChange(segments.map((s) => s.id === segId ? { ...s, endSec: cut } : s.id === segId2 ? { ...s, startSec: cut, metricT1Sec: calculateSliceMetricT1Sec(cut, bpm, gridOffsetSec, s.hasAnacrusis, s.anacrusisBeats, s.metricT1Sec) } : s)); return;
    }
    if (mode === 'body' && segId) {
      const segIdx = segments.findIndex((s) => s.id === segId);
      if (segIdx < 0) return;
      const targetSeg = segments[segIdx], beatDur = 60 / (bpm || 88), measureDur = beatDur * 4;
      const anacDur = targetSeg.hasAnacrusis !== false ? (targetSeg.anacrusisBeats ?? 2) * beatDur : 0;
      const rawTargetT1 = origStart + delta + anacDur, nearestT1 = Math.round((rawTargetT1 - gridOffsetSec) / measureDur) * measureDur + gridOffsetSec;
      const snapT1 = Math.abs(rawTargetT1 - nearestT1) < 0.35 / zoomLevel ? nearestT1 : rawTargetT1;
      const clampedStart = Math.max(0, snapT1 - anacDur), shift = clampedStart - targetSeg.startSec;
      setDragTooltip(formatSlicerDragTooltip('body', snapT1, bpm, gridOffsetSec));
      onSegmentsChange(segments.map((s, idx) => s.id === segId ? { ...s, startSec: clampedStart, endSec: Math.min(durationSec, clampedStart + (origEnd - origStart)), metricT1Sec: snapT1 } : (cascadeMove && idx > segIdx) ? { ...s, startSec: Math.max(0, s.startSec + shift), endSec: Math.min(durationSec, s.endSec + shift), metricT1Sec: (s.metricT1Sec ?? s.startSec) + shift } : s));
    } else if (segId) {
      const curSeg = segments.find((s) => s.id === segId);
      const targetVal = mode === 'start' ? Math.max(0, Math.min(sec, (curSeg?.endSec ?? durationSec) - 0.1)) : Math.min(durationSec, Math.max(sec, (curSeg?.startSec ?? 0) + 0.1));
      setDragTooltip(formatSlicerDragTooltip(mode, targetVal, bpm, gridOffsetSec));
      onSegmentsChange(segments.map((s) => s.id !== segId ? s : mode === 'start' ? { ...s, startSec: targetVal, metricT1Sec: calculateSliceMetricT1Sec(targetVal, bpm, gridOffsetSec, s.hasAnacrusis, s.anacrusisBeats, s.metricT1Sec) } : { ...s, endSec: targetVal }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} dragRef.current = null; }
    isInteractingRef.current = false; setDragTooltip(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.shiftKey && zoomLevel > 1) { panBySec((e.deltaY > 0 ? 0.12 : -0.12) * visibleDurationSec); return; }
    const { x, sec, width } = getCanvasCoords(e);
    setZoomWithAnchor(zoomLevel * (e.deltaY < 0 ? 1.25 : 0.8), width > 0 ? x / width : 0.5, sec);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { sec } = getCanvasCoords(e), seg = segments.find((s) => sec > s.startSec + 0.25 && sec < s.endSec - 0.25);
    if (seg) { const [s1, s2] = splitSliceSegment(seg, sec, bpm, gridOffsetSec); onSegmentsChange(segments.flatMap((s) => (s.id === seg.id ? [s1, s2] : [s]))); onSelectSegment(s2.id); }
    else onAddSegmentAtSec(sec);
  };

  return (
    <div className="flex flex-col gap-1 select-none">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1 bg-[var(--cordel-panel)] border border-[var(--cordel-border-panel)] rounded text-[10px] font-mono">
        <div className="flex items-center gap-1">
          <span className="font-bold text-amber-500 mr-1">Zoom :</span>
          <button type="button" onClick={() => setZoomWithAnchor(zoomLevel / 1.5)} className="px-1.5 py-0.5 rounded bg-[var(--cordel-surface)] border border-[var(--cordel-border-panel)] hover:border-amber-500 cursor-pointer font-bold">-</button>
          {SLICER_ZOOM_PRESETS.map((z) => <button key={z} type="button" onClick={() => setZoomWithAnchor(z)} className={`px-1.5 py-0.5 rounded border cursor-pointer font-bold ${Math.round(zoomLevel) === z ? 'bg-amber-600 text-white border-amber-500' : 'bg-[var(--cordel-surface)] border-[var(--cordel-border-panel)] hover:border-amber-500'}`}>{z}x</button>)}
          <button type="button" onClick={() => setZoomWithAnchor(zoomLevel * 1.5)} className="px-1.5 py-0.5 rounded bg-[var(--cordel-surface)] border border-[var(--cordel-border-panel)] hover:border-amber-500 cursor-pointer font-bold">+</button>
        </div>
        {dragTooltip ? <span className="px-2 py-0.5 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-600 font-bold">{dragTooltip}</span> : <span className="opacity-75">{scrollStartSec.toFixed(1)}s – {(scrollStartSec + visibleDurationSec).toFixed(1)}s / {durationSec.toFixed(1)}s (Molette: Zoom • Alt+Glisser: Pan)</span>}
      </div>
      <div className="w-full h-36 bg-[var(--cordel-surface)] border border-[var(--cordel-border-panel)] rounded relative"><canvas ref={canvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onWheel={handleWheel} onDoubleClick={handleDoubleClick} onContextMenu={(e) => e.preventDefault()} className="w-full h-full block cursor-crosshair" /></div>
      {zoomLevel > 1 && <input type="range" min={0} max={maxScrollSec} step={0.01} value={scrollStartSec} onChange={(e) => setScrollStartSec(parseFloat(e.target.value))} className="w-full h-1.5 accent-amber-500 cursor-ew-resize" title="Défilement horizontal de l'onde" />}
    </div>
  );
};
