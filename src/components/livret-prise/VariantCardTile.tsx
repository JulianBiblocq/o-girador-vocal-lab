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
      className={`p-2 border text-left flex flex-col justify-between gap-1 transition-all rounded-none cursor-pointer select-none ${
        isActive
          ? 'bg-[#9a3412] text-[#f4ecd8] border-2 border-[var(--cordel-border)] shadow-md font-bold'
          : 'bg-[var(--cordel-surface)] border border-[var(--cordel-border)] hover:border-amber-600'
      }`}
    >
      <div className="flex items-center justify-between text-[11px] leading-tight">
        <span className={`font-bold ${isActive ? 'text-[#f4ecd8]' : 'text-[var(--cordel-text)]'}`}>
          {speedPercent} % ({bpmDisplay} BPM)
        </span>
        {onPlayPitchPreview && (
          <button
            type="button" title={`${t('listenPitch')} ${noteDisplay.noteCode}`}
            onClick={(e) => { e.stopPropagation(); onPlayPitchPreview(noteDisplay.noteCode); }}
            className={`p-0.5 cursor-pointer ${isActive ? 'text-[#f4ecd8] hover:text-[#fde68a]' : 'text-[var(--cordel-text)] hover:text-amber-500'}`}
          >
            <Volume2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div
        className={`text-[10px] font-mono truncate ${
          isActive ? 'text-[#fde68a] font-bold' : 'text-[var(--cordel-accent-text)] font-bold'
        }`}
        title={noteDisplay.label}
      >
        {noteDisplay.label}
      </div>
      <div className="flex items-center gap-1 text-[10px] pt-0.5">
        {isRecorded ? (
          <span className={isActive ? 'text-[#f4ecd8] font-bold' : 'text-[#15803d] dark:text-emerald-400 font-bold'}>
            {t('variant_status_recorded')}
          </span>
        ) : (
          <span className={isActive ? 'text-[#f4ecd8]/90 font-semibold' : 'text-[#44403c] dark:text-stone-400 font-semibold'}>
            {t('variant_status_pending')}
          </span>
        )}
      </div>
    </div>
  );
};
