/**
 * VariantSpeedTierStepper.tsx
 * Stepper de reglages des paliers de vitesse avec calcul du BPM reel.
 */
import React from 'react';

interface VariantSpeedTierStepperProps {
  label: string;
  valuePct: number;
  minPct: number;
  maxPct: number;
  stepPct?: number;
  baseBpm: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}

export const VariantSpeedTierStepper: React.FC<VariantSpeedTierStepperProps> = ({
  label, valuePct, minPct, maxPct, stepPct = 5, baseBpm, onChange, disabled,
}) => {
  const calculatedBpm = Math.round(baseBpm * (valuePct / 100));
  const handleDec = () => { if (!disabled && valuePct - stepPct >= minPct) onChange(valuePct - stepPct); };
  const handleInc = () => { if (!disabled && valuePct + stepPct <= maxPct) onChange(valuePct + stepPct); };

  return (
    <div className="flex items-center gap-1 bg-[var(--cordel-surface)] border border-[var(--cordel-border)] px-1.5 py-0.5 text-[10px]">
      <span className="font-bold text-[var(--cordel-accent-text)]">{label}</span>
      <button
        type="button" disabled={disabled || valuePct <= minPct} onClick={handleDec}
        className="w-4 h-4 flex items-center justify-center font-bold cordel-btn p-0 text-[10px] cursor-pointer"
      >
        -
      </button>
      <span className="font-mono font-bold text-[var(--cordel-text)] px-1 min-w-[70px] text-center">
        {valuePct} % ({calculatedBpm} BPM)
      </span>
      <button
        type="button" disabled={disabled || valuePct >= maxPct} onClick={handleInc}
        className="w-4 h-4 flex items-center justify-center font-bold cordel-btn p-0 text-[10px] cursor-pointer"
      >
        +
      </button>
    </div>
  );
};
