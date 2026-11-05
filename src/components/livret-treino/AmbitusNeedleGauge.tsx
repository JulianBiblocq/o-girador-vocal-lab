/**
 * AmbitusNeedleGauge.tsx
 * Jauge / Aiguille à double échelle progressive (Large ±12 demi-tons + Précise ±45 cents)
 * toujours visible à l'écran dès que l'élève émet un son (< 85 lignes).
 */
import React from 'react';
import { midiToNoteName } from '../../utils/noteUtils';
import type { ValidationSample } from '../../audio/ambitusValidator';

interface AmbitusNeedleGaugeProps {
  targetMidi: number;
  livePitchMidi: number;
  samples: ValidationSample[];
}

function midiToHz(midi: number): number {
  return Math.round(440 * Math.pow(2, (midi - 69) / 12));
}

/** Convertit un écart en demi-tons vers une position % (4%..96%) à double échelle progressive */
function diffSemitonesToPercent(diffSt: number): number {
  if (Math.abs(diffSt) <= 1.5) {
    return 50 + (diffSt / 1.5) * 25; // Zone centrale haute précision : 25%..75%
  }
  const sign = diffSt > 0 ? 1 : -1;
  const extra = Math.min(10.5, Math.abs(diffSt) - 1.5) / 10.5; // Zone large ±1.5 à ±12 st
  return Math.max(4, Math.min(96, 50 + sign * (25 + extra * 21)));
}

export const AmbitusNeedleGauge: React.FC<AmbitusNeedleGaugeProps> = ({
  targetMidi, livePitchMidi, samples,
}) => {
  const lastSampleMidi = samples.length > 0 ? samples[samples.length - 1].pitchMidi : 0;
  const activeMidi = livePitchMidi >= 30 ? livePitchMidi : lastSampleMidi >= 30 ? lastSampleMidi : 0;
  const hasVoice = activeMidi >= 30;
  const diffSt = hasVoice ? activeMidi - targetMidi : 0;
  const needlePct = hasVoice ? diffSemitonesToPercent(diffSt) : 50;
  const isCentered = hasVoice && Math.abs(diffSt) <= 0.45;
  const isNear = hasVoice && Math.abs(diffSt) <= 1.5;

  const targetName = midiToNoteName(targetMidi);
  const sungName = hasVoice ? midiToNoteName(Math.round(activeMidi)) : '—';

  let directionText = "🎙️ Chantez pour voir l'aiguille bouger en direct";
  if (hasVoice) {
    if (isCentered) directionText = `🎯 Pile sur la cible ! (${diffSt >= 0 ? '+' : ''}${Math.round(diffSt * 100)} cts)`;
    else if (diffSt <= -9) directionText = `⬆️ Monte d'une octave (+${Math.abs(Math.round(diffSt))} demi-tons)`;
    else if (diffSt >= 9) directionText = `⬇️ Descends d'une octave (-${Math.round(diffSt)} demi-tons)`;
    else if (diffSt < 0) directionText = `⬆️ Monte un peu (+${Math.abs(diffSt).toFixed(1)} demi-ton${Math.abs(diffSt) >= 1.5 ? 's' : ''})`;
    else directionText = `⬇️ Descends un peu (-${diffSt.toFixed(1)} demi-ton${diffSt >= 1.5 ? 's' : ''})`;
  }

  return (
    <div className="p-2.5 bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] rounded space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <span className="opacity-75">🎯 Cible :</span>
          <span className="font-bold text-sm px-2 py-0.5 rounded bg-[#0f766e]/15 text-[#0f766e] dark:text-[#2dd4bf] border border-[#0f766e]/30">
            {targetName} ({midiToHz(targetMidi)} Hz)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="opacity-75">🎙️ Vous chantez :</span>
          <span className={`font-bold text-sm px-2 py-0.5 rounded border ${!hasVoice ? 'bg-[var(--cordel-surface)] opacity-60 border-[var(--cordel-border-sub)]' : isCentered ? 'bg-[#0f766e] text-white border-[#0f766e]' : 'bg-amber-600/20 text-amber-600 dark:text-amber-300 border-amber-500/40'}`}>
            {hasVoice ? `${sungName} (${midiToHz(activeMidi)} Hz)` : 'En attente...'}
          </span>
        </div>
      </div>

      {/* Cadran à double échelle (-12 st ➔ -1.5 st ➔ 0 ➔ +1.5 st ➔ +12 st) */}
      <div className="relative h-7 bg-[var(--cordel-surface)] border border-[var(--cordel-border-panel)] rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-[42%] right-[42%] bg-[#0f766e]/20 border-x border-[#0f766e]/40" title="Couloir juste ±45 cents" />
        <div className="absolute inset-y-0 left-1/2 w-0.5 bg-[#0f766e]" />
        <div className="absolute inset-0 flex items-center justify-between px-3 text-[9px] font-mono opacity-55 pointer-events-none">
          <span>-12 st</span><span>-2 st</span><span className="font-bold text-[#0f766e] opacity-100">{targetName}</span><span>+2 st</span><span>+12 st</span>
        </div>
        {hasVoice && (
          <div
            style={{ left: `${needlePct}%` }}
            className={`absolute top-0.5 bottom-0.5 w-3.5 -ml-1.5 rounded-full transition-all duration-75 shadow-md flex items-center justify-center text-[9px] font-bold text-white ${isCentered ? 'bg-[#0f766e] ring-2 ring-[#2dd4bf]' : isNear ? 'bg-amber-500' : 'bg-[#c25e38]'}`}
          >
            │
          </div>
        )}
      </div>

      <div className={`text-center text-xs font-bold font-mono py-0.5 rounded ${!hasVoice ? 'opacity-65' : isCentered ? 'text-[#0f766e] dark:text-[#2dd4bf]' : 'text-amber-600 dark:text-amber-400'}`}>
        {directionText}
      </div>
    </div>
  );
};

