/**
 * slicerSegmentDrawer.ts
 * Rendu Canvas 2D avec grille métronome globale (T1..T4), anacrouse et chute 1T (< 130 lignes).
 */
import type { SliceSegment } from '../../types/slicerSegments.types';

export interface DrawSegmentsOptions {
  width: number; height: number; dpr: number; pcm: Float32Array;
  durationSec: number; segments: SliceSegment[]; selectedSegmentId: string | null;
  playheadSec: number; bpm: number; gridOffsetSec: number; showMetronomeGrid?: boolean;
  viewStartSec?: number; viewDurationSec?: number; zoomLevel?: number;
}

export function drawSegmentWaveform(ctx: CanvasRenderingContext2D, opts: DrawSegmentsOptions): void {
  const { width, height, dpr, pcm, durationSec, segments, selectedSegmentId, playheadSec, bpm, gridOffsetSec, showMetronomeGrid = true } = opts;
  ctx.save(); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, width, height);

  const vStart = opts.viewStartSec ?? 0, vDur = opts.viewDurationSec && opts.viewDurationSec > 0 ? opts.viewDurationSec : durationSec;
  const zoom = opts.zoomLevel ?? (durationSec > 0 && vDur > 0 ? durationSec / vDur : 1);
  const secToX = (s: number) => (vDur > 0 ? ((s - vStart) / vDur) * width : 0);
  const midY = height / 2, isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  const beatDur = bpm > 0 ? 60 / bpm : 1.09, measureDur = beatDur * 4;

  if (showMetronomeGrid && durationSec > 0) {
    const firstM = Math.max(-1, Math.floor((vStart - gridOffsetSec) / measureDur) - 1);
    const lastM = Math.ceil((vStart + vDur - gridOffsetSec) / measureDur) + 1;
    for (let m = firstM; m <= lastM; m++) {
      const mStart = gridOffsetSec + m * measureDur, xT1 = secToX(mStart);
      if (xT1 >= 0 && xT1 <= width) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)'; ctx.lineWidth = 1.5; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(xT1, 0); ctx.lineTo(xT1, height); ctx.stroke();
        ctx.font = 'bold 8px monospace'; ctx.fillStyle = '#ef4444'; ctx.fillText(`M${m + 1}`, Math.max(2, xT1 + 2), 10);
      }
      for (let b = 1; b < 4; b++) {
        const xBeat = secToX(mStart + b * beatDur);
        if (xBeat >= 0 && xBeat <= width) {
          ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.moveTo(xBeat, 14); ctx.lineTo(xBeat, height); ctx.stroke();
          if (zoom >= 2) { ctx.font = '7px monospace'; ctx.fillStyle = isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)'; ctx.fillText(`T${b + 1}`, xBeat + 2, 10); }
        }
      }
      if (zoom >= 2) {
        for (let b = 0; b < 4; b++) {
          const xSub = secToX(mStart + (b + 0.5) * beatDur);
          if (xSub >= 0 && xSub <= width) {
            ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'; ctx.lineWidth = 0.75; ctx.setLineDash([1, 4]);
            ctx.beginPath(); ctx.moveTo(xSub, 18); ctx.lineTo(xSub, height); ctx.stroke();
          }
        }
      }
    }
    ctx.setLineDash([]);
  }

  segments.forEach((seg, idx) => {
    const xStart = secToX(seg.startSec), xEnd = secToX(seg.endSec), segW = Math.max(2, xEnd - xStart);
    const isSelected = seg.id === selectedSegmentId, mCount = seg.measuresCount ?? 1;
    if (seg.isPause) {
      ctx.fillStyle = isSelected ? 'rgba(100, 116, 139, 0.38)' : 'rgba(120, 113, 108, 0.24)';
      ctx.fillRect(xStart, 0, segW, height);
      ctx.strokeStyle = isSelected ? '#94a3b8' : '#78716c'; ctx.lineWidth = isSelected ? 2 : 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(xStart, 0); ctx.lineTo(xStart, height); ctx.moveTo(xEnd, 0); ctx.lineTo(xEnd, height); ctx.stroke();
      ctx.setLineDash([]);
      const pLabel = `🔇 Pause #${idx + 1} (${mCount}M)`;
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#57534e'; ctx.fillRect(xStart + 2, 2, ctx.measureText(pLabel).width + 8, 14);
      ctx.fillStyle = '#ffffff'; ctx.fillText(pLabel, xStart + 6, 12);
      return;
    }
    const hasAna = seg.hasAnacrusis !== false && (seg.anacrusisBeats ?? 2) > 0;
    const hasTail = seg.hasTailBeat !== false, anacBeats = seg.anacrusisBeats ?? (hasAna ? 2 : 0);
    const anacDur = hasAna ? anacBeats * beatDur : 0, t1Sec = seg.metricT1Sec ?? (hasAna ? seg.startSec + anacDur : seg.startSec);
    const xT1 = secToX(t1Sec), xBodyEnd = secToX(t1Sec + mCount * measureDur);

    ctx.fillStyle = isSelected ? 'rgba(245, 158, 11, 0.28)' : 'rgba(245, 158, 11, 0.16)';
    ctx.fillRect(xStart, 0, segW, height);
    if (hasAna && xT1 > xStart) {
      ctx.fillStyle = 'rgba(217, 119, 6, 0.22)'; ctx.fillRect(xStart, 0, xT1 - xStart, height);
      ctx.font = 'bold 8px monospace'; ctx.fillStyle = '#d97706'; ctx.fillText(`-Ana(${anacBeats}T)`, xStart + 2, height - 4);
    }
    if (hasTail && xBodyEnd < xEnd) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.22)'; ctx.fillRect(xBodyEnd, 0, xEnd - xBodyEnd, height);
      ctx.font = 'bold 8px monospace'; ctx.fillStyle = '#10b981'; ctx.fillText('+1T', xBodyEnd + 2, height - 4);
    }

    ctx.strokeStyle = isSelected ? '#f59e0b' : '#d97706'; ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.beginPath(); ctx.moveTo(xStart, 0); ctx.lineTo(xStart, height); ctx.moveTo(xEnd, 0); ctx.lineTo(xEnd, height); ctx.stroke();

    const nextSeg = segments[idx + 1];
    if (nextSeg && Math.abs(seg.endSec - nextSeg.startSec) <= 0.05) {
      ctx.fillStyle = '#10b981'; ctx.beginPath(); ctx.arc(xEnd, midY, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('•', xEnd - 2.5, midY + 3);
    } else if (nextSeg && nextSeg.startSec - seg.endSec >= measureDur * 0.5) {
      const xGapStart = xEnd, xGapEnd = secToX(nextSeg.startSec), gapW = Math.max(4, xGapEnd - xGapStart);
      const pauseM = Math.max(1, Math.round(((nextSeg.metricT1Sec ?? nextSeg.startSec) - (t1Sec + mCount * measureDur)) / measureDur));
      ctx.fillStyle = isLight ? 'rgba(120, 113, 108, 0.22)' : 'rgba(168, 162, 158, 0.16)';
      ctx.fillRect(xGapStart, 0, gapW, height);
      ctx.font = 'bold 8px monospace'; ctx.fillStyle = isLight ? '#57534e' : '#d6d3d1';
      ctx.fillText(`🔇 Pause (${pauseM}M)`, xGapStart + 4, midY + 3);
    }

    if (xT1 >= xStart - 10 && xT1 <= xEnd) {
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xT1, 0); ctx.lineTo(xT1, height); ctx.stroke();
      ctx.fillStyle = '#b91c1c'; ctx.fillRect(xT1 - 8, 2, 16, 12);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 8px monospace'; ctx.fillText('T1', xT1 - 5, 11);
    }

    const label = `T${idx + 1} (${mCount}M${hasAna ? ' +Ana' : ''})`;
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = '#b45309'; ctx.fillRect(xStart + 2, 2, ctx.measureText(label).width + 8, 14);
    ctx.fillStyle = '#ffffff'; ctx.fillText(label, xStart + 6, 12);
  });

  if (pcm && pcm.length > 0 && durationSec > 0) {
    const startSample = Math.max(0, Math.floor((vStart / durationSec) * pcm.length));
    const endSample = Math.min(pcm.length, Math.ceil(((vStart + vDur) / durationSec) * pcm.length));
    const visSamples = Math.max(1, endSample - startSample);
    ctx.lineWidth = 1; ctx.strokeStyle = isLight ? '#1c1917' : '#fafaf9';
    for (let x = 0; x < width; x++) {
      const s0 = startSample + Math.floor((x / width) * visSamples);
      const s1 = Math.min(endSample, Math.max(s0 + 1, startSample + Math.floor(((x + 1) / width) * visSamples)));
      const stride = Math.max(1, Math.floor((s1 - s0) / 32));
      let min = 1.0, max = -1.0;
      for (let j = s0; j < s1; j += stride) {
        const val = pcm[j] || 0;
        if (val < min) min = val;
        if (val > max) max = val;
      }
      ctx.beginPath(); ctx.moveTo(x, midY + min * midY * 0.9); ctx.lineTo(x, midY + max * midY * 0.9); ctx.stroke();
    }
  }

  if (playheadSec >= 0) {
    const xPlay = secToX(playheadSec);
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(xPlay, 0); ctx.lineTo(xPlay, height); ctx.stroke();
  }
  ctx.restore();
}
