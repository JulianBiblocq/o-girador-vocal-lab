/**
 * PianoRollRulerCanvas.tsx
 * Canvas supérieur dédié à la règle temporelle (42 px : Mesures / Temps).
 * Fixé en sticky top-0, avec Seek immédiat au clic/glisser et indicateurs 60 FPS (i18n pur via t).
 */
import React, { useRef, useEffect, useCallback } from 'react';
import type { VocalStepData } from '../../types/vocalPack.types';
import { drawRulerBar, RULER_HEIGHT } from './pianoRollRulerDrawer';
import { useLanguage } from '../../i18n/LanguageContext';

interface PianoRollRulerCanvasProps {
  width: number;
  beatsPerMeasure: number;
  totalDurationSec: number;
  anacrusisDurationSec: number;
  seekStartSec: number;
  isPlaying: boolean;
  hasAnacrusis?: boolean;
  t1OffsetSec?: number;
  bpm?: number;
  allSteps?: VocalStepData[];
  getPlayheadSec?: () => number;
  onSeek: (sec: number) => void;
}

export const PianoRollRulerCanvas: React.FC<PianoRollRulerCanvasProps> = (props) => {
  const { width, beatsPerMeasure, totalDurationSec, anacrusisDurationSec, seekStartSec, isPlaying, hasAnacrusis = true, t1OffsetSec, bpm, allSteps, getPlayheadSec, onSeek } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const { t } = useLanguage();
  const [themeTick, setThemeTick] = React.useState(0);

  const tGridStart = hasAnacrusis ? 0 : (t1OffsetSec ?? 0.15);
  const beatDur = bpm ? 60 / bpm : (hasAnacrusis && beatsPerMeasure > 0 ? anacrusisDurationSec / beatsPerMeasure : 0.6);
  const totalBeats = Math.max(1, Math.round((totalDurationSec - tGridStart - 0.25) / beatDur));
  const gridDur = totalBeats * beatDur;

  useEffect(() => {
    const obs = new MutationObserver(() => setThemeTick((v) => v + 1));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

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
      anacrusisDurationSec, seekStartSec, playheadSec: playhead, isPlaying,
      hasAnacrusis, t1OffsetSec, bpm, allSteps,
      elanLabel: t('rulerElan'),
      m1Label: t('rulerMeasure1'),
      measurePrefix: t('measureAbbr'),
    });
  }, [width, beatsPerMeasure, totalDurationSec, anacrusisDurationSec, seekStartSec, isPlaying, hasAnacrusis, t1OffsetSec, bpm, allSteps, getPlayheadSec, t, themeTick]);

  useEffect(() => {
    draw();
    if (!isPlaying) return;
    let animId: number;
    const tick = () => { draw(); animId = requestAnimationFrame(tick); };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, draw]);

  const xToSeekSec = (clientX: number, rectLeft: number) => {
    const x = Math.max(0, Math.min(width - 1, clientX - rectLeft));
    return Math.max(0, Math.min(totalDurationSec - 0.05, tGridStart + (x / width) * gridDur));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek(xToSeekSec(e.clientX, rect.left));
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onSeek(xToSeekSec(e.clientX, rect.left));
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
      className="block cursor-pointer select-none"
    />
  );
};
