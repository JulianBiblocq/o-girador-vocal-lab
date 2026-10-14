/**
 * pianoRollDrawer.ts
 * Rendu Canvas 2D haute performance de la grille MIDI, des briques et de la courbe Zéro Rouge.
 * Les coordonnées X démarrent à 0 (le clavier est déporté en colonne sticky).
 */
import type { PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';

export interface DrawGridOptions {
  width: number;
  height: number;
  dpr: number;
  minMidi: number;
  maxMidi: number;
  rowHeight: number;
  allSteps: VocalStepData[];
  pitchCurve: PitchCurvePoint[];
  totalDurationSec: number;
  anacrusisDurationSec: number;
  playheadSec: number;
  isPlaying: boolean;
}

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

export function drawPianoRollGrid(ctx: CanvasRenderingContext2D, opts: DrawGridOptions): void {
  const { width, height, dpr, minMidi, maxMidi, rowHeight, allSteps, pitchCurve, totalDurationSec, anacrusisDurationSec, playheadSec, isPlaying } = opts;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  // 1. Fond des rangées de notes (alternance touches blanches / noires façon DAW)
  for (let midi = maxMidi; midi >= minMidi; midi--) {
    const rowIdx = maxMidi - midi;
    const y = rowIdx * rowHeight;
    const semitone = ((midi % 12) + 12) % 12;
    const isBlack = BLACK_KEYS.has(semitone);
    const isC = semitone === 0;

    ctx.fillStyle = isBlack ? 'rgba(0, 0, 0, 0.42)' : isC ? 'rgba(212, 175, 55, 0.06)' : 'rgba(255, 255, 255, 0.035)';
    ctx.fillRect(0, y, width, rowHeight);

    ctx.strokeStyle = isC ? 'rgba(212, 175, 55, 0.25)' : 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y + rowHeight); ctx.lineTo(width, y + rowHeight); ctx.stroke();
  }

  // 2. Grille temporelle (Zone Anacrouse et Ligne Temps 1)
  const xTemps1 = (anacrusisDurationSec / totalDurationSec) * width;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(0, 0, xTemps1, height);

  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(xTemps1, 0); ctx.lineTo(xTemps1, height); ctx.stroke();

  // 3. Briques MIDI fusionnées avec étiquette Note + Syllabe
  const stepWidth = allSteps.length > 0 ? width / allSteps.length : 0;
  let i = 0;
  while (i < allSteps.length) {
    const step = allSteps[i];
    if (step.active && step.note !== '───' && step.midiNumber >= minMidi && step.midiNumber <= maxMidi) {
      let ties = 0;
      while (i + 1 + ties < allSteps.length && allSteps[i + 1 + ties].note === '───') ties++;

      const x = i * stepWidth;
      const w = Math.max(4, stepWidth * (1 + ties) - 2);
      const rowIdx = maxMidi - step.midiNumber;
      const y = rowIdx * rowHeight + 1.5;
      const h = Math.max(4, rowHeight - 3);

      // Corps de la brique terracotta
      ctx.fillStyle = '#b45309';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill(); ctx.stroke();

      // Grip poignée étirement droite
      if (w > 12) {
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(x + w - 3, y + 2, 1.5, h - 4);
      }

      // Texte note et syllabe
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9.5px sans-serif';
      const label = step.syllable?.trim() ? `${step.note} • ${step.syllable.trim()}` : step.note;
      ctx.fillText(label, x + 4, y + h / 2 + 3.5);

      i += 1 + ties;
    } else {
      i++;
    }
  }

  // 4. Courbe de pitch « Zéro Rouge » (Vert feuillage ou Ocre soleil)
  if (pitchCurve.length > 1) {
    ctx.lineWidth = 2.5;
    for (let p = 0; p < pitchCurve.length - 1; p++) {
      const p1 = pitchCurve[p];
      const p2 = pitchCurve[p + 1];
      if (Math.abs(p2.timeSec - p1.timeSec) > 0.04) continue;

      const x1 = (p1.timeSec / totalDurationSec) * width;
      const y1 = (maxMidi - p1.midiFloat) * rowHeight + rowHeight / 2;
      const x2 = (p2.timeSec / totalDurationSec) * width;
      const y2 = (maxMidi - p2.midiFloat) * rowHeight + rowHeight / 2;

      const nearestInt = Math.round(p1.midiFloat);
      const isClose = Math.abs(p1.midiFloat - nearestInt) <= 0.35;
      ctx.strokeStyle = isClose ? '#10b981' : '#f59e0b';

      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }

  // 5. Tête de lecture 60 FPS
  if (isPlaying && playheadSec >= 0) {
    const xPlay = (playheadSec / totalDurationSec) * width;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(xPlay, 0); ctx.lineTo(xPlay, height); ctx.stroke();
  }
  ctx.restore();
}
