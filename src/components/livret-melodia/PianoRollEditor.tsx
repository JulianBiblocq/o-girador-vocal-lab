/**
 * PianoRollEditor.tsx
 * Conteneur défilable et gestionnaire d'édition des notes du Piano Roll.
 */
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import type { PitchCurvePoint, VocalStepData } from '../../types/vocalPack.types';
import { PianoRollCanvas } from './PianoRollCanvas';
import { calculateTessitura, midiToNoteName } from '../../utils/noteUtils';

interface PianoRollEditorProps {
  allSteps: VocalStepData[];
  pitchCurve: PitchCurvePoint[];
  totalDurationSec: number;
  anacrusisDurationSec: number;
  playheadSec: number;
  isPlaying: boolean;
  onUpdateSteps: (newSteps: VocalStepData[]) => void;
  onPlayNotePreview: (midi: number) => void;
}

export const PianoRollEditor: React.FC<PianoRollEditorProps> = (props) => {
  const { allSteps, pitchCurve, totalDurationSec, anacrusisDurationSec, playheadSec, isPlaying, onUpdateSteps, onPlayNotePreview } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidth(Math.max(300, Math.floor(entry.contentRect.width)));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const activeMidis = useMemo(() => allSteps.filter((s) => s.active && s.midiNumber > 0).map((s) => s.midiNumber), [allSteps]);
  const { minMidi, maxMidi } = useMemo(() => calculateTessitura(activeMidis), [activeMidis]);

  const handleStepClick = useCallback((stepIndex: number, midi: number) => {
    const current = allSteps[stepIndex];
    if (!current) return;

    const next = [...allSteps];
    if (!current.active) {
      next[stepIndex] = { ...current, active: true, midiNumber: midi, note: midiToNoteName(midi) };
      onPlayNotePreview(midi);
    } else if (current.midiNumber !== midi) {
      next[stepIndex] = { ...current, active: true, midiNumber: midi, note: midiToNoteName(midi) };
      onPlayNotePreview(midi);
    } else if (current.note !== '───') {
      next[stepIndex] = { ...current, note: '───' };
    } else {
      next[stepIndex] = { ...current, active: false, note: '', midiNumber: 0 };
    }
    onUpdateSteps(next);
  }, [allSteps, onPlayNotePreview, onUpdateSteps]);

  const canvasHeight = Math.max(160, Math.min(260, (maxMidi - minMidi + 1) * 14));

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between text-[11px] font-mono text-theme-ink/80 px-1">
        <span className="font-semibold text-amber-400">
          🎹 PIANO ROLL • {midiToNoteName(minMidi)} ➔ {midiToNoteName(maxMidi)}
        </span>
        <span className="text-[10px] text-emerald-400/90 hidden sm:inline">
          🟢 Justesse ≤ 35 cents • 🟡 Écart toléré • Zéro Rouge
        </span>
      </div>

      <div ref={containerRef} className="w-full cordel-card overflow-hidden select-none bg-stone-950/70 border border-theme-border/60">
        <div className="w-full overflow-x-auto overflow-y-hidden cordel-scrollbar">
          <PianoRollCanvas
            width={containerWidth}
            height={canvasHeight}
            minMidi={minMidi}
            maxMidi={maxMidi}
            allSteps={allSteps}
            pitchCurve={pitchCurve}
            totalDurationSec={totalDurationSec}
            anacrusisDurationSec={anacrusisDurationSec}
            playheadSec={playheadSec}
            isPlaying={isPlaying}
            onStepClick={handleStepClick}
          />
        </div>
      </div>

      <p className="text-[10px] font-mono text-theme-ink/60 text-center leading-snug">
        💡 Cliquez sur une case pour ajouter/déplacer une note (re-cliquez pour lier en tenue ─── ou rendre silencieux).
      </p>
    </div>
  );
};
