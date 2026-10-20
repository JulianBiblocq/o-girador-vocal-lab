/**
 * TessituraBoundsPanel.tsx
 * Panneau de réglage de la tessiture vocale Plancher / Plafond avec presets et recalcul à la volée (< 120 lignes).
 */
import React, { useMemo } from 'react';
import { Sliders, RefreshCw } from 'lucide-react';
import type { TessituraRange, TessituraPresetId } from '../../types/tessitura.types';
import { TESSITURA_PRESETS, getTessituraBoundsHz } from '../../types/tessitura.types';
import { midiToNoteName } from '../../utils/noteUtils';
import { useLanguage } from '../../i18n/LanguageContext';

interface TessituraBoundsPanelProps {
  tessitura?: TessituraRange;
  onChange: (t: TessituraRange) => void;
  onRecalculate?: () => void;
  hasRecording?: boolean;
  disabled?: boolean;
}

const PRESET_KEYS: { id: TessituraPresetId; labelKey: any }[] = [
  { id: 'grave', labelKey: 'tessituraPresetGrave' },
  { id: 'medium', labelKey: 'tessituraPresetMedium' },
  { id: 'aigu', labelKey: 'tessituraPresetAigu' },
  { id: 'libre', labelKey: 'tessituraPresetLibre' },
];

export const TessituraBoundsPanel: React.FC<TessituraBoundsPanelProps> = ({
  tessitura = TESSITURA_PRESETS.medium,
  onChange,
  onRecalculate,
  hasRecording = false,
  disabled = false,
}) => {
  const { t } = useLanguage();
  const { minHz, maxHz } = useMemo(() => getTessituraBoundsHz(tessitura), [tessitura]);

  const noteOptions = useMemo(() => {
    const list: { midi: number; label: string }[] = [];
    for (let m = 36; m <= 84; m++) {
      list.push({ midi: m, label: midiToNoteName(m) });
    }
    return list;
  }, []);

  const handleSelectPreset = (presetId: TessituraPresetId) => {
    const p = TESSITURA_PRESETS[presetId];
    onChange({ ...p });
  };

  const handleMinChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const minMidi = parseInt(e.target.value, 10);
    const maxMidi = Math.max(minMidi + 5, tessitura.maxPitchMidi);
    onChange({ presetId: 'custom', minPitchMidi: minMidi, maxPitchMidi: maxMidi });
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const maxMidi = parseInt(e.target.value, 10);
    const minMidi = Math.min(maxMidi - 5, tessitura.minPitchMidi);
    onChange({ presetId: 'custom', minPitchMidi: minMidi, maxPitchMidi: maxMidi });
  };

  return (
    <div className="cordel-card p-2.5 sm:p-3 flex flex-col gap-2 font-mono text-xs select-none">
      <div className="flex items-center justify-between border-b border-[var(--cordel-border-sub)] pb-1.5">
        <div className="flex items-center gap-1.5 font-bold tracking-tight text-[var(--cordel-text)]">
          <Sliders className="w-3.5 h-3.5 text-[#9a3412]" />
          <span>{t('tessituraTitle')}</span>
        </div>
        {hasRecording && onRecalculate && (
          <button
            type="button"
            disabled={disabled}
            onClick={onRecalculate}
            title={t('tessituraRecalculateTooltip')}
            className="cordel-btn-primary !py-0.5 !px-2 flex items-center gap-1 text-[11px] font-bold cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>{t('tessituraRecalculate')}</span>
          </button>
        )}
      </div>

      {/* Presets rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
        {PRESET_KEYS.map(({ id, labelKey }) => {
          const isActive = tessitura.presetId === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => handleSelectPreset(id)}
              className={`py-1 px-1.5 text-[11px] font-bold truncate transition-all cursor-pointer rounded ${
                isActive ? 'cordel-btn-primary !text-[var(--cordel-on-primary)]' : 'cordel-card-sm hover:bg-white/5 opacity-75'
              }`}
            >
              {t(labelKey)}
            </button>
          );
        })}
      </div>

      {/* Bornes fines Plancher et Plafond */}
      <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px]">
        <div className="flex items-center gap-1.5 flex-1">
          <span className="opacity-70">{t('tessituraFloorLabel')}</span>
          <select
            value={tessitura.minPitchMidi}
            onChange={handleMinChange}
            disabled={disabled}
            className="cordel-card-sm px-1.5 py-0.5 font-bold text-theme-ink cursor-pointer"
          >
            {noteOptions.map((opt) => (
              <option key={opt.midi} value={opt.midi} className="bg-[var(--cordel-surface)] text-theme-ink">{opt.label}</option>
            ))}
          </select>
          <span className="text-[10px] opacity-60">({minHz} Hz)</span>
        </div>

        <div className="flex items-center justify-end gap-1.5 flex-1">
          <span className="opacity-70">{t('tessituraCeilingLabel')}</span>
          <select
            value={tessitura.maxPitchMidi}
            onChange={handleMaxChange}
            disabled={disabled}
            className="cordel-card-sm px-1.5 py-0.5 font-bold text-theme-ink cursor-pointer"
          >
            {noteOptions.map((opt) => (
              <option key={opt.midi} value={opt.midi} className="bg-[var(--cordel-surface)] text-theme-ink">{opt.label}</option>
            ))}
          </select>
          <span className="text-[10px] opacity-60">({maxHz} Hz)</span>
        </div>
      </div>
    </div>
  );
};
