/**
 * PianoRollRulerCanvas.tsx
 * Canvas supérieur dédié à la règle temporelle (42 px : Mesures / Temps).
 * Fixé en sticky top-0, avec Seek immédiat au clic/glisser et indicateurs 60 FPS.
 */
import React, { useRef, useEffect, useCallback } from 'react';
import { drawRulerBar, RULER_HEIGHT } from './pianoRollRulerDrawer';
import { useLanguage } from '../../i18n/LanguageContext';

interface PianoRollRulerCanvasProps {
  width: number;
  beatsPerMeasure: number;
  totalDurationSec: number;
  anacrusisDurationSec: number;
  seekStartSec: number;
  isPlaying: boolean;
  getPlayheadSec?: () => number;
  onSeek: (sec: number) => void;
}

export const PianoRollRulerCanvas: React.FC<PianoRollRulerCanvasProps> = (props) => {
  const { width, beatsPerMeasure, totalDurationSec, anacrusisDurationSec, seekStartSec, isPlaying, getPlayheadSec, onSeek } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const { locale } = useLanguage();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== width * dpr || canvas.height !== RULER_HEIGHT * dpr) {
      canvas.width = width * dpr;
      canvas.height = RULER_HEIGHT * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const playhead = isPlaying && getPlayheadSec ? getPlayheadSec() : -1;
    drawRulerBar(ctx, {
      width, height: RULER_HEIGHT, dpr, beatsPerMeasure, totalDurationSec,
      anacrusisDurationSec, seekStartSec, playheadSec: playhead, isPlaying, isPt: locale === 'pt'
    });
  }, [width, beatsPerMeasure, totalDurationSec, anacrusisDurationSec, seekStartSec, isPlaying, getPlayheadSec, locale]);

  useEffect(() => {
    draw();
    if (!isPlaying) return;
    let animId: number;
    const tick = () => { draw(); animId = requestAnimationFrame(tick); };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, draw]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(width - 1, e.clientX - rect.left));
    const sec = Math.max(0, Math.min(totalDurationSec - 0.05, (x / width) * totalDurationSec));
    onSeek(sec);
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(width - 1, e.clientX - rect.left));
    const sec = Math.max(0, Math.min(totalDurationSec - 0.05, (x / width) * totalDurationSec));
    onSeek(sec);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
      isDraggingRef.current = false;
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={() => onSeek(0)}
      style={{ width: `${width}px`, height: `${RULER_HEIGHT}px` }}
      title="Règle temporelle (cliquer pour Seek, double-clic pour début)"
      className="block cursor-pointer select-none"
    />
  );
};
