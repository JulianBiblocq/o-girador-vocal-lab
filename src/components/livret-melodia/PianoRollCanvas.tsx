import React, { useEffect, useRef, useCallback } from 'react';
import type { PitchCurvePoint, VocalStepData, MelodyneRegion } from '../../types/vocalPack.types';
import { drawPianoRollGrid } from './pianoRollDrawer';
import { drawMelodyneRegions } from './melodyneRegionDrawer';
import { findRegionHandleAt } from './melodyneRegionInteractions';
import { findBrickRange, moveBrick, resizeBrick, glueBrickToPrevious, splitTieAtStep, eraseBrick, createSingleNote, type PianoRollTool } from './pianoRollInteractions';
import { getToolCursorStyle } from '../../utils/toolCursors';

export interface PianoRollCanvasProps {
  width: number; height: number; minMidi: number; maxMidi: number; rowHeight: number;
  beatsPerMeasure: number; beatResolutions: number[]; allSteps: VocalStepData[]; pitchCurve: PitchCurvePoint[];
  totalDurationSec: number; anacrusisDurationSec: number; seekStartSec: number; isPlaying: boolean;
  activeTool: PianoRollTool; regions?: MelodyneRegion[]; selectedRegionId?: string | null;
  hasAnacrusis?: boolean; t1OffsetSec?: number; bpm?: number; selectedStepIdx?: number | null;
  getPlayheadSec?: () => number; onOpenContextMenu: (x: number, y: number) => void;
  onUpdateSteps: (newSteps: VocalStepData[], commit?: boolean) => void; onPlayNotePreview: (midi: number) => void;
  onOpenTextInput: (stepIndex: number, rect: { x: number; y: number; w: number; h: number }) => void;
  onSelectRegion?: (id: string | null) => void; onAddRegion?: (startSec: number, endSec: number) => void;
  onUpdateRegionBounds?: (id: string, startSec: number, endSec: number) => void;
  onSelectStep?: (idx: number | null) => void;
  readOnly?: boolean;
}

