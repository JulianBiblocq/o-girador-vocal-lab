/**
 * ConductorWaveformTimeline.tsx
 * Timeline Audio Visuelle continue de reconstruction avec calage T1 et playhead RAF (< 120 lignes).
 */
import React, { useRef, useEffect } from 'react';
import type { ToadaProject } from '../../types/toadaProject.types';
import { computeSlotsMeasureLayout } from './toadaTimingScheduler';
import type { ToadaPlayerEngine } from './ToadaPlayerEngine';

interface ConductorWaveformTimelineProps {
  project: ToadaProject;
  isPlaying: boolean;
  playerEngine: ToadaPlayerEngine;
}

export const ConductorWaveformTimeline: React.FC<ConductorWaveformTimelineProps> = ({
  project, isPlaying, playerEngine,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  const layouts = computeSlotsMeasureLayout(project.slots, project.patterns);
  const totalMeasures = layouts.length > 0
    ? layouts[layouts.length - 1].startMeasure + layouts[layouts.length - 1].advanceMeasures + 1
    : 8;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w <= 0 || h <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const mToX = (m: number) => ((m - 1) / (totalMeasures - 1)) * w;
    const measureDur = 4 * (60 / (project.bpm || 88));

    // 1. Grille des mesures M1..MN
    for (let m = 1; m <= totalMeasures; m++) {
      const x = mToX(m);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      ctx.fillStyle = '#ef4444'; ctx.font = 'bold 8px monospace';
      ctx.fillText(`M${m}`, Math.min(w - 20, x + 2), 9);
    }

    // 2. Tranches Audio assemblées
    layouts.forEach((lay, idx) => {
      const slot = project.slots[lay.slotIndex];
      const pat = project.patterns.find((p) => p.id === (slot.puxadorPatternId || slot.coroPatternId));
      if (!pat) return;
      const rec = pat.variants?.[pat.activeVariantKey]?.recordingResult ?? pat.recordingResult;
      const pcm = rec?.pcm;
      if (!pcm || pcm.length === 0) return;

      const t1Offset = pat.variants?.[pat.activeVariantKey]?.t1OffsetSec ?? pat.t1OffsetSec ?? (pat.hasAnacrusis !== false ? measureDur : 0.15);
      const trimStart = pat.variants?.[pat.activeVariantKey]?.trimStartSec ?? pat.trimStartSec ?? 0;
      const trimEnd = (pat.variants?.[pat.activeVariantKey]?.trimEndSec ?? pat.trimEndSec) || (pcm.length / rec.sampleRate);

      const startM = lay.startMeasure + (trimStart - t1Offset) / measureDur;
      const durM = Math.max(0.1, (trimEnd - trimStart) / measureDur);
      const xStart = mToX(startM), xEnd = mToX(startM + durM), blkW = Math.max(2, xEnd - xStart);

      ctx.fillStyle = pat.role === 'coro' ? 'rgba(16, 185, 129, 0.22)' : 'rgba(217, 119, 6, 0.22)';
      ctx.fillRect(xStart, 12, blkW, h - 12);
      ctx.strokeStyle = pat.role === 'coro' ? '#10b981' : '#d97706'; ctx.lineWidth = 1;
      ctx.strokeRect(xStart, 12, blkW, h - 12);

      // Repère de jointure continue (•) avec le bloc suivant
      if (idx < layouts.length - 1) {
        ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.arc(xEnd, h / 2 + 4, 3.5, 0, Math.PI * 2); ctx.fill();
      }
    });
  }, [project, totalMeasures, layouts]);

  // Boucle RAF Playhead (Zero Render Thrashing)
  useEffect(() => {
    if (!isPlaying) { if (playheadRef.current) playheadRef.current.style.display = 'none'; return; }
    let id: number;
    const tick = () => {
      if (canvasRef.current && playheadRef.current) {
        const curM = playerEngine.getCurrentMeasure();
        const w = canvasRef.current.clientWidth;
        const x = Math.max(0, Math.min(w, ((curM - 1) / (totalMeasures - 1)) * w));
        playheadRef.current.style.display = 'block';
        playheadRef.current.style.transform = `translate3d(${x}px, 0, 0)`;
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [isPlaying, playerEngine, totalMeasures]);

  return (
    <div className="w-full h-11 relative rounded border border-[var(--cordel-border-panel)] bg-[var(--cordel-surface)] overflow-hidden mt-1.5 select-none">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div ref={playheadRef} className="absolute top-0 bottom-0 w-0.5 bg-sky-400 shadow-sm z-10 pointer-events-none hidden will-change-transform" />
    </div>
  );
};
