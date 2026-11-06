/**
 * PianoRollCanvas.tsx
 * Canvas interactif du Piano Roll avec poignées VariAudio par brique (0..100%),
 * déplacement MIDI, outil Colle 🔗, Crayon ✏️ et menu Clic Droit Cubase (< 135 lignes).
 */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import type { PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import type { PatternHarmonyGrid } from '../../types/harmony.types';
import { drawPianoRollGrid } from './pianoRollDrawer';
import { isOnBrickVariAudioHandle } from './pianoRollBricksDrawer';
import { findBrickRange, moveBrick, glueBrickToNext, splitTieAtStep, eraseBrick, createSingleNote, setBrickMelodynePullPct, type PianoRollTool } from './pianoRollInteractions';
import { isOnBrickRightResizeHandle, resizeBrickRightEdge, findBrickJunctionAtX, weldAdjacentBricks } from './pianoRollBrickInteractions';
import { getToolCursorStyle } from '../../utils/toolCursors';

export interface PianoRollCanvasProps {
  width: number; height: number; minMidi: number; maxMidi: number; rowHeight: number; beatsPerMeasure: number; beatResolutions: number[];
  allSteps: VocalStepData[]; pitchCurve: PitchCurvePoint[]; rawPitchCurve?: PitchCurvePoint[]; totalDurationSec: number; anacrusisDurationSec: number;
  seekStartSec: number; isPlaying: boolean; activeTool: PianoRollTool; hasAnacrusis?: boolean; t1OffsetSec?: number; bpm?: number; selectedStepIdx?: number | null;
  getPlayheadSec?: () => number; onOpenContextMenu: (x: number, y: number) => void; onUpdateSteps: (newSteps: VocalStepData[], commit?: boolean) => void;
  onPlayNotePreview: (midi: number) => void; onOpenTextInput: (stepIndex: number, rect: { x: number; y: number; w: number; h: number }) => void;
  onSelectStep?: (idx: number | null) => void; onBrickMoved?: (rootIdx: number, newSteps: VocalStepData[]) => void;
  harmonyGrid?: PatternHarmonyGrid; pitchShiftSemitones?: number; allowedPitchClasses?: Set<number> | null; readOnly?: boolean;
}

export const PianoRollCanvas: React.FC<PianoRollCanvasProps> = (p) => {
  const canvasRef = useRef<HTMLCanvasElement>(null), dragRef = useRef<any>(null);
  const [themeTick, setThemeTick] = useState(0), [hoveredBrickRootIdx, setHoveredBrickRootIdx] = useState<number | null>(null);
  const [hoverHandleCursor, setHoverHandleCursor] = useState<string | null>(null);

  useEffect(() => {
    const obs = new MutationObserver(() => setThemeTick((t) => t + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas || p.width <= 0 || p.height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== p.width * dpr || canvas.height !== p.height * dpr) { canvas.width = p.width * dpr; canvas.height = p.height * dpr; }
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    drawPianoRollGrid(ctx, { ...p, dpr, hoveredBrickRootIdx, playheadSec: p.isPlaying && p.getPlayheadSec ? p.getPlayheadSec() : -1 });
  }, [p, themeTick, hoveredBrickRootIdx]);

  useEffect(() => {
    draw(); if (!p.isPlaying) return;
    let animId = requestAnimationFrame(function tick() { draw(); animId = requestAnimationFrame(tick); });
    return () => cancelAnimationFrame(animId);
  }, [p.isPlaying, draw]);

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(p.width - 1, e.clientX - rect.left)), y = Math.max(0, Math.min(p.height - 1, e.clientY - rect.top));
    const stepIdx = p.allSteps.length > 0 ? Math.min(p.allSteps.length - 1, Math.floor((x / p.width) * p.allSteps.length)) : 0;
    return { stepIdx, midi: p.maxMidi - Math.min(p.maxMidi - p.minMidi, Math.max(0, Math.floor(y / p.rowHeight))), x, y };
  };
  const triggerTextInput = (stepIdx: number) => {
    const range = findBrickRange(p.allSteps, stepIdx), targetIdx = range ? range.rootIndex : stepIdx, stepW = p.width / Math.max(1, p.allSteps.length);
    const brickW = range ? (range.endIndex - range.rootIndex + 1) * stepW : stepW, step = p.allSteps[targetIdx], y = (p.maxMidi - (step?.midiNumber ?? p.minMidi)) * p.rowHeight;
    p.onOpenTextInput(targetIdx, { x: targetIdx * stepW, y, w: brickW, h: p.rowHeight });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { stepIdx, midi, x, y } = getCoords(e);
    if (e.button === 2) { e.preventDefault(); e.stopPropagation(); if (!p.readOnly) p.onOpenContextMenu(e.clientX, e.clientY); return; }
    if (p.readOnly) { const s = p.allSteps[stepIdx]; if (s?.active && s.midiNumber > 0) p.onPlayNotePreview(s.midiNumber); return; }
    if (p.activeTool === 'erase') { p.onSelectStep?.(null); return p.onUpdateSteps(eraseBrick(p.allSteps, stepIdx)); }
    if (p.activeTool === 'glue' || p.activeTool === 'paste') return p.onUpdateSteps(glueBrickToNext(p.allSteps, stepIdx));
    if (p.activeTool === 'cut' || p.activeTool === 'split') return p.onUpdateSteps(splitTieAtStep(p.allSteps, stepIdx));
    if (p.activeTool === 'text' || p.activeTool === 'lyric') return triggerTextInput(stepIdx);

    const step = p.allSteps[stepIdx], stepW = p.width / Math.max(1, p.allSteps.length);
    if (!step?.active) {
      p.onSelectStep?.(stepIdx); p.onUpdateSteps(createSingleNote(p.allSteps, stepIdx, midi), false); p.onPlayNotePreview(midi);
      e.currentTarget.setPointerCapture(e.pointerId); dragRef.current = { mode: 'resize', rootIdx: stepIdx, changed: true }; return;
    }
    if (e.shiftKey) { p.onUpdateSteps(glueBrickToNext(p.allSteps, stepIdx), true); return; }

    const range = findBrickRange(p.allSteps, stepIdx);
    if (range) {
      p.onSelectStep?.(range.rootIndex);
      const rootStep = p.allSteps[range.rootIndex];
      const onVariHandle = isOnBrickVariAudioHandle(x, y, range.rootIndex, range.endIndex, rootStep.midiNumber, stepW, p.maxMidi, p.rowHeight);
      const isNearRight = !onVariHandle && isOnBrickRightResizeHandle(x, p.width, p.allSteps.length, range.endIndex, 8);
      e.currentTarget.setPointerCapture(e.pointerId);
      if (onVariHandle) dragRef.current = { mode: 'variaudio_pull', rootIdx: range.rootIndex, startY: e.clientY, startPull: rootStep.melodynePullPct ?? 0, changed: false };
      else {
        dragRef.current = { mode: isNearRight ? 'resize' : 'move', rootIdx: range.rootIndex, lastMidi: rootStep.midiNumber, changed: false };
        if (!isNearRight) p.onPlayNotePreview(rootStep.midiNumber);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { stepIdx, midi, x, y } = getCoords(e), stepW = p.width / Math.max(1, p.allSteps.length);
    if (!dragRef.current) {
      const range = findBrickRange(p.allSteps, stepIdx);
      setHoveredBrickRootIdx(range ? range.rootIndex : null);
      if (range && isOnBrickVariAudioHandle(x, y, range.rootIndex, range.endIndex, p.allSteps[range.rootIndex].midiNumber, stepW, p.maxMidi, p.rowHeight)) setHoverHandleCursor('ns-resize');
      else if (range && isOnBrickRightResizeHandle(x, p.width, p.allSteps.length, range.endIndex, 8)) setHoverHandleCursor('ew-resize');
      else setHoverHandleCursor(null);
      return;
    }
    const d = dragRef.current;
    if (d.mode === 'variaudio_pull') {
      const dy = d.startY - e.clientY;
      if (Math.abs(dy) >= 2) { d.changed = true; p.onUpdateSteps(setBrickMelodynePullPct(p.allSteps, d.rootIdx, d.startPull + (d.startPull === 0 && dy < 0 ? Math.abs(dy) * 1.8 : dy * 1.8)), false); }
    } else if (d.mode === 'move' && midi !== d.lastMidi) {
      d.lastMidi = midi; d.changed = true; p.onUpdateSteps(moveBrick(p.allSteps, d.rootIdx, midi), false); p.onPlayNotePreview(midi);
    } else if (d.mode === 'resize') {
      d.changed = true; p.onUpdateSteps(resizeBrickRightEdge(p.allSteps, d.rootIdx, stepIdx), false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    const d = dragRef.current;
    if (d.mode === 'variaudio_pull' && !d.changed) {
      const nextSteps = setBrickMelodynePullPct(p.allSteps, d.rootIdx, d.startPull === 0 ? 80 : d.startPull < 100 ? 100 : 0);
      p.onUpdateSteps(nextSteps, true); p.onBrickMoved?.(d.rootIdx, nextSteps);
    } else if (d.changed) {
      p.onUpdateSteps(p.allSteps, true); p.onBrickMoved?.(d.rootIdx, p.allSteps);
    }
    dragRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (!p.readOnly) p.onOpenContextMenu(e.clientX, e.clientY); }}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
      onDoubleClick={(e) => {
        if (p.readOnly) return;
        const { stepIdx, x } = getCoords(e), jIdx = findBrickJunctionAtX(p.allSteps, x, p.width, 8);
        if (jIdx !== null) { const w = weldAdjacentBricks(p.allSteps, jIdx, 12); p.onUpdateSteps(w, true); p.onBrickMoved?.(jIdx, w); return; }
        triggerTextInput(stepIdx);
      }}
      style={{ width: `${p.width}px`, height: `${p.height}px`, cursor: p.readOnly ? 'default' : (hoverHandleCursor ?? getToolCursorStyle(p.activeTool)) }}
      className="block select-none"
    />
  );
};
