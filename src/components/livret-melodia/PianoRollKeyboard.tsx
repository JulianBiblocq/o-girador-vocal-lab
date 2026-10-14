/**
 * PianoRollKeyboard.tsx
 * Clavier vertical 64 px fixe à gauche (touches ivoire / ébène en relief).
 * Avec en-tête de 42 px à 2 étages (MESURES / TEMPS) synchronisé sur la règle.
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
          <div className="absolute inset-0 bg-[#e8e0d0] border-b border-black/15" />
          <div className="absolute left-0 top-0 bottom-0 w-[38px] bg-gradient-to-r from-[#1c1917] to-[#292524] border-t border-b border-r border-black shadow-md z-10 flex items-center px-1 group-hover:from-black group-hover:to-amber-950/80 transition-colors">
            <span className="text-[7.5px] font-mono font-bold text-amber-200/70 tracking-tighter truncate">
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
            isC ? 'bg-[#fffdf7]' : 'bg-[#f5f0e6]'
          } ${isBorderBoundary ? 'border-b-2 border-stone-800/40' : 'border-b border-black/15'} hover:bg-[#fff9ea]`}
        >
          <span className={`text-[8.5px] font-mono tracking-tight ${isC ? 'font-black text-amber-900' : 'font-semibold text-stone-700'} group-hover:text-amber-800`}>
            {noteName}
          </span>
        </div>
      );
    }
  }

  return (
    <div
      style={{ width: `${KEYBOARD_WIDTH}px` }}
      className="sticky left-0 z-20 shrink-0 bg-[#1c1917] border-r-2 border-black/80 flex flex-col shadow-lg"
    >
      <div style={{ height: '42px' }} className="w-full bg-[#141210] border-b border-white/20 flex flex-col justify-between shrink-0">
        <div style={{ height: '21px' }} className="w-full border-b border-white/10 flex items-center justify-center">
          <span className="text-[7.5px] font-mono font-bold text-amber-400/85 tracking-widest">MESURES</span>
        </div>
        <div style={{ height: '21px' }} className="w-full flex items-center justify-center">
          <span className="text-[7.5px] font-mono font-semibold text-stone-400/80 tracking-widest">TEMPS</span>
        </div>
      </div>
      {rows}
    </div>
  );
};
