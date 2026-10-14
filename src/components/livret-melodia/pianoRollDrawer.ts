/**
 * pianoRollDrawer.ts
 * Rendu Canvas 2D : Règle à 2 étages (42px : Mesures / Temps), Subdivisions
 * (doubles/triolets), Beat Shading, Briques MIDI et Playhead/Seek synchrone.
 */
import type { PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';

export const RULER_HEIGHT = 42;
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
}

export function drawPianoRollGrid(ctx: CanvasRenderingContext2D, opts: DrawGridOptions): void {
  const { width, height, dpr, minMidi, maxMidi, rowHeight, beatsPerMeasure, beatResolutions, allSteps, pitchCurve, totalDurationSec, anacrusisDurationSec, seekStartSec, playheadSec, isPlaying } = opts;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const beatDur = beatsPerMeasure > 0 ? anacrusisDurationSec / beatsPerMeasure : 0.6;
  const totalBeats = Math.round(totalDurationSec / beatDur);

  // 1. Fond des rangées de notes sous la règle de 42 px
  for (let midi = maxMidi; midi >= minMidi; midi--) {
    const y = RULER_HEIGHT + (maxMidi - midi) * rowHeight;
    const isBlack = BLACK_KEYS.has(((midi % 12) + 12) % 12);
    ctx.fillStyle = isBlack ? 'rgba(0, 0, 0, 0.42)' : midi % 12 === 0 ? 'rgba(212, 175, 55, 0.06)' : 'rgba(255, 255, 255, 0.035)';
    ctx.fillRect(0, y, width, rowHeight);
    ctx.strokeStyle = midi % 12 === 0 ? 'rgba(212, 175, 55, 0.25)' : 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath(); ctx.moveTo(0, y + rowHeight); ctx.lineTo(width, y + rowHeight); ctx.stroke();
  }

  // 2. Grille temporelle : Beat Shading, Subdivisions pointillées et Lignes de mesure
  for (let b = 0; b < totalBeats; b++) {
    const xStart = ((b * beatDur) / totalDurationSec) * width;
    const xEnd = (((b + 1) * beatDur) / totalDurationSec) * width;
    ctx.fillStyle = b % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.12)';
    ctx.fillRect(xStart, RULER_HEIGHT, xEnd - xStart, height - RULER_HEIGHT);

    const res = beatResolutions[b % beatsPerMeasure] || 4;
    const sDur = beatDur / res;
    ctx.strokeStyle = 'rgba(245, 240, 230, 0.12)';
    ctx.setLineDash([2, 3]);
    for (let s = 1; s < res; s++) {
      const xs = ((b * beatDur + s * sDur) / totalDurationSec) * width;
      ctx.beginPath(); ctx.moveTo(xs, 33); ctx.lineTo(xs, height); ctx.stroke();
    }
    ctx.setLineDash([]);

    const isT1 = b === beatsPerMeasure;
    ctx.lineWidth = isT1 ? 2.5 : b % beatsPerMeasure === 0 ? 1.5 : 1;
    ctx.strokeStyle = isT1 ? '#d4af37' : b % beatsPerMeasure === 0 ? 'rgba(245, 240, 230, 0.45)' : 'rgba(245, 240, 230, 0.22)';
    ctx.beginPath(); ctx.moveTo(xStart, b % beatsPerMeasure === 0 ? 0 : 21); ctx.lineTo(xStart, height); ctx.stroke();
  }

  // 3. Règle Temporelle Supérieure à 2 Étages (42 px)
  ctx.fillStyle = 'rgba(18, 16, 15, 0.96)';
  ctx.fillRect(0, 0, width, RULER_HEIGHT);
  ctx.strokeStyle = 'rgba(245, 240, 230, 0.15)';
  ctx.beginPath(); ctx.moveTo(0, 21); ctx.lineTo(width, 21); ctx.stroke();
  ctx.strokeStyle = 'rgba(245, 240, 230, 0.25)';
  ctx.beginPath(); ctx.moveTo(0, RULER_HEIGHT); ctx.lineTo(width, RULER_HEIGHT); ctx.stroke();

  // Étage 1 : Mesures (y = 0..21) & Étage 2 : Temps (y = 21..42)
  for (let b = 0; b < totalBeats; b++) {
    const x = ((b * beatDur) / totalDurationSec) * width;
    const m = Math.floor(b / beatsPerMeasure);
    const bm = b % beatsPerMeasure;
    const isT1 = b === beatsPerMeasure;

    if (bm === 0) {
      ctx.font = isT1 ? 'bold 10px monospace' : 'bold 9.5px monospace';
      ctx.fillStyle = isT1 ? '#d4af37' : m === 0 ? '#fbbf24' : 'rgba(245, 240, 230, 0.85)';
      ctx.fillText(m === 0 ? 'ÉLAN (M-1)' : isT1 ? '★ M1' : `M${m}`, x + 6, 14.5);
    }

    ctx.font = isT1 ? 'bold 9.5px monospace' : '9px monospace';
    ctx.fillStyle = isT1 ? '#d4af37' : 'rgba(245, 240, 230, 0.65)';
    ctx.fillText(`T${bm + 1}`, x + 5, 34);
  }

  // 4. Briques MIDI fusionnées
  const stepW = allSteps.length > 0 ? width / allSteps.length : 0;
  for (let i = 0; i < allSteps.length; i++) {
    const step = allSteps[i];
    if (step.active && step.note !== '───' && step.midiNumber >= minMidi && step.midiNumber <= maxMidi) {
      let ties = 0;
      while (i + 1 + ties < allSteps.length && allSteps[i + 1 + ties].note === '───') ties++;
      const x = i * stepW, w = Math.max(4, stepW * (1 + ties) - 2);
      const y = RULER_HEIGHT + (maxMidi - step.midiNumber) * rowHeight + 1.5, h = Math.max(4, rowHeight - 3);
      ctx.fillStyle = '#b45309'; ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill(); ctx.stroke();
      if (w > 12) { ctx.fillStyle = '#fde68a'; ctx.fillRect(x + w - 3, y + 2, 1.5, h - 4); }
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 9.5px sans-serif';
      ctx.fillText(step.syllable?.trim() ? `${step.note} • ${step.syllable.trim()}` : step.note, x + 4, y + h / 2 + 3.5);
      i += ties;
    }
  }

  // 5. Courbe de pitch « Zéro Rouge »
  if (pitchCurve.length > 1) {
    ctx.lineWidth = 2.5;
    for (let p = 0; p < pitchCurve.length - 1; p++) {
      const p1 = pitchCurve[p], p2 = pitchCurve[p + 1];
      if (Math.abs(p2.timeSec - p1.timeSec) > 0.04) continue;
      const x1 = (p1.timeSec / totalDurationSec) * width, y1 = RULER_HEIGHT + (maxMidi - p1.midiFloat) * rowHeight + rowHeight / 2;
      const x2 = (p2.timeSec / totalDurationSec) * width, y2 = RULER_HEIGHT + (maxMidi - p2.midiFloat) * rowHeight + rowHeight / 2;
      ctx.strokeStyle = Math.abs(p1.midiFloat - Math.round(p1.midiFloat)) <= 0.35 ? '#10b981' : '#f59e0b';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }

  // 6. Marqueur de Seek & Playhead
  if (seekStartSec > 0 && (!isPlaying || playheadSec < 0)) {
    const xs = (seekStartSec / totalDurationSec) * width;
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(xs, 0); ctx.lineTo(xs, height); ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath(); ctx.moveTo(xs - 4, 0); ctx.lineTo(xs + 4, 0); ctx.lineTo(xs, 8); ctx.fill();
  }
  if (isPlaying && playheadSec >= 0) {
    const xp = (playheadSec / totalDurationSec) * width;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(xp, 0); ctx.lineTo(xp, height); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(xp - 5, 0); ctx.lineTo(xp + 5, 0); ctx.lineTo(xp, 9); ctx.fill();
  }
  ctx.restore();
}
