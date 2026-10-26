/**
 * slicerSegmentDrawer.ts
 * Rendu Canvas 2D avec grille métronome globale (T1..T4), anacrouse et chute 1T (< 145 lignes).
 */
import type { SliceSegment } from '../../types/slicerSegments.types';

export interface DrawSegmentsOptions {
  width: number; height: number; dpr: number; pcm: Float32Array;
  durationSec: number; segments: SliceSegment[]; selectedSegmentId: string | null;
  playheadSec: number; bpm: number; gridOffsetSec: number; showMetronomeGrid?: boolean;
}

export function drawSegmentWaveform(ctx: CanvasRenderingContext2D, opts: DrawSegmentsOptions): void {
  const { width, height, dpr, pcm, durationSec, segments, selectedSegmentId, playheadSec, bpm, gridOffsetSec, showMetronomeGrid = true } = opts;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const secToX = (s: number) => (durationSec > 0 ? (s / durationSec) * width : 0);
  const midY = height / 2;
  const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
  const beatDur = bpm > 0 ? 60 / bpm : 1.09;
  const measureDur = beatDur * 4;

  // 1. Grille du Métronome sur tout le fichier (T1 en or/rouge, T2-T4 en pointillés)
  if (showMetronomeGrid && durationSec > 0) {
    const totalMeasures = Math.ceil(durationSec / measureDur) + 2;
    for (let m = -1; m < totalMeasures; m++) {
      const mStart = gridOffsetSec + m * measureDur;
      const xT1 = secToX(mStart);
      if (xT1 >= 0 && xT1 <= width) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(xT1, 0); ctx.lineTo(xT1, height); ctx.stroke();

        ctx.font = 'bold 8px monospace';
        ctx.fillStyle = '#ef4444';
        ctx.fillText(`M${m + 1}`, Math.max(2, xT1 + 2), 10);
      }

      for (let b = 1; b < 4; b++) {
        const xBeat = secToX(mStart + b * beatDur);
        if (xBeat >= 0 && xBeat <= width) {
          ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.moveTo(xBeat, 14); ctx.lineTo(xBeat, height); ctx.stroke();
        }
      }
    }
    ctx.setLineDash([]);
  }

  // 2. Rendu des Tranches avec zones -Ana, ligne T1 et débordement +1T
  segments.forEach((seg, idx) => {
    const xStart = secToX(seg.startSec);
    const xEnd = secToX(seg.endSec);
    const segW = Math.max(2, xEnd - xStart);
    const isSelected = seg.id === selectedSegmentId;
    const hasAna = seg.hasAnacrusis !== false;
    const hasTail = seg.hasTailBeat !== false;
    const mCount = seg.measuresCount ?? 2;

    // Calcul du Temps 1 interne au bloc
    const t1Sec = hasAna ? Math.min(seg.endSec, seg.startSec + measureDur) : seg.startSec;
    const xT1 = secToX(t1Sec);

    // Fond de tranche
    ctx.fillStyle = isSelected ? 'rgba(245, 158, 11, 0.28)' : 'rgba(245, 158, 11, 0.16)';
    ctx.fillRect(xStart, 0, segW, height);

    // Zone Anacrouse (-Ana) avant T1
    if (hasAna && xT1 > xStart) {
      ctx.fillStyle = 'rgba(217, 119, 6, 0.18)';
      ctx.fillRect(xStart, 0, xT1 - xStart, height);
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#d97706';
      ctx.fillText('-Ana', xStart + 2, height - 4);
    }

    // Zone débordement (+1T) après le corps du bloc
    const bodyEndSec = t1Sec + mCount * measureDur;
    const xBodyEnd = secToX(bodyEndSec);
    if (hasTail && xBodyEnd < xEnd) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
      ctx.fillRect(xBodyEnd, 0, xEnd - xBodyEnd, height);
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = '#10b981';
      ctx.fillText('+1T', xBodyEnd + 2, height - 4);
    }

    // Bordures Début & Fin
    ctx.strokeStyle = isSelected ? '#f59e0b' : '#d97706';
    ctx.lineWidth = isSelected ? 2.5 : 1.5;
    ctx.beginPath(); ctx.moveTo(xStart, 0); ctx.lineTo(xStart, height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(xEnd, 0); ctx.lineTo(xEnd, height); ctx.stroke();

    // Ligne T1 marquée du bloc
    if (hasAna && xT1 > xStart && xT1 < xEnd) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xT1, 0); ctx.lineTo(xT1, height); ctx.stroke();
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(xT1 - 8, 2, 16, 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px monospace';
      ctx.fillText('T1', xT1 - 5, 11);
    }

    // Badge haut de tranche
    const label = `T${idx + 1} (${mCount}M)`;
    ctx.font = 'bold 9px monospace';
    const textW = ctx.measureText(label).width + 8;
    ctx.fillStyle = '#b45309';
    ctx.fillRect(xStart + 2, 2, textW, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, xStart + 6, 12);
  });

  // 3. Forme d'onde downsampled
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
      ctx.strokeStyle = isLight ? '#1c1917' : '#fafaf9';
      ctx.beginPath(); ctx.moveTo(x, midY + min * midY * 0.9); ctx.lineTo(x, midY + max * midY * 0.9); ctx.stroke();
    }
  }

  // 4. Playhead
  if (playheadSec >= 0) {
    const xPlay = secToX(playheadSec);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(xPlay, 0); ctx.lineTo(xPlay, height); ctx.stroke();
  }
  ctx.restore();
}
