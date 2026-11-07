/**
 * pianoRollBricksDrawer.ts — Rendu Canvas des briques MIDI (binaire & triolets via getStepHorizontalBoundsPx),
 * mode Rythme Replié, poignées VariAudio (0..100%) et courbes ambre/dorées de correction vocale (< 130 lignes).
 */
import type { PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import { getStepHorizontalBoundsPx, getStepTimeWindowSec, findLastTiedStepIndex } from '../../utils/tripletBeatHelper';
import { midiToRowY } from './PianoRollKeyboard';

export interface DrawBricksParams {
  ctx: CanvasRenderingContext2D; allSteps: VocalStepData[]; stepW: number;
  minMidi: number; maxMidi: number; rowHeight: number;
  selectedStepIdx?: number | null; hoveredBrickRootIdx?: number | null;
}

export function isOnBrickVariAudioHandle(
  x: number, y: number, rootIndex: number, endIndex: number,
  midiNumber: number, stepW: number, maxMidi: number, rowHeight: number,
  allSteps?: VocalStepData[]
): boolean {
  const bounds = allSteps && allSteps.length > 0
    ? getStepHorizontalBoundsPx(allSteps, rootIndex, stepW * allSteps.length)
    : { xPx: rootIndex * stepW, widthPx: stepW * (endIndex - rootIndex + 1), hidden: false };
  if (bounds.hidden) return false;
  const bx = bounds.xPx, bw = Math.max(4, bounds.widthPx - 2);
  const by = (maxMidi - midiNumber) * rowHeight + 1.5;
  return x >= bx + 3 && x <= bx + bw - 6 && y >= by - 5 && y <= by + 7;
}

export function drawPianoRollBricks(params: DrawBricksParams): void {
  const { ctx, allSteps, stepW, minMidi, maxMidi, rowHeight, selectedStepIdx, hoveredBrickRootIdx } = params;
  const gridWidth = stepW * allSteps.length;
  for (let i = 0; i < allSteps.length; i++) {
    const step = allSteps[i];
    if (step.tripletSlot === 'unused' || !step.active || step.note === '───' || step.midiNumber < minMidi || step.midiNumber > maxMidi) continue;
    const endIdx = findLastTiedStepIndex(allSteps, i);
    const bounds = getStepHorizontalBoundsPx(allSteps, i, gridWidth);
    if (bounds.hidden || bounds.widthPx <= 0) { i = endIdx; continue; }
    const x = bounds.xPx, w = Math.max(4, bounds.widthPx - 2);
    const y = midiToRowY(step.midiNumber, maxMidi, rowHeight) + 1.5, h = Math.max(4, rowHeight - 3);
    const cutRatio = step.melodyneStartRatio !== undefined ? step.melodyneStartRatio : 0.25;
    const cutW = Math.max(0, Math.min(w, w * cutRatio));
    const pullPct = Math.max(0, Math.min(100, Math.round(step.melodynePullPct ?? 0)));
    const isSel = selectedStepIdx !== undefined && selectedStepIdx !== null && selectedStepIdx >= i && selectedStepIdx <= endIdx;
    const isHov = hoveredBrickRootIdx === i;
    const isUncertain = Boolean(step.isUncertain);
    const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';

    ctx.fillStyle = isUncertain ? (isLight ? '#b45309' : '#78350f') : pullPct > 0 ? (isSel ? '#b45309' : '#92400e') : (isSel ? '#d97706' : '#b45309');
    ctx.strokeStyle = isUncertain ? (isLight ? '#d97706' : '#fbbf24') : pullPct > 0 ? '#fbbf24' : (isSel ? '#fde047' : '#f59e0b');
    ctx.lineWidth = isUncertain ? 2 : (isSel || pullPct > 0 ? 2.2 : 1.5);
    if (isUncertain) ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill(); ctx.stroke();
    if (isUncertain) ctx.setLineDash([]);

    if (cutW > 2) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, cutW, h); ctx.clip();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.fillRect(x, y, cutW, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'; ctx.lineWidth = 1;
      for (let hx = x - h; hx < x + cutW + h; hx += 5) { ctx.beginPath(); ctx.moveTo(hx, y + h); ctx.lineTo(hx + h, y); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.2; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(x + cutW, y); ctx.lineTo(x + cutW, y + h); ctx.stroke(); ctx.setLineDash([]);
    }

    if (pullPct > 0) { ctx.fillStyle = '#fde047'; ctx.fillRect(x + cutW, y, Math.max(2, (w - cutW) * (pullPct / 100)), 3); }
    if (w > 12) { ctx.fillStyle = '#fde68a'; ctx.fillRect(x + w - 3, y + 2, 1.5, h - 4); }
    ctx.fillStyle = isUncertain ? '#fef08a' : '#ffffff'; ctx.font = 'bold 9.5px sans-serif';
    const noteHead = isUncertain ? (w >= 64 && step.alternativeNote ? `? ${step.note}/${step.alternativeNote}` : `? ${step.note}`) : step.note;
    ctx.fillText(step.syllable?.trim() ? `${noteHead} · ${step.syllable.trim()}` : noteHead, x + 4, y + h / 2 + 3.5);

    const cx = x + w / 2, hy = y + 1;
    if (pullPct > 0 || isSel || isHov) {
      const badgeTxt = `◆ ${pullPct}%`;
      ctx.font = 'bold 11px monospace';
      const tw = ctx.measureText(badgeTxt).width + 8;
      ctx.fillStyle = pullPct > 0 ? '#9a3412' : '#1a1a1a'; ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(cx - tw / 2, hy - 8, tw, 14, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.fillText(badgeTxt, cx - tw / 2 + 4, hy + 2.5);
    } else if (w >= 14) {
      ctx.fillStyle = '#9a3412';
      ctx.beginPath(); ctx.moveTo(cx, hy - 3.5); ctx.lineTo(cx + 4, hy); ctx.lineTo(cx, hy + 3.5); ctx.lineTo(cx - 4, hy); ctx.closePath(); ctx.fill();
    }
    i = endIdx;
  }
}

export function drawFoldedRhythmBricks(
  ctx: CanvasRenderingContext2D, allSteps: VocalStepData[], stepW: number, height: number, selectedStepIdx?: number | null
): void {
  const y = Math.round((height - 38) / 2), h = 38, gridWidth = stepW * allSteps.length;
  for (let i = 0; i < allSteps.length; i++) {
    const step = allSteps[i];
    if (step.tripletSlot === 'unused' || !step.active || step.note === '───') continue;
    const endIdx = findLastTiedStepIndex(allSteps, i), ties = endIdx - i;
    const bounds = getStepHorizontalBoundsPx(allSteps, i, gridWidth);
    if (bounds.hidden || bounds.widthPx <= 0) { i = endIdx; continue; }
    const x = bounds.xPx, w = Math.max(6, bounds.widthPx - 2);
    const isSel = selectedStepIdx !== undefined && selectedStepIdx !== null && selectedStepIdx >= i && selectedStepIdx <= endIdx;
    ctx.fillStyle = isSel ? '#d97706' : '#b45309'; ctx.strokeStyle = isSel ? '#fde047' : '#f59e0b'; ctx.lineWidth = isSel ? 2.2 : 1.5;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill(); ctx.stroke();
    if (w > 12) { ctx.fillStyle = '#fde68a'; ctx.fillRect(x + w - 3, y + 3, 1.5, h - 6); }
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10.5px monospace';
    const syl = step.syllable?.trim() || '•', tieSuffix = ties > 0 ? ` ${'─'.repeat(Math.min(4, ties))}` : '';
    ctx.fillText(`${syl}${tieSuffix}`, x + 5, y + h / 2 + 4);
    i = endIdx;
  }
}

export function drawVariAudioPulledCurveOverlay(
  ctx: CanvasRenderingContext2D, allSteps: VocalStepData[], pitchCurve: PitchCurvePoint[],
  tGridStart: number, gridDur: number, width: number, maxMidi: number, rowHeight: number
): void {
  if (!pitchCurve || pitchCurve.length < 2 || allSteps.length === 0 || gridDur <= 0) return;
  const beatDur = (gridDur / allSteps.length) * 4;
  for (let i = 0; i < allSteps.length; i++) {
    const step = allSteps[i];
    if (step.tripletSlot === 'unused' || !step.active || step.note === '───') continue;
    const endIdx = findLastTiedStepIndex(allSteps, i);
    if ((step.melodynePullPct ?? 0) > 0) {
      const { startSec: bStart, endSec: bEnd } = getStepTimeWindowSec(allSteps, i, tGridStart, beatDur);
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3;
      for (let p = 0; p < pitchCurve.length - 1; p++) {
        const p1 = pitchCurve[p], p2 = pitchCurve[p + 1];
        if (p1.timeSec < bStart || p2.timeSec > bEnd || Math.abs(p2.timeSec - p1.timeSec) > 0.04) continue;
        const x1 = ((p1.timeSec - tGridStart) / gridDur) * width, y1 = (maxMidi - p1.midiFloat) * rowHeight + rowHeight / 2;
        const x2 = ((p2.timeSec - tGridStart) / gridDur) * width, y2 = (maxMidi - p2.midiFloat) * rowHeight + rowHeight / 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }
    i = endIdx;
  }
}
