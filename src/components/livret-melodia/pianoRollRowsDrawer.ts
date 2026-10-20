/**
 * pianoRollRowsDrawer.ts
 * Tracé des rangées de demi-tons et surbrillance harmonique dynamique (< 90 lignes).
 */
import type { PatternHarmonyGrid } from '../../types/harmony.types';
import { getChordAtTime } from '../../utils/chordParser';

const BLACK_KEYS = new Set([1, 3, 6, 8, 10]);

export interface DrawRowsOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  minMidi: number;
  maxMidi: number;
  rowHeight: number;
  harmonyGrid?: PatternHarmonyGrid;
  playheadSec: number;
  seekStartSec: number;
  isPlaying: boolean;
  beatsPerMeasure: number;
  beatDurationSec: number;
  hasAnacrusis?: boolean;
  pitchShiftSemitones?: number;
}

export function drawPianoRollRows(opts: DrawRowsOptions): void {
  const {
    ctx, width, minMidi, maxMidi, rowHeight, harmonyGrid,
    playheadSec, seekStartSec, isPlaying, beatsPerMeasure, beatDurationSec,
    hasAnacrusis = true, pitchShiftSemitones = 0,
  } = opts;

  // Calcul de l'accord actif au point d'écoute actuel
  const currentSec = isPlaying && playheadSec >= 0 ? playheadSec : seekStartSec;
  const activeChord = getChordAtTime(harmonyGrid, currentSec, beatsPerMeasure, beatDurationSec, hasAnacrusis, pitchShiftSemitones);
  const activePitchClasses = activeChord ? new Set(activeChord.pitchClasses) : null;
  const rootPc = activeChord ? ((activeChord.rootMidi % 12) + 12) % 12 : null;
  const fifthPc = rootPc !== null ? (rootPc + 7) % 12 : null;

  for (let midi = maxMidi; midi >= minMidi; midi--) {
    const y = (maxMidi - midi) * rowHeight;
    const pc = ((midi % 12) + 12) % 12;
    const isBlack = BLACK_KEYS.has(pc);
    const isChordTone = activePitchClasses ? activePitchClasses.has(pc) : false;
    const isRootOrFifth = isChordTone && (pc === rootPc || pc === fifthPc);

    if (isRootOrFifth) {
      // Surbrillance douce Cordel ambrée / or pour fondamentale et quinte
      ctx.fillStyle = isBlack ? 'rgba(200, 138, 43, 0.16)' : 'rgba(200, 138, 43, 0.22)';
    } else if (isChordTone) {
      // Surbrillance plus légère pour tierce / septième
      ctx.fillStyle = isBlack ? 'rgba(200, 138, 43, 0.08)' : 'rgba(200, 138, 43, 0.12)';
    } else if (isBlack) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    } else if (pc === 0) {
      ctx.fillStyle = 'rgba(212, 175, 55, 0.06)';
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    }

    ctx.fillRect(0, y, width, rowHeight);

    // Ligne de démarcation horizontale
    ctx.strokeStyle = isChordTone
      ? 'rgba(200, 138, 43, 0.35)'
      : pc === 0
      ? 'rgba(212, 175, 55, 0.25)'
      : 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.moveTo(0, y + rowHeight);
    ctx.lineTo(width, y + rowHeight);
    ctx.stroke();
  }
}
