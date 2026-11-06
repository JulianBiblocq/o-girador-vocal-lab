/**
 * PianoRollKeyboard.tsx
 * Clavier matriciel 64 px à gauche du Piano Roll : alignement 1:1 absolu (y = (maxMidi - midi) * rowHeight)
 * avec chaque rangée de brique MIDI et la courbe verte (< 80 lignes).
 */
import React from 'react';
import { midiToNoteName } from '../../utils/noteUtils';

export const KEYBOARD_WIDTH = 64;

interface PianoRollKeyboardProps {
  minMidi: number;
  maxMidi: number;
  rowHeight: number;
  onPlayNote: (midi: number) => void;
}

const BLACK_SEMITONES = new Set([1, 3, 6, 8, 10]);

export const PianoRollKeyboard: React.FC<PianoRollKeyboardProps> = ({
  minMidi,
  maxMidi,
  rowHeight,
  onPlayNote,
}) => {
  const totalRows = Math.max(1, maxMidi - minMidi + 1);
  const totalHeight = totalRows * rowHeight;
  const rows: React.ReactNode[] = [];

  for (let midi = maxMidi; midi >= minMidi; midi--) {
    const semitone = ((midi % 12) + 12) % 12;
    const isBlack = BLACK_SEMITONES.has(semitone);
    const noteName = midiToNoteName(midi);
    const isC = semitone === 0;
    const y = (maxMidi - midi) * rowHeight;

    if (isBlack) {
      rows.push(
        <div
          key={midi}
          style={{ top: `${y}px`, height: `${rowHeight}px` }}
          onClick={() => onPlayNote(midi)}
          title={`Note ${noteName}`}
          className="absolute left-0 right-0 box-border cursor-pointer select-none flex items-center justify-end pr-1.5 bg-[#1c1613] hover:bg-[#2b211c] border-b border-[#3e2723] border-l-4 border-l-[#b45309] transition-colors"
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
            isC
              ? 'bg-[#efe4cc] dark:bg-[#dfd2c0] border-l-4 border-l-[#9a3412]'
              : 'bg-[#f4ecd8] dark:bg-[#d6c7b2]'
          } hover:brightness-95`}
        >
          <span
            className={`text-[11px] leading-none font-mono font-bold tracking-tight ${
              isC ? 'text-[#9a3412] font-black' : 'text-[#1a1a1a]'
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
