/**
 * waveformOverlayDrawer.ts
 * Rendu Canvas 2D ultra-performant des formes d'onde, fanions de trim et tête de lecture (labels i18n purs).
 */

interface DrawOverlayOptions {
  width: number;
  height: number;
  dpr: number;
  peaks: Float32Array | null;
  totalDurationSec: number;
  trimStartSec: number;
  trimEndSec: number;
  latencyOffsetMs: number;
  playheadSec: number;
  isPlaying: boolean;
  trimStartLabel: string;
  trimEndLabel: string;
}

export function drawWaveformOverlay(ctx: CanvasRenderingContext2D, opts: DrawOverlayOptions): void {
  const { width, height, dpr, peaks, totalDurationSec, trimStartSec, trimEndSec, latencyOffsetMs, playheadSec, isPlaying, trimStartLabel, trimEndLabel } = opts;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const offsetSec = latencyOffsetMs / 1000;
  const xOffset = (offsetSec / totalDurationSec) * width;
  const xTrimStart = Math.max(0, (trimStartSec / totalDurationSec) * width);
  const xTrimEnd = Math.min(width, (trimEndSec / totalDurationSec) * width);
  const cy = height / 2;

  if (peaks) {
    const bins = peaks.length;
    const barWidth = width / bins;
    for (let i = 0; i < bins; i++) {
      const x = (i * barWidth) + xOffset;
      if (x < -barWidth || x > width) continue;
      const amp = peaks[i] * (height / 2);
      const isInTrim = x >= xTrimStart && x <= xTrimEnd;
      ctx.fillStyle = isInTrim ? '#ab3a26' : 'rgba(244, 236, 216, 0.2)';
      ctx.fillRect(x, cy - amp, Math.max(1, barWidth - 0.5), amp * 2);
    }
  }

  // Assombrissement des zones rognées
  ctx.fillStyle = 'rgba(10, 10, 10, 0.65)';
  ctx.fillRect(0, 0, xTrimStart, height);
  ctx.fillRect(xTrimEnd, 0, width - xTrimEnd, height);

  // Poignée Début (Cyan) avec fanion large
  ctx.font = 'bold 9px monospace';
  const startTextWidth = ctx.measureText(trimStartLabel).width;
  const flagStartWidth = Math.max(68, Math.round(startTextWidth + 12));
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(xTrimStart, 0); ctx.lineTo(xTrimStart, height); ctx.stroke();
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(xTrimStart, 0, flagStartWidth, 18);
  ctx.strokeRect(xTrimStart, 0, flagStartWidth, 18);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(trimStartLabel, xTrimStart + 6, 12);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(xTrimStart - 4, height - 12, 8, 12);

  // Poignée Fin (Corail) avec fanion large
  const endTextWidth = ctx.measureText(trimEndLabel).width;
  const flagEndWidth = Math.max(56, Math.round(endTextWidth + 12));
  const flagEndX = Math.max(0, xTrimEnd - flagEndWidth);
  ctx.strokeStyle = '#f87171';
  ctx.beginPath(); ctx.moveTo(xTrimEnd, 0); ctx.lineTo(xTrimEnd, height); ctx.stroke();
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(flagEndX, 0, flagEndWidth, 18);
  ctx.strokeRect(flagEndX, 0, flagEndWidth, 18);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(trimEndLabel, flagEndX + 6, 12);
  ctx.fillStyle = '#f87171';
  ctx.fillRect(xTrimEnd - 4, height - 12, 8, 12);

  // Tête de lecture 60 FPS
  if (isPlaying && playheadSec >= 0) {
    const xPlay = (playheadSec / totalDurationSec) * width;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(xPlay, 0); ctx.lineTo(xPlay, height); ctx.stroke();
  }
  ctx.restore();
}
