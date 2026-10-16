/**
 * VariantConfigBar.tsx
 * Barre de reglages fins des paliers de vitesse et de hauteur (steppers + bascules 3e palier).
 */
import React from 'react';
import { VariantPitchTierStepper } from './VariantPitchTierStepper';
import { VariantSpeedTierStepper } from './VariantSpeedTierStepper';

interface VariantConfigBarProps {
  refSemitones: number;
  lowSemitones: number;
  highSemitones: number;
  enableHighPitch: boolean;
  speed2Pct: number;
  speed3Pct: number;
  enableSpeed3: boolean;
  baseBpm: number;
  referencePitch: string;
  locale: 'fr' | 'br';
  disabled?: boolean;
  onRefSemitonesChange: (val: number) => void;
  onLowSemitonesChange: (val: number) => void;
  onHighSemitonesChange: (val: number) => void;
  onToggleHighPitch: () => void;
  onSpeed2Change: (val: number) => void;
  onSpeed3Change: (val: number) => void;
  onToggleSpeed3: () => void;
  t: (key: any, params?: any) => string;
}

export const VariantConfigBar: React.FC<VariantConfigBarProps> = ({
  refSemitones, lowSemitones, highSemitones, enableHighPitch,
  speed2Pct, speed3Pct, enableSpeed3, baseBpm, referencePitch, locale, disabled,
  onRefSemitonesChange, onLowSemitonesChange, onHighSemitonesChange, onToggleHighPitch,
  onSpeed2Change, onSpeed3Change, onToggleSpeed3, t,
}) => {
  const isFork = refSemitones !== 0;

  return (
    <div className="flex flex-col gap-1.5 p-1.5 bg-[var(--cordel-bg)]/60 border border-[var(--cordel-border)]">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <VariantPitchTierStepper
            label={t('variant_stepper_pitch_ref')} value={refSemitones} min={-6} max={6}
            referencePitch={referencePitch} locale={locale} onChange={onRefSemitonesChange} disabled={disabled}
          />
          <VariantPitchTierStepper
            label={t('variant_stepper_pitch_low')} value={lowSemitones} min={-7} max={-2}
            referencePitch={referencePitch} locale={locale} onChange={onLowSemitonesChange} disabled={disabled}
          />
          {enableHighPitch && (
            <VariantPitchTierStepper
              label={t('variant_stepper_pitch_high')} value={highSemitones} min={2} max={7}
              referencePitch={referencePitch} locale={locale} onChange={onHighSemitonesChange} disabled={disabled}
            />
          )}
          <VariantSpeedTierStepper
            label={t('variant_stepper_speed_2')} valuePct={speed2Pct} minPct={60} maxPct={85}
            baseBpm={baseBpm} onChange={onSpeed2Change} disabled={disabled}
          />
          {enableSpeed3 && (
            <VariantSpeedTierStepper
              label={t('variant_stepper_speed_3')} valuePct={speed3Pct} minPct={50} maxPct={130}
              baseBpm={baseBpm} onChange={onSpeed3Change} disabled={disabled}
            />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button" disabled={disabled} onClick={onToggleSpeed3}
            className="cordel-btn px-1.5 py-0.5 text-[10px] rounded-none cursor-pointer"
          >
            {enableSpeed3 ? t('variant_remove_speed_3') : t('variant_add_speed_3')}
          </button>
          <button
            type="button" disabled={disabled} onClick={onToggleHighPitch}
            className="cordel-btn px-1.5 py-0.5 text-[10px] rounded-none cursor-pointer"
          >
            {enableHighPitch ? t('variant_remove_pitch_3') : t('variant_add_pitch_3')}
          </button>
        </div>
      </div>
      {isFork && (
        <div className="text-[10px] text-amber-500 dark:text-amber-300 font-mono font-semibold">
          ★ {t('variant_pitch_fork_hint')} ({refSemitones > 0 ? `+${refSemitones}` : refSemitones} st)
        </div>
      )}
    </div>
  );
};
