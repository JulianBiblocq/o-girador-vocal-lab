/**
 * VariantCardTile.tsx
 * Tuile de déclinaison audio : Vitesse %, BPM, Note calculée et statut d'enregistrement.
 * Conforme à la charte Cordel (text-[#f4ecd8] sur terracotta, bordure 2px sur actif).
 */
import React from 'react';
import { Volume2 } from 'lucide-react';
import { getTransposedNoteDisplay } from '../../utils/musicalMath';

interface VariantCardTileProps {
  speedRatio: number;
  pitchShiftSemitones: number;
  baseBpm: number;
  referencePitch: string;
  locale: 'fr' | 'br';
  isRecorded: boolean;
  isActive: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onPlayPitchPreview?: (pitch: string) => void;
  t: (key: any, params?: any) => string;
}

export const VariantCardTile: React.FC<VariantCardTileProps> = ({
  speedRatio, pitchShiftSemitones, baseBpm, referencePitch, locale,
  isRecorded, isActive, disabled, onSelect, onPlayPitchPreview, t,
}) => {
  const bpmDisplay = Math.round(baseBpm * speedRatio);
  const speedPercent = Math.round(speedRatio * 100);
  const noteDisplay = getTransposedNoteDisplay(referencePitch, pitchShiftSemitones, locale);

  return (
    <div
      onClick={() => { if (!disabled) onSelect(); }}
      className={`p-2 text-left flex flex-col justify-between gap-1 transition-all rounded cursor-pointer select-none ${
        isActive
          ? 'bg-[var(--cordel-terracotta-dark,#9a3412)] !text-white border-2 border-[var(--cordel-terracotta,#c25e38)] shadow-md font-bold'
          : 'bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] text-[var(--cordel-text)] hover:border-[var(--cordel-accent)]/50'
      }`}
    >
      <div className="flex items-center justify-between text-[11px] leading-tight">
        <span className={`font-bold ${isActive ? '!text-white' : 'text-[var(--cordel-text)]'}`}>
          {speedPercent} % ({bpmDisplay} BPM)
        </span>
        {onPlayPitchPreview && (
          <button
            type="button" title={`${t('listenPitch')} ${noteDisplay.noteCode}`}
            onClick={(e) => { e.stopPropagation(); onPlayPitchPreview(noteDisplay.noteCode); }}
            className={`p-0.5 cursor-pointer ${isActive ? '!text-white hover:text-amber-200' : 'text-[var(--cordel-text)] hover:text-amber-500'}`}
          >
            <Volume2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div
        className={`text-[10px] font-mono truncate ${
          isActive ? '!text-amber-200 font-bold' : 'text-[var(--cordel-accent-text)] font-bold'
        }`}
        title={noteDisplay.label}
      >
        {noteDisplay.label}
      </div>
      <div className="flex items-center gap-1 text-[10px] pt-0.5">
        {isRecorded ? (
          <span className={isActive ? '!text-white font-bold' : 'text-[#15803d] dark:text-emerald-400 font-bold'}>
            {t('variant_status_recorded')}
          </span>
        ) : (
          <span className={isActive ? '!text-[#f4ecd8] font-bold' : 'text-[var(--cordel-secondary-text)] font-semibold'}>
            {t('variant_status_pending')}
          </span>
        )}
      </div>
    </div>
  );
};
