/**
 * PatternVariantSelector.tsx
 * Matrice visuelle de déclinaisons audio multi-vitesses et multi-hauteurs symétriques.
 * Support du Mode Fourchette libre en demi-tons et 3e vitesse configurable.
 */
import React from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { makeVariantKey, createDefaultVariant } from '../../types/toadaProject.types';
import { getTransposedNoteDisplay } from '../../utils/musicalMath';
import { VariantConfigBar } from './VariantConfigBar';
import { VariantCardTile } from './VariantCardTile';
import {
  DEFAULT_REF_SEMITONES, DEFAULT_LOW_SEMITONES, DEFAULT_HIGH_SEMITONES,
  DEFAULT_SPEED_2_PCT, DEFAULT_SPEED_3_PCT,
} from './variantConfigTypes';

interface PatternVariantSelectorProps {
  baseBpm?: number;
  referencePitch?: string;
  onPlayPitchPreview?: (pitch: string) => void;
  disabled?: boolean;
}

export const PatternVariantSelector: React.FC<PatternVariantSelectorProps> = ({
  baseBpm, referencePitch = 'C4', onPlayPitchPreview, disabled,
}) => {
  const { activePattern, activeVariant, setActiveVariantKey, ensureVariantExists, project, updatePattern } = useToadaProject();
  const { t, locale } = useLanguage();

  const effectiveBaseBpm = baseBpm ?? project.bpm;
  const pCfg = activePattern.variantPitchesConfig ?? {
    refSemitones: DEFAULT_REF_SEMITONES, lowSemitones: DEFAULT_LOW_SEMITONES,
    highSemitones: DEFAULT_HIGH_SEMITONES, enableHigh: false,
  };
  const sCfg = activePattern.variantSpeedsConfig ?? {
    speed1Pct: 100, speed2Pct: DEFAULT_SPEED_2_PCT, speed3Pct: DEFAULT_SPEED_3_PCT, enableSpeed3: false,
  };

  const setPCfg = (patch: Partial<typeof pCfg>) => {
    updatePattern(activePattern.id, { variantPitchesConfig: { ...pCfg, ...patch } });
  };
  const setSCfg = (patch: Partial<typeof sCfg>) => {
    updatePattern(activePattern.id, { variantSpeedsConfig: { ...sCfg, ...patch } });
  };

  const speeds = [1.0, sCfg.speed2Pct / 100];
  if (sCfg.enableSpeed3) speeds.push(sCfg.speed3Pct / 100);

  const pitches = [pCfg.refSemitones, pCfg.lowSemitones];
  if (pCfg.enableHigh) pitches.push(pCfg.highSemitones);

  const handleSelect = (s: number, p: number) => {
    if (disabled) return;
    const key = ensureVariantExists(activePattern.id, s, p);
    setActiveVariantKey(activePattern.id, key);
  };

  const roleBg = activePattern.role === 'puxador' ? 'bg-[#9a3412]' : 'bg-[#0f766e]';
  const roleLabel = activePattern.role === 'puxador' ? t('rolePuxador') : t('roleCoro');
  const activeNoteLabel = getTransposedNoteDisplay(referencePitch, pCfg.refSemitones, locale).label;

  return (
    <div className="cordel-card p-2.5 flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--cordel-border-sub)] pb-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className={`px-2 py-0.5 ${roleBg} text-[var(--cordel-text)] font-mono font-bold text-xs flex items-center gap-1.5 shadow-sm border border-amber-400/80 rounded`}>
            <span className="uppercase tracking-wider">{roleLabel} :</span>
            <span className="truncate max-w-[150px] sm:max-w-none">{activePattern.name}</span>
            <span className="text-amber-200">•</span>
            <span>{t('measureUnitShort', { n: activePattern.measuresCount })}</span>
            <span className="text-amber-200">•</span>
            <span>{activeNoteLabel}</span>
            <span className="text-amber-200">•</span>
            <span>{effectiveBaseBpm} BPM</span>
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--cordel-text)] hidden md:inline">
            {t('pattern_variants_title')}
          </span>
        </div>
      </div>

      <VariantConfigBar
        refSemitones={pCfg.refSemitones} lowSemitones={pCfg.lowSemitones} highSemitones={pCfg.highSemitones}
        enableHighPitch={pCfg.enableHigh} speed2Pct={sCfg.speed2Pct} speed3Pct={sCfg.speed3Pct}
        enableSpeed3={sCfg.enableSpeed3} baseBpm={effectiveBaseBpm} referencePitch={referencePitch}
        locale={locale} disabled={disabled}
        onRefSemitonesChange={(v) => setPCfg({ refSemitones: v })}
        onLowSemitonesChange={(v) => setPCfg({ lowSemitones: v })}
        onHighSemitonesChange={(v) => setPCfg({ highSemitones: v })}
        onToggleHighPitch={() => setPCfg({ enableHigh: !pCfg.enableHigh })}
        onSpeed2Change={(v) => setSCfg({ speed2Pct: v })}
        onSpeed3Change={(v) => setSCfg({ speed3Pct: v })}
        onToggleSpeed3={() => setSCfg({ enableSpeed3: !sCfg.enableSpeed3 })}
        t={t}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {speeds.flatMap((s) =>
          pitches.map((p) => {
            const vKey = makeVariantKey(s, p);
            const variant = activePattern.variants[vKey] ?? createDefaultVariant(s, p);
            return (
              <VariantCardTile
                key={vKey} speedRatio={s} pitchShiftSemitones={p} baseBpm={effectiveBaseBpm}
                referencePitch={referencePitch} locale={locale} isRecorded={variant.recordingResult !== null}
                isActive={activeVariant.variantKey === vKey} disabled={disabled}
                onSelect={() => handleSelect(s, p)} onPlayPitchPreview={onPlayPitchPreview} t={t}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
