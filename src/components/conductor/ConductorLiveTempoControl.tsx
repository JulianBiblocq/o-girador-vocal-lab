/**
 * ConductorLiveTempoControl.tsx
 * Contrôle Live du tempo (BPM Varispeed) en cours de lecture (< 60 lignes).
 */
import React from 'react';
import { Zap } from 'lucide-react';

interface ConductorLiveTempoControlProps {
  liveBpm: number;
  onBpmChange: (bpm: number) => void;
  disabled?: boolean;
}

export const ConductorLiveTempoControl: React.FC<ConductorLiveTempoControlProps> = ({
  liveBpm, onBpmChange, disabled = false,
}) => {
  const nudge = (delta: number) => {
    onBpmChange(Math.max(40, Math.min(220, liveBpm + delta)));
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--cordel-border-panel)] bg-[var(--cordel-surface)] text-[11px] font-mono select-none">
      <span className="font-bold flex items-center gap-1 text-amber-500 uppercase tracking-wider text-[10px]">
        <Zap className="w-3 h-3 fill-current" />
        <span>Live</span>
      </span>
      <button
        type="button" disabled={disabled} onClick={() => nudge(-5)}
        className="px-1 py-0.2 cordel-card-sm rounded hover:bg-amber-500/20 font-bold text-[10px] cursor-pointer"
        title="-5 BPM"
      >-5</button>
      <button
        type="button" disabled={disabled} onClick={() => nudge(-1)}
        className="px-1 py-0.2 cordel-card-sm rounded hover:bg-amber-500/20 font-bold text-[10px] cursor-pointer"
        title="-1 BPM"
      >-1</button>
      <input
        type="range" min={45} max={180} value={liveBpm} disabled={disabled}
        onChange={(e) => onBpmChange(Number(e.target.value))}
        className="w-16 h-1.5 accent-amber-500 cursor-pointer"
      />
      <button
        type="button" disabled={disabled} onClick={() => nudge(1)}
        className="px-1 py-0.2 cordel-card-sm rounded hover:bg-amber-500/20 font-bold text-[10px] cursor-pointer"
        title="+1 BPM"
      >+1</button>
      <button
        type="button" disabled={disabled} onClick={() => nudge(5)}
        className="px-1 py-0.2 cordel-card-sm rounded hover:bg-amber-500/20 font-bold text-[10px] cursor-pointer"
        title="+5 BPM"
      >+5</button>
      <span className="font-bold text-theme-ink w-14 text-right tabular-nums">{liveBpm} BPM</span>
    </div>
  );
};
