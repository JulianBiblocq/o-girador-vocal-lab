/**
 * slicerWaveformDrawer.ts
 * Rendu Canvas 2D ultra-fluide de la forme d'onde, des bornes de Trim et des piquets de temps (< 135 lignes).
 */
import { formatPegLabel } from './slicerPegInteractions';

export interface SlicerDrawOptions {
  width: number;
  height: number;
  dpr: number;
  pcm: Float32Array;
  sampleRate: number;
  durationSec: number;
  trimInSec: number;
  trimOutSec: number;
  beatPegs: number[];
  targetPegs: number[];
  playheadSec: number;
  selectedPegIdx?: number | null;
  beatsPerMeasure?: number;
}

export function drawSlicerWaveform(ctx: CanvasRenderingContext2D, opts: SlicerDrawOptions): void {
  const { width, height, dpr, pcm, durationSec, trimInSec, trimOutSec, beatPegs, targetPegs, playheadSec, selectedPegIdx, beatsPerMeasure = 4 } = opts;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const secToX = (s: number) => (durationSec > 0 ? (s / durationSec) * width : 0);
  const midY = height / 2;

  // 1. Voiles d'exclusion avant Trim In et apres Trim Out
  const xIn = secToX(trimInSec);
  const xOut = secToX(trimOutSec);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  if (xIn > 0) ctx.fillRect(0, 0, xIn, height);
  if (xOut < width) ctx.fillRect(xOut, 0, width - xOut, height);

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
      const isInside = x >= xIn && x <= xOut;
      ctx.strokeStyle = isInside ? '#f5f5f4' : 'rgba(245, 245, 244, 0.22)';
      ctx.beginPath();
      ctx.moveTo(x, midY + min * midY * 0.9);
      ctx.lineTo(x, midY + max * midY * 0.9);
      ctx.stroke();
    }
  }

  // 3. Reperes fantomes (Cibles regulieres)
  if (targetPegs.length > 1) {
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
    ctx.setLineDash([2, 4]);
    ctx.lineWidth = 1;
    for (const t of targetPegs) {
      const xt = secToX(t);
      if (xt >= xIn && xt <= xOut) {
        ctx.beginPath(); ctx.moveTo(xt, 20); ctx.lineTo(xt, height); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  // 4. Lignes et Badges des Piquets de Temps
  beatPegs.forEach((pegSec, idx) => {
    const xp = secToX(pegSec);
    const isT1 = idx === 0;
    const isSel = selectedPegIdx === idx;
    const color = isT1 ? '#d4af37' : '#38bdf8';

    ctx.strokeStyle = color;
    ctx.lineWidth = isT1 || isSel ? 2.5 : 1.5;
    ctx.beginPath(); ctx.moveTo(xp, 0); ctx.lineTo(xp, height); ctx.stroke();

    // Pastille / Badge haut
    const label = formatPegLabel(idx, beatsPerMeasure);
    ctx.font = 'bold 9px monospace';
    const textW = ctx.measureText(label).width;
    const badgeW = textW + 8;
    const badgeX = Math.max(2, Math.min(width - badgeW - 2, xp - badgeW / 2));

    ctx.fillStyle = isT1 ? '#854d0e' : '#0369a1';
    ctx.fillRect(badgeX, 2, badgeW, 14);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(badgeX, 2, badgeW, 14);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, badgeX + 4, 12);
  });

  // 5. Poignees de Trim
  const drawTrimHandle = (x: number, label: string, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    ctx.font = 'bold 9px monospace';
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = color;
    ctx.fillRect(Math.max(2, Math.min(width - tw - 8, x - tw / 2 - 4)), height - 16, tw + 8, 14);
    ctx.fillStyle = '#000000';
    ctx.fillText(label, Math.max(6, Math.min(width - tw - 4, x - tw / 2)), height - 6);
  };
  drawTrimHandle(xIn, '[ TRIM IN', '#10b981');
  drawTrimHandle(xOut, 'TRIM OUT ]', '#ef4444');

  // 6. Playhead
  if (playheadSec >= 0) {
    const xPlay = secToX(playheadSec);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(xPlay, 0); ctx.lineTo(xPlay, height); ctx.stroke();
  }
  ctx.restore();
}
