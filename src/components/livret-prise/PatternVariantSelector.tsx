/**
 * PatternVariantSelector.tsx
 * Matrice visuelle de declinaisons audio multi-vitesses et multi-hauteurs.
 * Affiche le vrai BPM (asservi a baseBpm) et les notes transposees calculees.
 */
import React, { useState } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { makeVariantKey, createDefaultVariant } from '../../types/toadaProject.types';
import { getTransposedNoteDisplay } from '../../utils/musicalMath';
import { Volume2 } from 'lucide-react';

interface PatternVariantSelectorProps {
  baseBpm?: number;
  referencePitch?: string;
  onPlayPitchPreview?: (pitch: string) => void;
  disabled?: boolean;
}

export const PatternVariantSelector: React.FC<PatternVariantSelectorProps> = ({
  baseBpm, referencePitch = 'C4', onPlayPitchPreview, disabled,
}) => {
  const { activePattern, activeVariant, setActiveVariantKey, ensureVariantExists, project } = useToadaProject();
  const { t, locale } = useLanguage();
  const [showTier3Speed, setShowTier3Speed] = useState(false);
  const [showTier3Pitch, setShowTier3Pitch] = useState(false);
  const [altPitch, setAltPitch] = useState<-8 | 8>(-8);

  const effectiveBaseBpm = baseBpm ?? project.bpm;
  const speeds = showTier3Speed ? [1.0, 0.74, 0.55] : [1.0, 0.74];
  const pitches = showTier3Pitch ? [-8, 0, 8] : [0, altPitch];

  const handleSelect = (s: number, p: number) => {
    if (disabled) return;
    const key = ensureVariantExists(activePattern.id, s, p);
    setActiveVariantKey(activePattern.id, key);
  };

  return (
    <div className="cordel-card p-2.5 flex flex-col gap-2 bg-stone-900/60 border border-[var(--cordel-border)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--cordel-border)] pb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--cordel-text)]">
          {t('pattern_variants_title')}
        </span>
        <div className="flex items-center gap-1.5">
          {!showTier3Pitch && (
            <button
              type="button" disabled={disabled} onClick={() => setAltPitch((prev) => (prev === -8 ? 8 : -8))}
              className="cordel-btn-secondary px-1.5 py-0.5 text-[10px] rounded-none cursor-pointer"
            >
              {altPitch === -8 ? t('variant_pitch_low') : t('variant_pitch_high')}
            </button>
          )}
          <button
            type="button" disabled={disabled} onClick={() => setShowTier3Speed((v) => !v)}
            className="cordel-btn-secondary px-1.5 py-0.5 text-[10px] rounded-none cursor-pointer"
          >
            {showTier3Speed ? '- 55%' : t('variant_add_speed_3')}
          </button>
          <button
            type="button" disabled={disabled} onClick={() => setShowTier3Pitch((v) => !v)}
            className="cordel-btn-secondary px-1.5 py-0.5 text-[10px] rounded-none cursor-pointer"
          >
            {showTier3Pitch ? '- 3e' : t('variant_add_pitch_3')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {speeds.flatMap((s) =>
          pitches.map((p) => {
            const vKey = makeVariantKey(s, p);
            const variant = activePattern.variants[vKey] ?? createDefaultVariant(s, p);
            const isRecorded = variant.recordingResult !== null;
            const isActive = activeVariant.variantKey === vKey;
            const bpmDisplay = Math.round(effectiveBaseBpm * s);
            const speedPercent = Math.round(s * 100);
            const noteDisplay = getTransposedNoteDisplay(referencePitch, p, locale);

            return (
              <div
                key={vKey} onClick={() => handleSelect(s, p)}
                className={`p-2 border text-left flex flex-col justify-between gap-1 transition-all rounded-none cursor-pointer ${
                  isActive
                    ? 'border-[var(--cordel-primary)] bg-[var(--cordel-primary)]/10 font-bold shadow-sm'
                    : 'border-[var(--cordel-border)] hover:border-stone-400 bg-stone-950/40'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] leading-tight">
                  <span className="font-bold text-[var(--cordel-text)]">{speedPercent} % ({bpmDisplay} BPM)</span>
                  {onPlayPitchPreview && (
                    <button
                      type="button" title={`${t('listenPitch')} ${noteDisplay.noteCode}`}
                      onClick={(e) => { e.stopPropagation(); onPlayPitchPreview(noteDisplay.noteCode); }}
                      className="p-0.5 hover:text-amber-400 text-stone-300 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="text-[10px] text-amber-200/90 font-mono truncate" title={noteDisplay.label}>
                  {noteDisplay.label}
                </div>
                <div className="flex items-center gap-1 text-[10px] pt-0.5">
                  {isRecorded ? (
                    <span className="text-emerald-400 font-bold">{t('variant_status_recorded')}</span>
                  ) : (
                    <span className="text-stone-400">{t('variant_status_pending')}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
