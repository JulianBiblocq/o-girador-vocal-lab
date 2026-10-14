/**
 * PianoRollCanvas.tsx
 * Canvas interactif HiDPI pour la grille MIDI : déplacement vertical,
 * étirement horizontal, clic droit gomme et double-clic saisie de texte.
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
  allSteps: VocalStepData[];
  pitchCurve: PitchCurvePoint[];
  totalDurationSec: number;
  anacrusisDurationSec: number;
  playheadSec: number;
  isPlaying: boolean;
  activeTool: PianoRollTool;
  onUpdateSteps: (newSteps: VocalStepData[]) => void;
  onPlayNotePreview: (midi: number) => void;
  onOpenTextInput: (stepIndex: number, rect: { x: number; y: number; w: number; h: number }) => void;
}

export const PianoRollCanvas: React.FC<PianoRollCanvasProps> = (props) => {
  const { width, height, minMidi, maxMidi, rowHeight, allSteps, pitchCurve, totalDurationSec, anacrusisDurationSec, playheadSec, isPlaying, activeTool, onUpdateSteps, onPlayNotePreview, onOpenTextInput } = props;
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
    drawPianoRollGrid(ctx, { width, height, dpr, minMidi, maxMidi, rowHeight, allSteps, pitchCurve, totalDurationSec, anacrusisDurationSec, playheadSec, isPlaying });
  }, [width, height, minMidi, maxMidi, rowHeight, allSteps, pitchCurve, totalDurationSec, anacrusisDurationSec, playheadSec, isPlaying]);

  useEffect(() => { draw(); }, [draw]);

  const getStepAndMidi = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(width - 1, e.clientX - rect.left));
    const y = Math.max(0, Math.min(height - 1, e.clientY - rect.top));
    const stepIdx = allSteps.length > 0 ? Math.min(allSteps.length - 1, Math.floor((x / width) * allSteps.length)) : 0;
    const midi = maxMidi - Math.min(maxMidi - minMidi, Math.floor(y / rowHeight));
    return { stepIdx, midi, x };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { stepIdx, midi, x } = getStepAndMidi(e);
    if (e.button === 2) { e.preventDefault(); onUpdateSteps(eraseBrick(allSteps, stepIdx)); return; }

    const step = allSteps[stepIdx];
    if (activeTool === 'erase') { onUpdateSteps(eraseBrick(allSteps, stepIdx)); return; }
    if (activeTool === 'glue') { onUpdateSteps(glueBrickToPrevious(allSteps, stepIdx)); return; }
    if (activeTool === 'cut') { onUpdateSteps(splitTieAtStep(allSteps, stepIdx)); return; }
    if (activeTool === 'text') { triggerTextInput(stepIdx); return; }

    // Mode Pointer
    if (!step?.active) {
      onUpdateSteps(createSingleNote(allSteps, stepIdx, midi));
      onPlayNotePreview(midi);
      return;
    }

    const range = findBrickRange(allSteps, stepIdx);
    if (range) {
      const stepWidth = width / allSteps.length;
      const brickRightX = (range.endIndex + 1) * stepWidth;
      const isNearRightEdge = Math.abs(x - brickRightX) <= 8;

      e.currentTarget.setPointerCapture(e.pointerId);
      if (isNearRightEdge) {
        dragRef.current = { mode: 'resize', rootIdx: range.rootIndex, lastMidi: step.midiNumber };
      } else {
        dragRef.current = { mode: 'move', rootIdx: range.rootIndex, lastMidi: step.midiNumber };
        onPlayNotePreview(midi);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const { stepIdx, midi } = getStepAndMidi(e);
    if (dragRef.current.mode === 'move' && midi !== dragRef.current.lastMidi) {
      dragRef.current.lastMidi = midi;
      onUpdateSteps(moveBrick(allSteps, dragRef.current.rootIdx, midi));
      onPlayNotePreview(midi);
    } else if (dragRef.current.mode === 'resize') {
      onUpdateSteps(resizeBrick(allSteps, dragRef.current.rootIdx, stepIdx));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
      dragRef.current = null;
    }
  };

  const triggerTextInput = (stepIdx: number) => {
    const range = findBrickRange(allSteps, stepIdx);
    const targetIdx = range ? range.rootIndex : stepIdx;
    const stepWidth = width / allSteps.length;
    const brickW = range ? (range.endIndex - range.rootIndex + 1) * stepWidth : stepWidth;
    const step = allSteps[targetIdx];
    const brickY = (maxMidi - (step?.midiNumber ?? minMidi)) * rowHeight;
    onOpenTextInput(targetIdx, { x: targetIdx * stepWidth, y: brickY, w: brickW, h: rowHeight });
  };

  return (
    <canvas
      ref={canvasRef}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={(e) => { const { stepIdx } = getStepAndMidi(e); triggerTextInput(stepIdx); }}
      style={{ width: `${width}px`, height: `${height}px` }}
      className={`block select-none ${activeTool === 'erase' ? 'cursor-not-allowed' : activeTool === 'text' ? 'cursor-text' : 'cursor-pointer'}`}
    />
  );
};
