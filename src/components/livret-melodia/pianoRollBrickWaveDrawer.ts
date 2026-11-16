/**
 * pianoRollBrickWaveDrawer.ts
 * Rendu subtil de la silhouette d'amplitude vocale interne et du hachurage de tête consonantique
 * (type Melodyne 5) dans les briques du Piano Roll (< 65 lignes).
 */
import type { VocalStepData } from '../../types/vocalPack.types';

export function drawBrickConsonantAndWaveOverlay(
  ctx: CanvasRenderingContext2D,
  step: VocalStepData,
  x: number,
  y: number,
  w: number,
  h: number,
  isMelisma: boolean
): number {
  const bins = step.waveEnvelopeBins;
  if (bins && bins.length >= 2 && w >= 12 && h >= 8) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, Math.max(2, w - 2), Math.max(2, h - 2), 2);
    ctx.clip();
    const midY = y + h / 2;
    const maxHalfH = Math.max(1.5, h * 0.42);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    for (let b = 0; b < bins.length; b++) {
      const bx = x + (b / (bins.length - 1)) * w;
      const amp = Math.max(0.05, Math.min(1, bins[b])) * maxHalfH;
      if (b === 0) ctx.moveTo(bx, midY - amp);
      else ctx.lineTo(bx, midY - amp);
    }
    for (let b = bins.length - 1; b >= 0; b--) {
      const bx = x + (b / (bins.length - 1)) * w;
      const amp = Math.max(0.05, Math.min(1, bins[b])) * maxHalfH;
      ctx.lineTo(bx, midY + amp);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const cutRatio = step.melodyneStartRatio !== undefined ? step.melodyneStartRatio : (step.consonantHeadRatio ?? 0.18);
  const cutW = Math.max(0, Math.min(w, w * cutRatio));
  if (cutW > 2 && !isMelisma) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cutW, h);
    ctx.clip();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.fillRect(x, y, cutW, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.17)';
    ctx.lineWidth = 1;
    for (let hx = x - h; hx < x + cutW + h; hx += 5) {
      ctx.beginPath();
      ctx.moveTo(hx, y + h);
      ctx.lineTo(hx + h, y);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(x + cutW, y);
    ctx.lineTo(x + cutW, y + h);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  return cutW;
}
