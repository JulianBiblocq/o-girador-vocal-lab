/**
 * pianoRollSmartGhostDrawer.ts
 * Aperçu visuel « Hover Ghost » du Smart Tool sur le Canvas du Piano Roll (0 emoji couleur 3D) :
 * Pastille [Lier] vectorielle + aperçu Bézier/tenue, ligne de scission ✂ et poignée droite ↔ (< 95 lignes).
 */
import type { VocalStepData } from '../../types/vocalPack.types';
import { getStepHorizontalBoundsPx } from '../../utils/tripletBeatHelper';
import { midiToRowY } from './PianoRollKeyboard';
import { findAdjacentBrickLinkCandidates, type SmartToolHoverState } from './pianoRollSmartTool';

function drawVectorChainPill(ctx: CanvasRenderingContext2D, cx: number, cy: number, active: boolean, isMelisma: boolean): void {
  ctx.save();
  ctx.fillStyle = active ? (isMelisma ? '#0369a1' : '#9a3412') : 'rgba(24, 19, 15, 0.88)';
  ctx.strokeStyle = active ? '#fde047' : '#d4af37';
  ctx.lineWidth = active ? 1.8 : 1.2;
  ctx.beginPath(); ctx.roundRect(cx - 9, cy - 7, 18, 14, 4); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.roundRect(cx - 5.5, cy - 2.5, 6.5, 5, 2); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(cx - 1, cy - 2.5, 6.5, 5, 2); ctx.stroke();
  ctx.restore();
}

export function drawSmartToolHoverGhost(params: {
  ctx: CanvasRenderingContext2D; allSteps: VocalStepData[]; width: number;
  maxMidi: number; rowHeight: number; hoveredBrickRootIdx?: number | null;
  smartHover?: SmartToolHoverState | null;
}): void {
  const { ctx, allSteps, width, maxMidi, rowHeight, hoveredBrickRootIdx, smartHover } = params;
  if (!allSteps.length || width <= 0) return;

  const candidates = findAdjacentBrickLinkCandidates(allSteps, width, maxMidi, rowHeight);
  for (const c of candidates) {
    const isDirectHit = smartHover?.zone === 'link_gap' && smartHover.linkCandidate?.leftRootIndex === c.leftRootIndex;
    const isNeighborHov = hoveredBrickRootIdx === c.leftRootIndex || hoveredBrickRootIdx === c.rightRootIndex;
    if (!isDirectHit && !isNeighborHov) continue;
    const r2Step = allSteps[c.rightRootIndex];
    if (c.isMelisma && (r2Step?.isMelisma || r2Step?.syllable?.trim() === '_')) continue;

    if (isDirectHit) {
      const b1 = getStepHorizontalBoundsPx(allSteps, c.leftRootIndex, width);
      const b2 = getStepHorizontalBoundsPx(allSteps, c.rightRootIndex, width);
      const m1 = allSteps[c.leftRootIndex].midiNumber ?? 60, m2 = allSteps[c.rightRootIndex].midiNumber ?? 60;
      const y1 = midiToRowY(m1, maxMidi, rowHeight) + rowHeight / 2, y2 = midiToRowY(m2, maxMidi, rowHeight) + rowHeight / 2;
      ctx.save();
      ctx.strokeStyle = c.isMelisma ? '#7dd3fc' : '#fde047';
      ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(b1.xPx + b1.widthPx - 3, y1);
      if (c.isMelisma) ctx.quadraticCurveTo(c.x, Math.min(y1, y2) - rowHeight * 0.65, b2.xPx + 3, y2);
      else ctx.lineTo(b2.xPx + 3, y2);
      ctx.stroke(); ctx.restore();
    }
    drawVectorChainPill(ctx, c.x, c.y, isDirectHit, c.isMelisma);
  }

  if (!smartHover || smartHover.rootIndex === null) return;
  const bounds = getStepHorizontalBoundsPx(allSteps, smartHover.rootIndex, width);
  const rootMidi = allSteps[smartHover.rootIndex]?.midiNumber ?? 60;
  const by = midiToRowY(rootMidi, maxMidi, rowHeight) + 1.5, bh = Math.max(4, rowHeight - 3);

  if (smartHover.zone === 'split_bottom' && smartHover.splitStepIndex !== null) {
    const sx = getStepHorizontalBoundsPx(allSteps, smartHover.splitStepIndex, width, false).xPx;
    ctx.save();
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 2; ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(sx, by); ctx.lineTo(sx, by + bh); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#0c4a6e'; ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(sx - 8, by + bh - 8, 16, 13, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px monospace';
    ctx.fillText('✂', sx - 4.5, by + bh + 2);
    ctx.restore();
  } else if (smartHover.zone === 'resize_right') {
    const rx = bounds.xPx + Math.max(4, bounds.widthPx - 2);
    ctx.save();
    ctx.fillStyle = '#fde047';
    ctx.fillRect(rx - 4, by + 1, 3.5, bh - 2);
    ctx.fillStyle = '#18130f'; ctx.strokeStyle = '#fde047'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(rx - 15, by + bh / 2 - 6, 15, 12, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fde047'; ctx.font = 'bold 9.5px monospace';
    ctx.fillText('↔', rx - 12.5, by + bh / 2 + 3);
    ctx.restore();
  }
}
