import React from 'react';
import { Sliders, RotateCcw, Check } from 'lucide-react';
import {
  DEFAULT_LATENCY_OFFSET_MS,
  MIN_LATENCY_OFFSET_MS,
  MAX_LATENCY_OFFSET_MS,
  saveLatencyOffsetMs,
} from '../../utils/latencyStorage';

interface LatencyNudgeBarProps {
  latencyOffsetMs: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}

export const LatencyNudgeBar: React.FC<LatencyNudgeBarProps> = ({
  latencyOffsetMs,
  onChange,
  disabled = false,
}) => {
  const updateOffset = (newVal: number) => {
    const clamped = Math.max(MIN_LATENCY_OFFSET_MS, Math.min(MAX_LATENCY_OFFSET_MS, newVal));
    saveLatencyOffsetMs(clamped);
    onChange(clamped);
  };

  const handleNudge = (deltaMs: number) => {
    if (disabled) return;
    updateOffset(latencyOffsetMs + deltaMs);
  };

  return (
    <div className="cordel-card p-2.5 flex flex-col gap-2 bg-black/40 text-xs font-mono">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-bold uppercase text-theme-ink">
          <Sliders className="w-3.5 h-3.5 text-theme-accent" />
          <span>Calage Carte Son (Latence)</span>
        </span>
        <span className="text-[11px] text-theme-accent font-bold flex items-center gap-1">
          <Check className="w-3 h-3 text-emerald-400" />
          <span>{latencyOffsetMs >= 0 ? '+' : ''}{latencyOffsetMs} ms (Mémorisé)</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="range"
          min={MIN_LATENCY_OFFSET_MS}
          max={MAX_LATENCY_OFFSET_MS}
          step={1}
          value={latencyOffsetMs}
          disabled={disabled}
          onChange={(e) => updateOffset(Number(e.target.value))}
          className="flex-1 accent-[var(--cordel-wood)] cursor-pointer"
        />

        <div className="flex items-center gap-1">
          {[-10, -1, 1, 10].map((delta) => (
            <button
              key={delta}
              type="button"
              disabled={disabled}
              onClick={() => handleNudge(delta)}
              className="cordel-btn px-1.5 py-0.5 text-[10px] font-bold cursor-pointer"
            >
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))}
          <button
            type="button"
            disabled={disabled || latencyOffsetMs === DEFAULT_LATENCY_OFFSET_MS}
            onClick={() => updateOffset(DEFAULT_LATENCY_OFFSET_MS)}
            className="cordel-btn px-1.5 py-0.5 text-[10px] opacity-75 hover:opacity-100 cursor-pointer"
            title="Rétablir la compensation par défaut (-120 ms)"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
