/**
 * pianoRollRowsDrawer.ts
 * Tracé des rangées de demi-tons, coloration rouge franc des lignes hors-gamme
 * et surbrillance harmonique / tonique (< 100 lignes).
 */
import type { PatternHarmonyGrid } from '../../types/harmony.types';
import { getChordAtTime } from '../../utils/chordParser';
import { getTonicSemitone } from '../../audio/scaleQuantizer';
import { midiToRowY } from './PianoRollKeyboard';

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
  allowedPitchClasses?: Set<number> | number[] | null;
  rootPitchClass?: number | null;
  tonic?: string;
}

export function drawPianoRollRows(opts: DrawRowsOptions): void {
  const {
    ctx, width, minMidi, maxMidi, rowHeight, harmonyGrid,
    playheadSec, seekStartSec, isPlaying, beatsPerMeasure, beatDurationSec,
    hasAnacrusis = true, pitchShiftSemitones = 0, allowedPitchClasses, rootPitchClass, tonic,
  } = opts;

  const currentSec = isPlaying && playheadSec >= 0 ? playheadSec : seekStartSec;
  const activeChord = getChordAtTime(harmonyGrid, currentSec, beatsPerMeasure, beatDurationSec, hasAnacrusis, pitchShiftSemitones);
  const activePitchClasses = activeChord ? new Set(activeChord.pitchClasses) : null;
  const chordRootPc = activeChord ? ((activeChord.rootMidi % 12) + 12) % 12 : null;
  const fifthPc = chordRootPc !== null ? (chordRootPc + 7) % 12 : null;

  const allowedArr = allowedPitchClasses instanceof Set
    ? Array.from(allowedPitchClasses)
    : Array.isArray(allowedPitchClasses) ? allowedPitchClasses : [];
  const hasScaleLock = allowedArr.length > 0 && allowedArr.length < 12;
  const scaleRootPc = rootPitchClass !== undefined && rootPitchClass !== null
    ? ((rootPitchClass % 12) + 12) % 12
    : (tonic ? getTonicSemitone(tonic) : null);
  const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';

  for (let midi = maxMidi; midi >= minMidi; midi--) {
    const y = midiToRowY(midi, maxMidi, rowHeight);
    const pc = ((midi % 12) + 12) % 12;
    const isBlack = BLACK_KEYS.has(pc);
    const isChordTone = activePitchClasses ? activePitchClasses.has(pc) : false;
    const isRootOrFifth = isChordTone && (pc === chordRootPc || pc === fifthPc);
    const inScale = !hasScaleLock || allowedArr.includes(pc);
    const isScaleTonic = hasScaleLock && scaleRootPc !== null && pc === scaleRootPc;

    if (!inScale) {
      ctx.fillStyle = isLight ? 'rgba(220, 38, 38, 0.16)' : 'rgba(185, 28, 28, 0.28)';
      ctx.fillRect(0, y, width, rowHeight);
      ctx.strokeStyle = isLight ? 'rgba(185, 28, 28, 0.30)' : 'rgba(239, 68, 68, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5); ctx.lineTo(width, y + 0.5);
      ctx.moveTo(0, y + rowHeight); ctx.lineTo(width, y + rowHeight);
      ctx.stroke();
      continue;
    }

    if (isRootOrFifth) {
      ctx.fillStyle = isLight
        ? (isBlack ? 'rgba(217, 119, 6, 0.18)' : 'rgba(217, 119, 6, 0.24)')
        : (isBlack ? 'rgba(200, 138, 43, 0.16)' : 'rgba(200, 138, 43, 0.22)');
    } else if (isChordTone) {
      ctx.fillStyle = isLight
        ? (isBlack ? 'rgba(217, 119, 6, 0.10)' : 'rgba(217, 119, 6, 0.14)')
        : (isBlack ? 'rgba(200, 138, 43, 0.08)' : 'rgba(200, 138, 43, 0.12)');
    } else if (hasScaleLock) {
      ctx.fillStyle = isScaleTonic ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.07)';
    } else if (isBlack) {
      ctx.fillStyle = isLight ? 'rgba(42, 33, 27, 0.07)' : 'rgba(0, 0, 0, 0.42)';
    } else if (pc === 0) {
      ctx.fillStyle = isLight ? 'rgba(180, 83, 9, 0.08)' : 'rgba(212, 175, 55, 0.06)';
    } else {
      ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.035)';
    }

    ctx.fillRect(0, y, width, rowHeight);
    if (isScaleTonic) {
      ctx.fillStyle = '#d4af37';
      ctx.fillRect(0, y + 1, 4, rowHeight - 2);
    }

    ctx.strokeStyle = isScaleTonic
      ? 'rgba(212, 175, 55, 0.35)'
      : isChordTone
      ? 'rgba(200, 138, 43, 0.35)'
      : pc === 0
      ? 'rgba(212, 175, 55, 0.25)'
      : (isLight ? 'rgba(26, 26, 26, 0.08)' : 'rgba(255, 255, 255, 0.05)');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + rowHeight);
    ctx.lineTo(width, y + rowHeight);
    ctx.stroke();
  }
}
