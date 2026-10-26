/**
 * slicerSegmentDrawer.ts
 * Rendu Canvas 2D haute performance des tranches multiples sur forme d'onde (< 115 lignes).
 */
import type { SliceSegment } from '../../types/slicerSegments.types';

export interface DrawSegmentsOptions {
  width: number;
  height: number;
  dpr: number;
  pcm: Float32Array;
  durationSec: number;
  segments: SliceSegment[];
  selectedSegmentId: string | null;
  playheadSec: number;
}

const SEGMENT_COLORS = [
  { fill: 'rgba(245, 158, 11, 0.22)', stroke: '#f59e0b', badge: '#b45309' },
  { fill: 'rgba(16, 185, 129, 0.22)', stroke: '#10b981', badge: '#047857' },
  { fill: 'rgba(56, 189, 248, 0.22)', stroke: '#38bdf8', badge: '#0369a1' },
  { fill: 'rgba(168, 85, 247, 0.22)', stroke: '#a855f7', badge: '#7e22ce' },
  { fill: 'rgba(236, 72, 153, 0.22)', stroke: '#ec4899', badge: '#be185d' },
];

export function drawSegmentWaveform(ctx: CanvasRenderingContext2D, opts: DrawSegmentsOptions): void {
  const { width, height, dpr, pcm, durationSec, segments, selectedSegmentId, playheadSec } = opts;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const secToX = (s: number) => (durationSec > 0 ? (s / durationSec) * width : 0);
  const midY = height / 2;
  const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';

  // 1. Rendu des zones de tranches (Segments)
  segments.forEach((seg, idx) => {
    const xStart = secToX(seg.startSec);
    const xEnd = secToX(seg.endSec);
    const segW = Math.max(2, xEnd - xStart);
    const color = SEGMENT_COLORS[idx % SEGMENT_COLORS.length];
    const isSelected = seg.id === selectedSegmentId;

    // Fond de tranche
    ctx.fillStyle = isSelected ? color.fill.replace('0.22', '0.40') : color.fill;
    ctx.fillRect(xStart, 0, segW, height);

    // Bordures Début & Fin
    ctx.strokeStyle = color.stroke;
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.beginPath(); ctx.moveTo(xStart, 0); ctx.lineTo(xStart, height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(xEnd, 0); ctx.lineTo(xEnd, height); ctx.stroke();

    // Badge haut : Tranche N (Xs)
    const label = `T${idx + 1} (${(seg.endSec - seg.startSec).toFixed(1)}s)`;
    ctx.font = 'bold 9px monospace';
    const textW = ctx.measureText(label).width;
    const badgeW = textW + 8;
    const badgeX = Math.max(xStart + 2, Math.min(xEnd - badgeW - 2, xStart + 4));

    ctx.fillStyle = color.badge;
    ctx.fillRect(badgeX, 2, badgeW, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, badgeX + 4, 12);
  });

  // 2. Forme d'onde (Min / Max downsampled)
  if (pcm && pcm.length > 0) {
    const step = Math.max(1, Math.floor(pcm.length / width));
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x++) {
      const idx = x * step;
      let min = 1.0, max = -1.0;
      for (let j = 0; j < step; j += 4) {
        const val = pcm[idx + j] || 0;
        if (val < min) min = val;
        if (val > max) max = val;
      }
      const sec = (x / width) * durationSec;
      const inAnySeg = segments.some((s) => sec >= s.startSec && sec <= s.endSec);
      ctx.strokeStyle = inAnySeg
        ? (isLight ? '#1c1917' : '#fafaf9')
        : (isLight ? 'rgba(28, 25, 23, 0.28)' : 'rgba(250, 250, 249, 0.28)');
      ctx.beginPath();
      ctx.moveTo(x, midY + min * midY * 0.9);
      ctx.lineTo(x, midY + max * midY * 0.9);
      ctx.stroke();
    }
  }

  // 3. Playhead (Tête de lecture)
  if (playheadSec >= 0) {
    const xPlay = secToX(playheadSec);
    ctx.strokeStyle = isLight ? '#000000' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(xPlay, 0); ctx.lineTo(xPlay, height); ctx.stroke();
  }

  ctx.restore();
}
