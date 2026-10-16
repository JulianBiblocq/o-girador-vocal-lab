/**
 * melodyneRegionDrawer.ts
 * Rendu Canvas 2D des zones Melodyne libres [ In ── Out ] sur la grille des notes :
 * Voile semi-transparent, lignes verticales franches traversant toute la hauteur (< 85 lignes).
 */
import type { MelodyneRegion } from '../../types/vocalPack.types';

export interface DrawMelodyneRegionsOptions {
  regions: MelodyneRegion[];
  selectedRegionId: string | null;
  width: number;
  height: number;
  totalDurationSec: number;
  hasAnacrusis?: boolean;
  t1OffsetSec?: number;
  bpm?: number;
  beatsPerMeasure?: number;
  anacrusisDurationSec?: number;
}

export function drawMelodyneRegions(
  ctx: CanvasRenderingContext2D,
  opts: DrawMelodyneRegionsOptions
): void {
  const {
    regions, selectedRegionId, width, height, totalDurationSec,
    hasAnacrusis = true, t1OffsetSec, bpm, beatsPerMeasure = 4, anacrusisDurationSec = 2.4,
  } = opts;
  if (!regions || regions.length === 0 || totalDurationSec <= 0) return;

  const beatDur = bpm ? 60 / bpm : (hasAnacrusis && beatsPerMeasure > 0 ? anacrusisDurationSec / beatsPerMeasure : 0.6);
  const totalBeats = Math.max(1, Math.round(totalDurationSec / beatDur));
  const gridDur = totalBeats * beatDur;
  const t1Offset = t1OffsetSec ?? (hasAnacrusis ? 0 : 0.15);

  const secToX = (sec: number) => {
    const rel = hasAnacrusis ? sec : (sec - t1Offset);
    return Math.max(0, Math.min(width, (rel / gridDur) * width));
  };

  ctx.save();
  for (const r of regions) {
    const isSelected = r.id === selectedRegionId;
    const xIn = secToX(r.startSec);
    const xOut = secToX(r.endSec);
    const w = Math.max(2, xOut - xIn);

    // 1. Voile semi-transparent traversant toute la hauteur
    ctx.fillStyle = isSelected ? 'rgba(217, 119, 6, 0.14)' : 'rgba(2, 132, 199, 0.08)';
    ctx.fillRect(xIn, 0, w, height);

    // 2. Deux lignes verticales franches de part en part
    ctx.strokeStyle = isSelected ? '#f59e0b' : 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = isSelected ? 2 : 1.5;
    ctx.setLineDash(isSelected ? [] : [4, 3]);

    // Ligne IN
    ctx.beginPath();
    ctx.moveTo(xIn, 0);
    ctx.lineTo(xIn, height);
    ctx.stroke();

    // Ligne OUT
    ctx.beginPath();
    ctx.moveTo(xOut, 0);
    ctx.lineTo(xOut, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Petits repères triangulaires discrets en tête de ligne
    ctx.fillStyle = isSelected ? '#f59e0b' : '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(xIn, 0); ctx.lineTo(xIn + 6, 0); ctx.lineTo(xIn, 7);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(xOut, 0); ctx.lineTo(xOut - 6, 0); ctx.lineTo(xOut, 7);
    ctx.fill();

    // 4. Badge récapitulatif si zone sélectionnée
    if (isSelected && w > 85) {
      const badgeText = `🎯 ${r.pitchCenterPct}%  📏 ${r.flattenPct}%`;
      const badgeW = 92, badgeX = xIn + (w - badgeW) / 2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.80)';
      ctx.fillRect(badgeX, 2, badgeW, 14);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.strokeRect(badgeX, 2, badgeW, 14);
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 8.5px monospace';
      ctx.fillText(badgeText, badgeX + 4, 12);
    }
  }
  ctx.restore();
}