export const PianoRollCanvas: React.FC<PianoRollCanvasProps> = (p) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<any>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || p.width <= 0 || p.height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== p.width * dpr || canvas.height !== p.height * dpr) {
      canvas.width = p.width * dpr; canvas.height = p.height * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const playhead = p.isPlaying && p.getPlayheadSec ? p.getPlayheadSec() : -1;
    drawPianoRollGrid(ctx, { ...p, dpr, playheadSec: playhead });
    drawMelodyneRegions(ctx, { ...p, regions: p.regions || [], selectedRegionId: p.selectedRegionId ?? null });
  }, [p]);

  useEffect(() => {
    draw();
    if (!p.isPlaying) return;
    let animId = requestAnimationFrame(function tick() { draw(); animId = requestAnimationFrame(tick); });
    return () => cancelAnimationFrame(animId);
  }, [p.isPlaying, draw]);

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(p.width - 1, e.clientX - rect.left));
    const y = Math.max(0, Math.min(p.height - 1, e.clientY - rect.top));
    const stepIdx = p.allSteps.length > 0 ? Math.min(p.allSteps.length - 1, Math.floor((x / p.width) * p.allSteps.length)) : 0;
    const rowIdx = Math.max(0, Math.floor(y / p.rowHeight));
    return { stepIdx, midi: p.maxMidi - Math.min(p.maxMidi - p.minMidi, rowIdx), x, y, sec: (x / p.width) * p.totalDurationSec };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { stepIdx, midi, x, sec } = getCoords(e);
    if (e.button === 2) { e.preventDefault(); e.stopPropagation(); if (!p.readOnly) p.onOpenContextMenu(e.clientX, e.clientY); return; }
    if (p.readOnly) { const s = p.allSteps[stepIdx]; if (s?.active && s.midiNumber > 0) p.onPlayNotePreview(s.midiNumber); return; }
    if (p.activeTool === 'erase') { p.onSelectStep?.(null); return p.onUpdateSteps(eraseBrick(p.allSteps, stepIdx)); }
    if (p.activeTool === 'glue' || p.activeTool === 'paste') return p.onUpdateSteps(glueBrickToPrevious(p.allSteps, stepIdx));
    if (p.activeTool === 'cut' || p.activeTool === 'split') return p.onUpdateSteps(splitTieAtStep(p.allSteps, stepIdx));
    if (p.activeTool === 'text' || p.activeTool === 'lyric') return triggerTextInput(stepIdx);

    if (p.activeTool === 'melodyne_cut') {
      const hit = findRegionHandleAt(x, p.width, p.totalDurationSec, p.regions || []);
      e.currentTarget.setPointerCapture(e.pointerId);
      if (hit) {
        p.onSelectRegion?.(hit.regionId);
        dragRef.current = { mode: hit.handle === 'body' ? 'region_body' : hit.handle === 'in' ? 'region_in' : 'region_out', regionId: hit.regionId, startSec: sec };
      } else {
        p.onSelectRegion?.(null);
        dragRef.current = { mode: 'region_create', startSec: sec, currentSec: sec };
      }
      return;
    }
    const step = p.allSteps[stepIdx];
    if (!step?.active) {
      p.onSelectStep?.(stepIdx);
      p.onUpdateSteps(createSingleNote(p.allSteps, stepIdx, midi));
      p.onPlayNotePreview(midi);
      return;
    }
    const range = findBrickRange(p.allSteps, stepIdx);
    if (range) {
      p.onSelectStep?.(range.rootIndex);
      const isNearRight = Math.abs(x - (range.endIndex + 1) * (p.width / p.allSteps.length)) <= 8;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { mode: isNearRight ? 'resize' : 'move', rootIdx: range.rootIndex, lastMidi: step.midiNumber, changed: false };
      if (!isNearRight) p.onPlayNotePreview(midi);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const { stepIdx, midi, sec } = getCoords(e);
    const d = dragRef.current;
    if (d.mode === 'region_in' && d.regionId) {
      const reg = p.regions?.find((r) => r.id === d.regionId);
      if (reg) p.onUpdateRegionBounds?.(d.regionId, Math.min(sec, reg.endSec - 0.05), reg.endSec);
    } else if (d.mode === 'region_out' && d.regionId) {
      const reg = p.regions?.find((r) => r.id === d.regionId);
      if (reg) p.onUpdateRegionBounds?.(d.regionId, reg.startSec, Math.max(sec, reg.startSec + 0.05));
    } else if (d.mode === 'region_create') {
      d.currentSec = sec;
    } else if (d.mode === 'move' && midi !== d.lastMidi) {
      d.lastMidi = midi; d.changed = true;
      p.onUpdateSteps(moveBrick(p.allSteps, d.rootIdx, midi), false);
      p.onPlayNotePreview(midi);
    } else if (d.mode === 'resize') {
      d.changed = true;
      p.onUpdateSteps(resizeBrick(p.allSteps, d.rootIdx, stepIdx), false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    if (dragRef.current.mode === 'region_create') {
      const s0 = dragRef.current.startSec, s1 = dragRef.current.currentSec;
      if (Math.abs(s1 - s0) >= 0.05) p.onAddRegion?.(Math.min(s0, s1), Math.max(s0, s1));
    } else if (dragRef.current.changed) {
      p.onUpdateSteps(p.allSteps, true);
    }
    dragRef.current = null;
  };

  const triggerTextInput = (stepIdx: number) => {
    const range = findBrickRange(p.allSteps, stepIdx);
    const targetIdx = range ? range.rootIndex : stepIdx, stepW = p.width / p.allSteps.length;
    const brickW = range ? (range.endIndex - range.rootIndex + 1) * stepW : stepW;
    const step = p.allSteps[targetIdx], y = (p.maxMidi - (step?.midiNumber ?? p.minMidi)) * p.rowHeight;
    p.onOpenTextInput(targetIdx, { x: targetIdx * stepW, y, w: brickW, h: p.rowHeight });
  };

  return (
    <canvas
      ref={canvasRef}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (!p.readOnly) p.onOpenContextMenu(e.clientX, e.clientY); }}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
      onDoubleClick={(e) => { if (!p.readOnly) triggerTextInput(getCoords(e).stepIdx); }}
      style={{ width: `${p.width}px`, height: `${p.height}px`, cursor: p.readOnly ? 'default' : getToolCursorStyle(p.activeTool) }} className="block select-none"
    />
  );
};
