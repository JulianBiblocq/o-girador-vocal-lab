/**
 * VariantPitchTierStepper.tsx
 * Stepper de reglages des paliers de hauteur en demi-tons et tons avec note cible calculee.
 */
import React from 'react';
import { formatPitchTierLabel } from './variantConfigTypes';

interface VariantPitchTierStepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  referencePitch: string;
  locale: 'fr' | 'br';
  onChange: (val: number) => void;
  disabled?: boolean;
}

export const VariantPitchTierStepper: React.FC<VariantPitchTierStepperProps> = ({
  label, value, min, max, referencePitch, locale, onChange, disabled,
}) => {
  const { fullLabel } = formatPitchTierLabel(referencePitch, value, locale);
  const handleDec = () => { if (!disabled && value > min) onChange(value - 1); };
  const handleInc = () => { if (!disabled && value < max) onChange(value + 1); };

  return (
    <div className="flex items-center gap-1 bg-[var(--cordel-surface)] border border-[var(--cordel-border)] px-1.5 py-0.5 text-[10px]">
      <span className="font-bold text-[var(--cordel-accent-text)]">{label}</span>
      <button
        type="button" disabled={disabled || value <= min} onClick={handleDec}
        className="w-4 h-4 flex items-center justify-center font-bold cordel-btn p-0 text-[10px] cursor-pointer"
      >
        -
      </button>
      <span className="font-mono font-bold text-[var(--cordel-text)] px-1 min-w-[70px] text-center" title={`${value} semitones`}>
        {fullLabel}
      </span>
      <button
        type="button" disabled={disabled || value >= max} onClick={handleInc}
        className="w-4 h-4 flex items-center justify-center font-bold cordel-btn p-0 text-[10px] cursor-pointer"
      >
        +
      </button>
    </div>
  );
};
