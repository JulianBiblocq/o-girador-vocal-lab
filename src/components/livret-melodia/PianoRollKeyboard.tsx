/**
 * PianoRollKeyboard.tsx
 * Clavier vertical 64 px fixe à gauche (touches crème/bois doux #d6c7b2 en Mode Nuit, ivoire en Mode Jour).
 * Aligné directement avec la grille de notes (C2..C5) (< 75 lignes).
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

export const PianoRollKeyboard: React.FC<PianoRollKeyboardProps> = ({ minMidi, maxMidi, rowHeight, onPlayNote }) => {
  const rows: React.ReactNode[] = [];

  for (let midi = maxMidi; midi >= minMidi; midi--) {
    const semitone = ((midi % 12) + 12) % 12;
    const isBlack = BLACK_SEMITONES.has(semitone);
    const noteName = midiToNoteName(midi);
    const isC = semitone === 0;
    const isBorderBoundary = semitone === 4 || semitone === 11;

    if (isBlack) {
      rows.push(
        <div
          key={midi}
          style={{ height: `${rowHeight}px` }}
          onClick={() => onPlayNote(midi)}
          title={`Note ${noteName}`}
          className="relative w-full cursor-pointer select-none group"
        >
          <div className="absolute inset-0 bg-[#e8e0d0] dark:bg-[#c8b8a2] border-b border-black/20" />
          <div className="absolute left-0 top-0 bottom-0 w-[38px] bg-gradient-to-r from-[#1c1917] to-[#292524] border-t border-b border-r border-black shadow-md z-10 flex items-center px-1 group-hover:from-black group-hover:to-amber-950/80 transition-colors">
            <span className="text-[7.5px] font-mono font-bold text-amber-200/80 tracking-tighter truncate">
              {noteName}
            </span>
          </div>
        </div>
      );
    } else {
      rows.push(
        <div
          key={midi}
          style={{ height: `${rowHeight}px` }}
          onClick={() => onPlayNote(midi)}
          title={`Note ${noteName}`}
          className={`relative w-full cursor-pointer select-none flex items-center justify-end pr-1.5 transition-colors group ${
            isC ? 'bg-[#f8f1e0] dark:bg-[#dfd2c0]' : 'bg-[#f2ead8] dark:bg-[#d6c7b2]'
          } ${isBorderBoundary ? 'border-b-2 border-[var(--cordel-border-panel)]' : 'border-b border-black/20'} hover:bg-[#e8dcc4] dark:hover:bg-[#e5d8c8]`}
        >
          <span className={`text-[8.5px] font-mono tracking-tight text-[#1a1a1a] ${isC ? 'font-black text-[#9a3412]' : 'font-bold'}`}>
            {noteName}
          </span>
        </div>
      );
    }
  }

  return (
    <div
      style={{ width: `${KEYBOARD_WIDTH}px` }}
      className="sticky left-0 z-10 shrink-0 bg-[var(--cordel-surface)] border-r-2 border-[var(--cordel-border-panel)] flex flex-col shadow-lg"
    >
      {rows}
    </div>
  );
};
