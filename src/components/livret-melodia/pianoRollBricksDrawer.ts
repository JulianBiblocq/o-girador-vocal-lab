/**
 * pianoRollBricksDrawer.ts
 * Rendu Canvas des briques MIDI, poignées supérieures Cubase VariAudio (0..100%)
 * et courbes ambre/dorées de correction vocale par brique (< 125 lignes).
 */
import type { PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';

export interface DrawBricksParams {
  ctx: CanvasRenderingContext2D;
  allSteps: VocalStepData[];
  stepW: number;
  minMidi: number;
  maxMidi: number;
  rowHeight: number;
  selectedStepIdx?: number | null;
  hoveredBrickRootIdx?: number | null;
}

export function isOnBrickVariAudioHandle(
  x: number, y: number, rootIndex: number, endIndex: number,
  midiNumber: number, stepW: number, maxMidi: number, rowHeight: number
): boolean {
  const bx = rootIndex * stepW;
  const bw = Math.max(4, stepW * (endIndex - rootIndex + 1) - 2);
  const by = (maxMidi - midiNumber) * rowHeight + 1.5;
  return x >= bx + 3 && x <= bx + bw - 6 && y >= by - 5 && y <= by + 7;
}

export function drawPianoRollBricks(params: DrawBricksParams): void {
  const { ctx, allSteps, stepW, minMidi, maxMidi, rowHeight, selectedStepIdx, hoveredBrickRootIdx } = params;

  for (let i = 0; i < allSteps.length; i++) {
    const step = allSteps[i];
    if (!step.active || step.note === '───' || step.midiNumber < minMidi || step.midiNumber > maxMidi) continue;

    let ties = 0;
    while (i + 1 + ties < allSteps.length && allSteps[i + 1 + ties].note === '───') ties++;
    const x = i * stepW, w = Math.max(4, stepW * (1 + ties) - 2);
    const y = (maxMidi - step.midiNumber) * rowHeight + 1.5, h = Math.max(4, rowHeight - 3);
    const cutRatio = step.melodyneStartRatio !== undefined ? step.melodyneStartRatio : 0.25;
    const cutW = Math.max(0, Math.min(w, w * cutRatio));
    const pullPct = Math.max(0, Math.min(100, Math.round(step.melodynePullPct ?? 0)));
    const isSel = selectedStepIdx !== undefined && selectedStepIdx !== null && selectedStepIdx >= i && selectedStepIdx <= i + ties;
    const isHov = hoveredBrickRootIdx === i;

    ctx.fillStyle = pullPct > 0 ? (isSel ? '#b45309' : '#92400e') : (isSel ? '#d97706' : '#b45309');
    ctx.strokeStyle = pullPct > 0 ? '#fbbf24' : (isSel ? '#fde047' : '#f59e0b');
    ctx.lineWidth = isSel || pullPct > 0 ? 2.2 : 1.5;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill(); ctx.stroke();

    // Zone d'attaque consonantique protégée
    if (cutW > 2) {
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, cutW, h); ctx.clip();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.fillRect(x, y, cutW, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'; ctx.lineWidth = 1;
      for (let hx = x - h; hx < x + cutW + h; hx += 5) {
        ctx.beginPath(); ctx.moveTo(hx, y + h); ctx.lineTo(hx + h, y); ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.2; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(x + cutW, y); ctx.lineTo(x + cutW, y + h); ctx.stroke(); ctx.setLineDash([]);
    }

    // Barre de remplissage VariAudio sur le bord supérieur de la brique
    if (pullPct > 0) {
      const fillW = Math.max(2, (w - cutW) * (pullPct / 100));
      ctx.fillStyle = '#fde047';
      ctx.fillRect(x + cutW, y, fillW, 3);
    }

    // Poignée d'étirement droite
    if (w > 12) {
      ctx.fillStyle = '#fde68a';
      ctx.fillRect(x + w - 3, y + 2, 1.5, h - 4);
    }

    // Texte Note + Syllabe au centre de la brique
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 9.5px sans-serif';
    ctx.fillText(step.syllable?.trim() ? `${step.note} • ${step.syllable.trim()}` : step.note, x + 4, y + h / 2 + 3.5);

    // Poignée supérieure Cubase VariAudio (pastille ◆ sur le bord haut central)
    const cx = x + w / 2, hy = y + 1;
    if (pullPct > 0 || isSel || isHov) {
      const badgeTxt = `◆ ${pullPct}%`;
      ctx.font = 'bold 8.5px monospace';
      const tw = ctx.measureText(badgeTxt).width + 6;
      ctx.fillStyle = pullPct > 0 ? '#facc15' : '#0284c7';
      ctx.beginPath(); ctx.roundRect(cx - tw / 2, hy - 6, tw, 11, 3); ctx.fill();
      ctx.fillStyle = pullPct > 0 ? '#1c1917' : '#ffffff';
      ctx.fillText(badgeTxt, cx - tw / 2 + 3, hy + 2.5);
    } else if (w >= 14) {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(cx, hy - 3.5); ctx.lineTo(cx + 4, hy); ctx.lineTo(cx, hy + 3.5); ctx.lineTo(cx - 4, hy);
      ctx.closePath(); ctx.fill();
    }

    i += ties;
  }
}

export function drawVariAudioPulledCurveOverlay(
  ctx: CanvasRenderingContext2D, allSteps: VocalStepData[], pitchCurve: PitchCurvePoint[],
  tGridStart: number, gridDur: number, width: number, maxMidi: number, rowHeight: number
): void {
  if (!pitchCurve || pitchCurve.length < 2 || allSteps.length === 0 || gridDur <= 0) return;
  const stepDur = gridDur / allSteps.length;
  for (let i = 0; i < allSteps.length; i++) {
    const step = allSteps[i];
    if (!step.active || step.note === '───') continue;
    let ties = 0;
    while (i + 1 + ties < allSteps.length && allSteps[i + 1 + ties].note === '───') ties++;
    if ((step.melodynePullPct ?? 0) > 0) {
      const bStart = tGridStart + i * stepDur, bEnd = tGridStart + (i + 1 + ties) * stepDur;
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3;
      for (let p = 0; p < pitchCurve.length - 1; p++) {
        const p1 = pitchCurve[p], p2 = pitchCurve[p + 1];
        if (p1.timeSec < bStart || p2.timeSec > bEnd || Math.abs(p2.timeSec - p1.timeSec) > 0.04) continue;
        const x1 = ((p1.timeSec - tGridStart) / gridDur) * width, y1 = (maxMidi - p1.midiFloat) * rowHeight + rowHeight / 2;
        const x2 = ((p2.timeSec - tGridStart) / gridDur) * width, y2 = (maxMidi - p2.midiFloat) * rowHeight + rowHeight / 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
    }
    i += ties;
  }
}
