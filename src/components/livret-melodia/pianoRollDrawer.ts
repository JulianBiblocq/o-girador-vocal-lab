/**
 * pianoRollDrawer.ts
 * Rendu Canvas 2D de la grille des notes (C2..C5, subdivisions, briques, pitch, playhead).
 * Supporte le repliage de l'Élan M-1 en mode hasAnacrusis === false (< 145 lignes).
 */
import type { PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

export interface DrawGridOptions {
  width: number;
  height: number;
  dpr: number;
  minMidi: number;
  maxMidi: number;
  rowHeight: number;
  beatsPerMeasure: number;
  beatResolutions: number[];
  allSteps: VocalStepData[];
  pitchCurve: PitchCurvePoint[];
  totalDurationSec: number;
  anacrusisDurationSec: number;
  seekStartSec: number;
  playheadSec: number;
  isPlaying: boolean;
  hasAnacrusis?: boolean;
  t1OffsetSec?: number;
  bpm?: number;
  selectedStepIdx?: number | null;
}

export function drawPianoRollGrid(ctx: CanvasRenderingContext2D, opts: DrawGridOptions): void {
  const { width, height, dpr, minMidi, maxMidi, rowHeight, beatsPerMeasure, beatResolutions, allSteps, pitchCurve, totalDurationSec, anacrusisDurationSec, seekStartSec, playheadSec, isPlaying, hasAnacrusis = true, bpm, selectedStepIdx } = opts;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const beatDur = bpm ? 60 / bpm : (hasAnacrusis && beatsPerMeasure > 0 ? anacrusisDurationSec / beatsPerMeasure : 0.6);
  const totalBeats = Math.max(1, Math.round(totalDurationSec / beatDur));
  const gridDur = totalBeats * beatDur;
  const t1Offset = opts.t1OffsetSec ?? (hasAnacrusis ? 0 : 0.15);

  // 1. Rangées de demi-tons
  for (let midi = maxMidi; midi >= minMidi; midi--) {
    const y = (maxMidi - midi) * rowHeight;
    const isBlack = BLACK_KEYS.has(((midi % 12) + 12) % 12);
    ctx.fillStyle = isBlack ? 'rgba(0, 0, 0, 0.42)' : midi % 12 === 0 ? 'rgba(212, 175, 55, 0.06)' : 'rgba(255, 255, 255, 0.035)';
    ctx.fillRect(0, y, width, rowHeight);
    ctx.strokeStyle = midi % 12 === 0 ? 'rgba(212, 175, 55, 0.25)' : 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath(); ctx.moveTo(0, y + rowHeight); ctx.lineTo(width, y + rowHeight); ctx.stroke();
  }

  // 2. Grille temporelle & subdivisions
  for (let b = 0; b < totalBeats; b++) {
    const xStart = (b / totalBeats) * width, xEnd = ((b + 1) / totalBeats) * width;
    ctx.fillStyle = b % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.12)';
    ctx.fillRect(xStart, 0, xEnd - xStart, height);

    const res = beatResolutions[b % beatsPerMeasure] || 4;
    ctx.strokeStyle = 'rgba(245, 240, 230, 0.12)';
    ctx.setLineDash([2, 3]);
    for (let s = 1; s < res; s++) {
      const xs = ((b + s / res) / totalBeats) * width;
      ctx.beginPath(); ctx.moveTo(xs, 0); ctx.lineTo(xs, height); ctx.stroke();
    }
    ctx.setLineDash([]);

    const isT1 = hasAnacrusis ? (b === beatsPerMeasure) : (b === 0);
    ctx.lineWidth = isT1 ? 2.5 : b % beatsPerMeasure === 0 ? 1.5 : 1;
    ctx.strokeStyle = isT1 ? '#d4af37' : b % beatsPerMeasure === 0 ? 'rgba(245, 240, 230, 0.45)' : 'rgba(245, 240, 230, 0.22)';
    ctx.beginPath(); ctx.moveTo(xStart, 0); ctx.lineTo(xStart, height); ctx.stroke();
  }

  // 3. Briques MIDI
  const stepW = allSteps.length > 0 ? width / allSteps.length : 0;
  for (let i = 0; i < allSteps.length; i++) {
    const step = allSteps[i];
    if (step.active && step.note !== '───' && step.midiNumber >= minMidi && step.midiNumber <= maxMidi) {
      let ties = 0;
      while (i + 1 + ties < allSteps.length && allSteps[i + 1 + ties].note === '───') ties++;
      const x = i * stepW, w = Math.max(4, stepW * (1 + ties) - 2);
      const y = (maxMidi - step.midiNumber) * rowHeight + 1.5, h = Math.max(4, rowHeight - 3);
      const cutRatio = step.melodyneStartRatio !== undefined ? step.melodyneStartRatio : 0.25;
      const cutW = Math.max(0, Math.min(w, w * cutRatio));
      const isSel = selectedStepIdx !== undefined && selectedStepIdx !== null && selectedStepIdx >= i && selectedStepIdx <= i + ties;
      ctx.fillStyle = isSel ? '#d97706' : '#b45309';
      ctx.strokeStyle = isSel ? '#fde047' : '#f59e0b';
      ctx.lineWidth = isSel ? 2.5 : 1.5;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill(); ctx.stroke();

      if (cutW > 2) {
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, cutW, h); ctx.clip();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; ctx.fillRect(x, y, cutW, h);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)'; ctx.lineWidth = 1;
        for (let hx = x - h; hx < x + cutW + h; hx += 5) {
          ctx.beginPath(); ctx.moveTo(hx, y + h); ctx.lineTo(hx + h, y); ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.5; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(x + cutW, y); ctx.lineTo(x + cutW, y + h); ctx.stroke();
        ctx.setLineDash([]);
      }

      if (w > 12) { ctx.fillStyle = '#fde68a'; ctx.fillRect(x + w - 3, y + 2, 1.5, h - 4); }
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 9.5px sans-serif';
      ctx.fillText(step.syllable?.trim() ? `${step.note} • ${step.syllable.trim()}` : step.note, x + 4, y + h / 2 + 3.5);
      i += ties;
    }
  }

  // 4. Courbe de pitch
  if (pitchCurve.length > 1) {
    ctx.lineWidth = 2.5;
    for (let p = 0; p < pitchCurve.length - 1; p++) {
      const p1 = pitchCurve[p], p2 = pitchCurve[p + 1];
      if (Math.abs(p2.timeSec - p1.timeSec) > 0.04) continue;
      const t1Rel = hasAnacrusis ? p1.timeSec : (p1.timeSec - t1Offset);
      const t2Rel = hasAnacrusis ? p2.timeSec : (p2.timeSec - t1Offset);
      const x1 = (t1Rel / gridDur) * width, y1 = (maxMidi - p1.midiFloat) * rowHeight + rowHeight / 2;
      const x2 = (t2Rel / gridDur) * width, y2 = (maxMidi - p2.midiFloat) * rowHeight + rowHeight / 2;
      ctx.strokeStyle = Math.abs(p1.midiFloat - Math.round(p1.midiFloat)) <= 0.45 ? '#10b981' : '#f59e0b';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }

  // 5. Lignes de Playhead & Seek
  if (seekStartSec > 0 && (!isPlaying || playheadSec < 0)) {
    const sRel = hasAnacrusis ? seekStartSec : (seekStartSec - t1Offset);
    const xs = (sRel / gridDur) * width;
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(xs, 0); ctx.lineTo(xs, height); ctx.stroke();
  }
  if (isPlaying && playheadSec >= 0) {
    const pRel = hasAnacrusis ? playheadSec : (playheadSec - t1Offset);
    const xp = (pRel / gridDur) * width;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(xp, 0); ctx.lineTo(xp, height); ctx.stroke();
  }
  ctx.restore();
}
