/**
 * ConductorWaveformTimeline.tsx
 * Timeline Audio Visuelle continue (Puxador + Coro simultanés & correctedAudioSamples) (< 115 lignes).
 */
import React, { useRef, useEffect } from 'react';
import type { ToadaProject, VocalPatternItem } from '../../types/toadaProject.types';
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

    const mToX = (m: number) => ((m - 1) / Math.max(1, totalMeasures - 1)) * w;
    const measureDur = 4 * (60 / (project.bpm || 88));

    for (let m = 1; m <= totalMeasures; m++) {
      const x = mToX(m);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      ctx.fillStyle = '#ef4444'; ctx.font = 'bold 8px monospace';
      ctx.fillText(`M${m}`, Math.min(w - 20, x + 2), 9);
    }

    const drawPatternBlock = (pat: VocalPatternItem, startMeasure: number, yTop: number, boxH: number, showJoint: boolean) => {
      const rec = pat.variants?.[pat.activeVariantKey]?.recordingResult ?? pat.recordingResult;
      const pcm = pat.correctedAudioSamples?.length ? pat.correctedAudioSamples : (rec?.pcm?.length ? rec.pcm : pat.rawAudioSamples);
      if (!pcm || pcm.length === 0) return;
      const sr = rec?.sampleRate ?? pat.recordingResult?.sampleRate ?? 48000;
      const t1Offset = pat.variants?.[pat.activeVariantKey]?.t1OffsetSec ?? pat.t1OffsetSec ?? (pat.hasAnacrusis !== false ? measureDur : 0.15);
      const trimStart = pat.variants?.[pat.activeVariantKey]?.trimStartSec ?? pat.trimStartSec ?? 0;
      const trimEnd = (pat.variants?.[pat.activeVariantKey]?.trimEndSec ?? pat.trimEndSec) || (pcm.length / sr);

      const startM = startMeasure + (trimStart - t1Offset) / measureDur;
      const durM = Math.max(0.1, (trimEnd - trimStart) / measureDur);
      const xStart = mToX(startM), xEnd = mToX(startM + durM), blkW = Math.max(2, xEnd - xStart);

      ctx.fillStyle = pat.role === 'coro' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(217, 119, 6, 0.25)';
      ctx.fillRect(xStart, yTop, blkW, boxH);
      ctx.strokeStyle = pat.role === 'coro' ? '#10b981' : '#d97706'; ctx.lineWidth = 1;
      ctx.strokeRect(xStart, yTop, blkW, boxH);

      if (showJoint) {
        ctx.fillStyle = pat.role === 'coro' ? '#10b981' : '#d97706';
        ctx.beginPath(); ctx.arc(xEnd, yTop + boxH / 2, 3, 0, Math.PI * 2); ctx.fill();
      }
    };

    layouts.forEach((lay, idx) => {
      const slot = project.slots[lay.slotIndex];
      const puxPat = slot.puxadorPatternId ? project.patterns.find((p) => p.id === slot.puxadorPatternId) : undefined;
      const coroPat = slot.coroPatternId ? project.patterns.find((p) => p.id === slot.coroPatternId) : undefined;
      const hasBoth = Boolean(puxPat && coroPat);
      const trackH = h - 12;
      const showJoint = idx < layouts.length - 1;

      if (puxPat) drawPatternBlock(puxPat, lay.startMeasure, 12, hasBoth ? trackH / 2 - 1 : trackH, showJoint);
      if (coroPat) drawPatternBlock(coroPat, lay.startMeasure, hasBoth ? 12 + trackH / 2 + 1 : 12, hasBoth ? trackH / 2 - 1 : trackH, showJoint);
    });
  }, [project, totalMeasures, layouts]);

  useEffect(() => {
    if (!isPlaying) { if (playheadRef.current) playheadRef.current.style.display = 'none'; return; }
    let id: number;
    const tick = () => {
      if (canvasRef.current && playheadRef.current) {
        const curM = playerEngine.getCurrentMeasure(), w = canvasRef.current.clientWidth;
        const x = Math.max(0, Math.min(w, ((curM - 1) / Math.max(1, totalMeasures - 1)) * w));
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
