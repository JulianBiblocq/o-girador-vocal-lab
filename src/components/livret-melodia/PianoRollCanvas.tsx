/**
 * PianoRollCanvas.tsx
 * Canvas interactif HiDPI pour la grille des notes :
 * Subdivisions, Édition MIDI (déplacement, resize, briques), Palette au Clic Droit
 * et Tête de lecture 60 FPS (Zero Render Thrashing).
 */
import React, { useEffect, useRef, useCallback } from 'react';
import type { PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import { drawPianoRollGrid } from './pianoRollDrawer';
import {
  findBrickRange, moveBrick, resizeBrick, glueBrickToPrevious,
  splitTieAtStep, eraseBrick, createSingleNote, type PianoRollTool
} from './pianoRollInteractions';

interface PianoRollCanvasProps {
  width: number;
  height: number;
  minMidi: number;
  maxMidi: number;
  rowHeight: number;
  beatsPerMeasure: number;
  beatResolutions: number[];
  allSteps: VocalStepData[];
  pitchCurve: PitchCurvePoint[];
  totalDurationSec: number;
  anacrusisDurationSec: number;
  seekStartSec: number;
  isPlaying: boolean;
  activeTool: PianoRollTool;
  getPlayheadSec?: () => number;
  onOpenContextMenu: (x: number, y: number) => void;
  onUpdateSteps: (newSteps: VocalStepData[]) => void;
  onPlayNotePreview: (midi: number) => void;
  onOpenTextInput: (stepIndex: number, rect: { x: number; y: number; w: number; h: number }) => void;
}

export const PianoRollCanvas: React.FC<PianoRollCanvasProps> = (props) => {
  const { width, height, minMidi, maxMidi, rowHeight, beatsPerMeasure, beatResolutions, allSteps, pitchCurve, totalDurationSec, anacrusisDurationSec, seekStartSec, isPlaying, activeTool, getPlayheadSec, onOpenContextMenu, onUpdateSteps, onPlayNotePreview, onOpenTextInput } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ mode: 'move' | 'resize'; rootIdx: number; lastMidi: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr; canvas.height = height * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const playhead = isPlaying && getPlayheadSec ? getPlayheadSec() : -1;
    drawPianoRollGrid(ctx, { width, height, dpr, minMidi, maxMidi, rowHeight, beatsPerMeasure, beatResolutions, allSteps, pitchCurve, totalDurationSec, anacrusisDurationSec, seekStartSec, playheadSec: playhead, isPlaying });
  }, [width, height, minMidi, maxMidi, rowHeight, beatsPerMeasure, beatResolutions, allSteps, pitchCurve, totalDurationSec, anacrusisDurationSec, seekStartSec, isPlaying, getPlayheadSec]);

  // Boucle 60 FPS sans render thrashing
  useEffect(() => {
    draw();
    if (!isPlaying) return;
    let animId: number;
    const tick = () => { draw(); animId = requestAnimationFrame(tick); };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, draw]);

  const getCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(width - 1, e.clientX - rect.left));
    const y = Math.max(0, Math.min(height - 1, e.clientY - rect.top));
    const stepIdx = allSteps.length > 0 ? Math.min(allSteps.length - 1, Math.floor((x / width) * allSteps.length)) : 0;
    const rowIdx = Math.max(0, Math.floor(y / rowHeight));
    return { stepIdx, midi: maxMidi - Math.min(maxMidi - minMidi, rowIdx), x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { stepIdx, midi, x } = getCoords(e);
    if (e.button === 2) {
      e.preventDefault(); e.stopPropagation();
      onOpenContextMenu(e.clientX, e.clientY);
      return;
    }
    if (activeTool === 'erase') { onUpdateSteps(eraseBrick(allSteps, stepIdx)); return; }
    if (activeTool === 'glue') { onUpdateSteps(glueBrickToPrevious(allSteps, stepIdx)); return; }
    if (activeTool === 'cut') { onUpdateSteps(splitTieAtStep(allSteps, stepIdx)); return; }
    if (activeTool === 'text') { triggerTextInput(stepIdx); return; }

    const step = allSteps[stepIdx];
    if (!step?.active) {
      onUpdateSteps(createSingleNote(allSteps, stepIdx, midi));
      onPlayNotePreview(midi);
      return;
    }
    const range = findBrickRange(allSteps, stepIdx);
    if (range) {
      const stepW = width / allSteps.length;
      const isNearRight = Math.abs(x - (range.endIndex + 1) * stepW) <= 8;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { mode: isNearRight ? 'resize' : 'move', rootIdx: range.rootIndex, lastMidi: step.midiNumber };
      if (!isNearRight) onPlayNotePreview(midi);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const { stepIdx, midi } = getCoords(e);
    if (dragRef.current.mode === 'move' && midi !== dragRef.current.lastMidi) {
      dragRef.current.lastMidi = midi;
      onUpdateSteps(moveBrick(allSteps, dragRef.current.rootIdx, midi));
      onPlayNotePreview(midi);
    } else if (dragRef.current.mode === 'resize') {
      onUpdateSteps(resizeBrick(allSteps, dragRef.current.rootIdx, stepIdx));
    }
  };

  const triggerTextInput = (stepIdx: number) => {
    const range = findBrickRange(allSteps, stepIdx);
    const targetIdx = range ? range.rootIndex : stepIdx;
    const stepW = width / allSteps.length;
    const brickW = range ? (range.endIndex - range.rootIndex + 1) * stepW : stepW;
    const step = allSteps[targetIdx];
    const brickY = (maxMidi - (step?.midiNumber ?? minMidi)) * rowHeight;
    onOpenTextInput(targetIdx, { x: targetIdx * stepW, y: brickY, w: brickW, h: rowHeight });
  };

  return (
    <canvas
      ref={canvasRef}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onOpenContextMenu(e.clientX, e.clientY); }}
      onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
      onPointerUp={(e) => { if (dragRef.current) { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {} dragRef.current = null; } }}
      onDoubleClick={(e) => triggerTextInput(getCoords(e).stepIdx)}
      style={{ width: `${width}px`, height: `${height}px` }}
      className={`block select-none ${activeTool === 'erase' ? 'cursor-not-allowed' : activeTool === 'text' ? 'cursor-text' : 'cursor-pointer'}`}
    />
  );
};
