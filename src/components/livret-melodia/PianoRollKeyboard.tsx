/**
 * PianoRollKeyboard.tsx
 * Clavier matriciel 64 px à gauche du Piano Roll : alignement 1:1 absolu (y = (maxMidi - midi) * rowHeight)
 * avec chaque rangée de brique MIDI, la courbe verte et indicateur rouge hors-gamme (< 105 lignes).
 */
import React from 'react';
import { midiToNoteName } from '../../utils/noteUtils';
import { getTonicSemitone } from '../../audio/scaleQuantizer';

export const KEYBOARD_WIDTH = 64;

export function midiToRowY(midi: number, maxMidi: number, rowHeight: number): number {
  return (maxMidi - midi) * rowHeight;
}

interface PianoRollKeyboardProps {
  minMidi: number;
  maxMidi: number;
  rowHeight: number;
  allowedPitchClasses?: Set<number> | number[] | null;
  tonic?: string;
  rootPitchClass?: number | null;
  onPlayNote: (midi: number) => void;
}

const BLACK_SEMITONES = new Set([1, 3, 6, 8, 10]);

export const PianoRollKeyboard: React.FC<PianoRollKeyboardProps> = ({
  minMidi,
  maxMidi,
  rowHeight,
  allowedPitchClasses,
  tonic,
  rootPitchClass,
  onPlayNote,
}) => {
  const totalRows = Math.max(1, maxMidi - minMidi + 1);
  const totalHeight = totalRows * rowHeight;
  const rows: React.ReactNode[] = [];

  const allowedArr = allowedPitchClasses instanceof Set
    ? Array.from(allowedPitchClasses)
    : Array.isArray(allowedPitchClasses) ? allowedPitchClasses : [];
  const hasScaleLock = allowedArr.length > 0 && allowedArr.length < 12;
  const scaleRootPc = rootPitchClass !== undefined && rootPitchClass !== null
    ? ((rootPitchClass % 12) + 12) % 12
    : (tonic ? getTonicSemitone(tonic) : null);

  for (let midi = maxMidi; midi >= minMidi; midi--) {
    const semitone = ((midi % 12) + 12) % 12;
    const isBlack = BLACK_SEMITONES.has(semitone);
    const noteName = midiToNoteName(midi);
    const isC = semitone === 0;
    const inScale = !hasScaleLock || allowedArr.includes(semitone);
    const isTonic = hasScaleLock && scaleRootPc !== null && semitone === scaleRootPc;
    const y = midiToRowY(midi, maxMidi, rowHeight);

    if (!inScale) {
      rows.push(
        <div
          key={midi}
          style={{ top: `${y}px`, height: `${rowHeight}px` }}
          onClick={() => onPlayNote(midi)}
          title={`Note ${noteName} (Hors-gamme)`}
          className={`absolute left-0 right-0 box-border cursor-pointer select-none flex items-center justify-between pl-1 pr-1.5 border-b border-[#b91c1c]/50 border-l-4 border-l-[#ef4444] transition-colors ${
            isBlack
              ? 'bg-[#3b1515] hover:bg-[#4c1d1d]'
              : 'bg-[#fee2e2] dark:bg-[#451a1a] hover:brightness-95'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shrink-0" />
          <span className="text-[10px] leading-none font-mono font-bold text-[#b91c1c] dark:text-[#fca5a5] tracking-tight">
            {noteName}
          </span>
        </div>
      );
    } else if (isBlack) {
      rows.push(
        <div
          key={midi}
          style={{ top: `${y}px`, height: `${rowHeight}px` }}
          onClick={() => onPlayNote(midi)}
          title={`Note ${noteName}`}
          className={`absolute left-0 right-0 box-border cursor-pointer select-none flex items-center justify-end pr-1.5 bg-[#1c1613] hover:bg-[#2b211c] border-b border-[#3e2723] border-l-4 ${
            isTonic ? 'border-l-[#10b981]' : 'border-l-[#b45309]'
          } transition-colors`}
        >
          <span className="text-[10px] leading-none font-mono font-semibold text-[#f4ecd8] tracking-tight">
            {noteName}
          </span>
        </div>
      );
    } else {
      rows.push(
        <div
          key={midi}
          style={{ top: `${y}px`, height: `${rowHeight}px` }}
          onClick={() => onPlayNote(midi)}
          title={`Note ${noteName}`}
          className={`absolute left-0 right-0 box-border cursor-pointer select-none flex items-center justify-end pr-1.5 border-b border-[#3e2723] transition-colors ${
            isTonic
              ? 'bg-[#d1fae5] dark:bg-[#c7d6cc] border-l-4 border-l-[#10b981]'
              : isC
              ? 'bg-[#efe4cc] dark:bg-[#dfd2c0] border-l-4 border-l-[#9a3412]'
              : 'bg-[#f4ecd8] dark:bg-[#d6c7b2]'
          } hover:brightness-95`}
        >
          <span
            className={`text-[11px] leading-none font-mono font-bold tracking-tight ${
              isTonic ? 'text-[#065f46] font-black' : isC ? 'text-[#9a3412] font-black' : 'text-[#1a1a1a]'
            }`}
          >
            {noteName}
          </span>
        </div>
      );
    }
  }

  return (
    <div
      style={{ width: `${KEYBOARD_WIDTH}px`, height: `${totalHeight}px`, minHeight: `${totalHeight}px` }}
      className="sticky left-0 z-10 shrink-0 self-start relative bg-[#1c1613] border-r-2 border-[#3e2723] shadow-md box-border"
    >
      {rows}
    </div>
  );
};
