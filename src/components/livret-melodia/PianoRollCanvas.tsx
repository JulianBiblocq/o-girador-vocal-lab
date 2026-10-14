/**
 * PianoRollCanvas.tsx
 * Canvas interactif HiDPI pour l'affichage et l'édition directe du Piano Roll.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import type { PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import { drawPianoRoll, KEYBOARD_WIDTH } from './pianoRollDrawer';

interface PianoRollCanvasProps {
  width: number;
  height: number;
  minMidi: number;
  maxMidi: number;
  allSteps: VocalStepData[];
  pitchCurve: PitchCurvePoint[];
  totalDurationSec: number;
  anacrusisDurationSec: number;
  playheadSec: number;
  isPlaying: boolean;
  onStepClick?: (stepIndex: number, midi: number) => void;
}

export const PianoRollCanvas: React.FC<PianoRollCanvasProps> = (props) => {
  const { width, height, minMidi, maxMidi, allSteps, pitchCurve, totalDurationSec, anacrusisDurationSec, playheadSec, isPlaying, onStepClick } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    drawPianoRoll(ctx, {
      width, height, dpr, minMidi, maxMidi, allSteps, pitchCurve,
      totalDurationSec, anacrusisDurationSec, playheadSec, isPlaying,
    });
  }, [width, height, minMidi, maxMidi, allSteps, pitchCurve, totalDurationSec, anacrusisDurationSec, playheadSec, isPlaying]);

  useEffect(() => { draw(); }, [draw]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!onStepClick || allSteps.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < KEYBOARD_WIDTH) return; // Clic sur le clavier

    const gridWidth = width - KEYBOARD_WIDTH;
    const xInGrid = Math.max(0, Math.min(gridWidth - 1, x - KEYBOARD_WIDTH));
    const stepIndex = Math.min(allSteps.length - 1, Math.floor((xInGrid / gridWidth) * allSteps.length));

    const totalSemitones = Math.max(1, maxMidi - minMidi + 1);
    const rowHeight = height / totalSemitones;
    const rowIdx = Math.min(totalSemitones - 1, Math.floor(y / rowHeight));
    const midi = maxMidi - rowIdx;

    onStepClick(stepIndex, midi);
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="cursor-crosshair select-none block"
    />
  );
};
