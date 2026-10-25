import React, { useState } from 'react';
import { Sliders, RotateCcw, ChevronDown, Check } from 'lucide-react';
import {
  DEFAULT_LATENCY_OFFSET_MS,
  MIN_LATENCY_OFFSET_MS,
  MAX_LATENCY_OFFSET_MS,
  saveLatencyOffsetMs,
  markLatencyCalibrated,
} from '../../utils/latencyStorage';
import { useAudioHardware } from '../../context/AudioHardwareContext';

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
  const [isOpen, setIsOpen] = useState(false);
  const { selectedDeviceId } = useAudioHardware();

  const updateOffset = (newVal: number) => {
    const clamped = Math.max(MIN_LATENCY_OFFSET_MS, Math.min(MAX_LATENCY_OFFSET_MS, newVal));
    saveLatencyOffsetMs(clamped);
    markLatencyCalibrated(selectedDeviceId);
    onChange(clamped);
  };

  const handleNudge = (deltaMs: number) => {
    if (disabled) return;
    updateOffset(latencyOffsetMs + deltaMs);
  };

  return (
    <div className="cordel-card-sm p-2 flex flex-col gap-2 text-xs font-mono rounded">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between w-full py-1 text-xs font-mono text-theme-ink/80 hover:text-theme-ink transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-1.5 font-bold uppercase text-[11px]">
          <Sliders className="w-3.5 h-3.5 text-theme-accent" />
          <span>⚙️ Retouche fine du calage (Optionnel)</span>
        </span>
        <span className="text-[10px] text-theme-accent font-mono flex items-center gap-1">
          {latencyOffsetMs === 0 ? (
            <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>Auto-cale (0 ms)</span>
            </span>
          ) : (
            <span>{latencyOffsetMs > 0 ? `+${latencyOffsetMs}` : latencyOffsetMs} ms</span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-2 pt-2 border-t border-theme-border/20">
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={MIN_LATENCY_OFFSET_MS}
              max={MAX_LATENCY_OFFSET_MS}
              step={1}
              value={latencyOffsetMs}
              disabled={disabled}
              onChange={(e) => updateOffset(Number(e.target.value))}
              onMouseUp={(e) => e.currentTarget.blur()} onTouchEnd={(e) => e.currentTarget.blur()}
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
                title="Retablir le calage automatique (0 ms)"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
