/**
 * pianoRollDrawer.ts
 * Rendu Canvas 2D de la grille des notes (C2..C5, subdivisions, briques VariAudio, courbe verte, playhead).
 * Repère temporel 100 % unifié : tGridStart = hasAnacrusis ? 0 : t1OffsetSec, gridDur = totalSteps * stepDurSec (< 115 lignes).
 */
import type { PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import type { PatternHarmonyGrid } from '../../types/harmony.types';
import { drawPianoRollRows } from './pianoRollRowsDrawer';
import { drawPianoRollBricks, drawVariAudioPulledCurveOverlay } from './pianoRollBricksDrawer';

export interface DrawGridOptions {
  width: number; height: number; dpr: number; minMidi: number; maxMidi: number; rowHeight: number;
  beatsPerMeasure: number; beatResolutions: number[]; allSteps: VocalStepData[]; pitchCurve: PitchCurvePoint[];
  rawPitchCurve?: PitchCurvePoint[]; totalDurationSec: number; anacrusisDurationSec: number; seekStartSec: number;
  playheadSec: number; isPlaying: boolean; hasAnacrusis?: boolean; t1OffsetSec?: number; bpm?: number;
  selectedStepIdx?: number | null; hoveredBrickRootIdx?: number | null;
  harmonyGrid?: PatternHarmonyGrid; pitchShiftSemitones?: number; allowedPitchClasses?: Set<number> | null;
}

export function drawPianoRollGrid(ctx: CanvasRenderingContext2D, opts: DrawGridOptions): void {
  const { width, height, dpr, minMidi, maxMidi, rowHeight, beatsPerMeasure, beatResolutions, allSteps, pitchCurve, totalDurationSec, anacrusisDurationSec, seekStartSec, playheadSec, isPlaying, hasAnacrusis = true, bpm, selectedStepIdx, hoveredBrickRootIdx, harmonyGrid, pitchShiftSemitones, allowedPitchClasses } = opts;
  ctx.save(); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, width, height);

  const beatDur = bpm ? 60 / bpm : (hasAnacrusis && beatsPerMeasure > 0 ? anacrusisDurationSec / beatsPerMeasure : 0.6);
  const subdivPerBeat = beatResolutions[0] || 4, stepDurSec = beatDur / subdivPerBeat;
  const totalSteps = Math.max(1, allSteps.length > 0 ? allSteps.length : Math.round(totalDurationSec / stepDurSec));
  const stepW = width / totalSteps, gridDur = totalSteps * stepDurSec;
  const tGridStart = hasAnacrusis ? 0 : (opts.t1OffsetSec ?? 0.15);
  const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';

  // 1. Rangées de demi-tons et surbrillance harmonique dynamique
  drawPianoRollRows({
    ctx, width, minMidi, maxMidi, rowHeight, harmonyGrid, playheadSec, seekStartSec,
    isPlaying, beatsPerMeasure, beatDurationSec: beatDur, hasAnacrusis, pitchShiftSemitones, allowedPitchClasses,
  });

  // 2. Grille temporelle discrète 1:1 avec les pas MIDI
  for (let i = 0; i < totalSteps; i++) {
    const x = i * stepW, b = Math.floor(i / subdivPerBeat), s = i % subdivPerBeat;
    if (s === 0) {
      const nextBeatX = Math.min(width, (i + subdivPerBeat) * stepW);
      ctx.fillStyle = b % 2 === 0
        ? (isLight ? 'rgba(0, 0, 0, 0.015)' : 'rgba(255, 255, 255, 0.015)')
        : (isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.12)');
      ctx.fillRect(x, 0, nextBeatX - x, height);

      const isT1 = hasAnacrusis ? (b === beatsPerMeasure) : (b === 0);
      const isExtraEnd = (b > 0 && b % beatsPerMeasure === 0 && (i + subdivPerBeat >= totalSteps));
      ctx.lineWidth = isT1 ? 2.5 : isExtraEnd ? 2 : b % beatsPerMeasure === 0 ? 1.5 : 1;
      ctx.strokeStyle = isT1 ? '#d4af37' : isExtraEnd ? '#f59e0b' : b % beatsPerMeasure === 0 ? (isLight ? 'rgba(26, 26, 26, 0.35)' : 'rgba(245, 240, 230, 0.45)') : (isLight ? 'rgba(26, 26, 26, 0.15)' : 'rgba(245, 240, 230, 0.22)');
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();

      const m1StartBeat = hasAnacrusis ? beatsPerMeasure : 0;
      const firstActiveStep = allSteps.findIndex((st, idx) => idx >= m1StartBeat * subdivPerBeat && st.active && st.midiNumber > 0);
      if (b >= m1StartBeat && b < m1StartBeat + beatsPerMeasure && firstActiveStep > (b + 1) * subdivPerBeat - 1) {
        const beatInM1 = (b - m1StartBeat) + 1;
        ctx.fillStyle = isLight ? 'rgba(180, 83, 9, 0.18)' : 'rgba(245, 158, 11, 0.18)';
        ctx.fillRect(x + 2, 2, Math.min(34, nextBeatX - x - 4), 14);
        ctx.font = 'bold 9px monospace'; ctx.fillStyle = isLight ? '#92400e' : '#fcd34d';
        ctx.fillText(`𝄽 T${beatInM1}`, x + 5, 12);
      }
    } else {
      ctx.strokeStyle = isLight ? 'rgba(26, 26, 26, 0.10)' : 'rgba(245, 240, 230, 0.12)';
      ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // 3. Briques MIDI & Poignées VariAudio
  drawPianoRollBricks({ ctx, allSteps, stepW, minMidi, maxMidi, rowHeight, selectedStepIdx, hoveredBrickRootIdx });

  // 4. Courbe verte de la voix (rawPitchCurve) + Courbe ambre/dorée sous les briques où melodynePullPct > 0
  const baseGreenCurve = opts.rawPitchCurve && opts.rawPitchCurve.length > 1 ? opts.rawPitchCurve : pitchCurve;
  if (baseGreenCurve.length > 1) {
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#10b981';
    for (let p = 0; p < baseGreenCurve.length - 1; p++) {
      const p1 = baseGreenCurve[p], p2 = baseGreenCurve[p + 1];
      if (Math.abs(p2.timeSec - p1.timeSec) > 0.04) continue;
      const x1 = ((p1.timeSec - tGridStart) / gridDur) * width, y1 = (maxMidi - p1.midiFloat) * rowHeight + rowHeight / 2;
      const x2 = ((p2.timeSec - tGridStart) / gridDur) * width, y2 = (maxMidi - p2.midiFloat) * rowHeight + rowHeight / 2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
  }
  drawVariAudioPulledCurveOverlay(ctx, allSteps, pitchCurve, tGridStart, gridDur, width, maxMidi, rowHeight);

  // 5. Lignes de Playhead & Seek
  if (seekStartSec > 0 && (!isPlaying || playheadSec < 0)) {
    const xs = ((seekStartSec - tGridStart) / gridDur) * width;
    ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xs, 0); ctx.lineTo(xs, height); ctx.stroke();
  }
  if (isPlaying && playheadSec >= 0) {
    const xp = ((playheadSec - tGridStart) / gridDur) * width;
    ctx.strokeStyle = isLight ? '#1a1a1a' : '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xp, 0); ctx.lineTo(xp, height); ctx.stroke();
  }
  ctx.restore();
}
