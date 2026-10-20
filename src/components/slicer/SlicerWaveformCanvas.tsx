/**
 * SlicerWaveformCanvas.tsx
 * Canvas interactif pour la forme d'onde, bornes de Trim et piquets de temps (< 130 lignes).
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { drawSlicerWaveform } from './slicerWaveformDrawer';
import { hitTestSlicer, addBeatPeg, moveBeatPeg, deleteBeatPeg, type SlicerHitResult } from './slicerPegInteractions';

interface SlicerWaveformCanvasProps {
  pcm: Float32Array; sampleRate: number; durationSec: number;
  trimInSec: number; trimOutSec: number; beatPegs: number[]; targetPegs: number[];
  playheadSec: number; beatsPerMeasure: number;
  onTrimChange: (trimIn: number, trimOut: number) => void;
  onPegsChange: (pegs: number[]) => void;
  onSeek?: (sec: number) => void;
}

export const SlicerWaveformCanvas: React.FC<SlicerWaveformCanvasProps> = (props) => {
  const { pcm, sampleRate, durationSec, trimInSec, trimOutSec, beatPegs, targetPegs, playheadSec, beatsPerMeasure, onTrimChange, onPegsChange, onSeek } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ mode: SlicerHitResult; startSec: number } | null>(null);
  const [themeTick, setThemeTick] = React.useState(0);

  useEffect(() => {
    const obs = new MutationObserver(() => setThemeTick((v) => v + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

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
    drawSlicerWaveform(ctx, { width: w, height: h, dpr, pcm, sampleRate, durationSec, trimInSec, trimOutSec, beatPegs, targetPegs, playheadSec, beatsPerMeasure });
  }, [pcm, sampleRate, durationSec, trimInSec, trimOutSec, beatPegs, targetPegs, playheadSec, beatsPerMeasure, themeTick]);

  useEffect(() => { render(); }, [render]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, sec, width } = getCanvasCoords(e);
    if (e.button === 2) {
      e.preventDefault();
      const hit = hitTestSlicer(x, width, durationSec, trimInSec, trimOutSec, beatPegs, 12);
      if (hit.type === 'peg' && hit.pegIndex !== undefined) onPegsChange(deleteBeatPeg(beatPegs, hit.pegIndex));
      return;
    }
    const hit = hitTestSlicer(x, width, durationSec, trimInSec, trimOutSec, beatPegs, 10);
    if (hit.type !== 'none') {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { mode: hit, startSec: sec };
    } else if (e.shiftKey) {
      onPegsChange(addBeatPeg(beatPegs, sec, trimInSec, trimOutSec));
    } else {
      onSeek?.(sec);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const { sec } = getCanvasCoords(e);
    const { mode } = dragRef.current;
    if (mode.type === 'trim_in') onTrimChange(Math.min(sec, trimOutSec - 0.2), trimOutSec);
    else if (mode.type === 'trim_out') onTrimChange(trimInSec, Math.max(sec, trimInSec + 0.2));
    else if (mode.type === 'peg' && mode.pegIndex !== undefined) onPegsChange(moveBeatPeg(beatPegs, mode.pegIndex, sec, trimInSec, trimOutSec));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    dragRef.current = null;
  };

  const handleDoubleClick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { sec } = getCanvasCoords(e);
    onPegsChange(addBeatPeg(beatPegs, sec, trimInSec, trimOutSec));
  };

  return (
    <div className="w-full h-36 bg-[var(--cordel-surface)] border border-[var(--cordel-border-panel)] rounded relative select-none">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick} onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full block cursor-crosshair"
      />
    </div>
  );
};
