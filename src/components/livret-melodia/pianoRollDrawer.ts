/**
 * pianoRollDrawer.ts
 * Rendu Canvas 2D optimisé du Piano Roll pédagogique « Zéro Rouge ».
 * Clavier vertical, grille temporelle, briques fusionnées et courbe de pitch colorée.
 */
import type { PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import { midiToNoteName } from '../../utils/noteUtils';

export interface DrawPianoRollOptions {
  width: number;
  height: number;
  dpr: number;
  minMidi: number;
  maxMidi: number;
  allSteps: VocalStepData[];
  pitchCurve: PitchCurvePoint[];
  totalDurationSec: number;
  anacrusisDurationSec: number;
  playheadSec: number;
  isPlaying: boolean;
}

export const KEYBOARD_WIDTH = 46;

export function drawPianoRoll(ctx: CanvasRenderingContext2D, opts: DrawPianoRollOptions): void {
  const { width, height, dpr, minMidi, maxMidi, allSteps, pitchCurve, totalDurationSec, anacrusisDurationSec, playheadSec, isPlaying } = opts;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  const totalSemitones = Math.max(1, maxMidi - minMidi + 1);
  const rowHeight = height / totalSemitones;
  const gridWidth = width - KEYBOARD_WIDTH;

  // 1. Fond des rangées de notes (Clavier vertical et pistes)
  for (let midi = maxMidi; midi >= minMidi; midi--) {
    const rowIdx = maxMidi - midi;
    const y = rowIdx * rowHeight;
    const isBlackKey = [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

    ctx.fillStyle = isBlackKey ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.03)';
    ctx.fillRect(KEYBOARD_WIDTH, y, gridWidth, rowHeight);

    // Clavier à gauche
    ctx.fillStyle = isBlackKey ? '#1c1917' : '#292524';
    ctx.fillRect(0, y, KEYBOARD_WIDTH, rowHeight);
    ctx.strokeStyle = 'rgba(244, 236, 216, 0.1)';
    ctx.strokeRect(0, y, KEYBOARD_WIDTH, rowHeight);

    ctx.fillStyle = isBlackKey ? 'rgba(244, 236, 216, 0.5)' : '#f4ecd8';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(midiToNoteName(midi), 4, y + rowHeight / 2 + 3);
  }

  // 2. Grille temporelle (Anacrouse, Temps 1, Mesures)
  const xTemps1 = KEYBOARD_WIDTH + (anacrusisDurationSec / totalDurationSec) * gridWidth;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(KEYBOARD_WIDTH, 0, xTemps1 - KEYBOARD_WIDTH, height);

  // Ligne Temps 1
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(xTemps1, 0); ctx.lineTo(xTemps1, height); ctx.stroke();

  // 3. Briques MIDI fusionnées avec tenues '───'
  const stepWidth = allSteps.length > 0 ? gridWidth / allSteps.length : 0;
  let i = 0;
  while (i < allSteps.length) {
    const step = allSteps[i];
    if (step.active && step.note !== '───' && step.midiNumber >= minMidi && step.midiNumber <= maxMidi) {
      let ties = 0;
      while (i + 1 + ties < allSteps.length && allSteps[i + 1 + ties].note === '───') ties++;

      const x = KEYBOARD_WIDTH + i * stepWidth;
      const w = Math.max(3, stepWidth * (1 + ties) - 2);
      const rowIdx = maxMidi - step.midiNumber;
      const y = rowIdx * rowHeight + 1;
      const h = Math.max(3, rowHeight - 2);

      // Brique terracotta / ambre
      ctx.fillStyle = '#b45309';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 3); ctx.fill(); ctx.stroke();

      // Texte note et syllabe
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      const label = step.syllable ? `${step.note} • ${step.syllable}` : step.note;
      ctx.fillText(label, x + 3, y + h / 2 + 3);

      i += 1 + ties;
    } else {
      i++;
    }
  }

  // 4. Courbe de chant « Zéro Rouge »
  if (pitchCurve.length > 1) {
    ctx.lineWidth = 2.5;
    for (let p = 0; p < pitchCurve.length - 1; p++) {
      const p1 = pitchCurve[p];
      const p2 = pitchCurve[p + 1];
      if (Math.abs(p2.timeSec - p1.timeSec) > 0.04) continue; // Saut ou silence

      const x1 = KEYBOARD_WIDTH + (p1.timeSec / totalDurationSec) * gridWidth;
      const y1 = (maxMidi - p1.midiFloat) * rowHeight + rowHeight / 2;
      const x2 = KEYBOARD_WIDTH + (p2.timeSec / totalDurationSec) * gridWidth;
      const y2 = (maxMidi - p2.midiFloat) * rowHeight + rowHeight / 2;

      // Déterminer la justesse locale
      const nearestInt = Math.round(p1.midiFloat);
      const isClose = Math.abs(p1.midiFloat - nearestInt) <= 0.35;
      ctx.strokeStyle = isClose ? '#10b981' : '#f59e0b'; // Vert feuillage ou ocre soleil (zéro rouge)

      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }

  // 5. Tête de lecture 60 FPS
  if (isPlaying && playheadSec >= 0) {
    const xPlay = KEYBOARD_WIDTH + (playheadSec / totalDurationSec) * gridWidth;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(xPlay, 0); ctx.lineTo(xPlay, height); ctx.stroke();
  }
  ctx.restore();
}
