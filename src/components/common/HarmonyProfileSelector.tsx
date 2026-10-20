/**
 * HarmonyProfileSelector.tsx
 * Sélecteur UI compact [ 🎸 Accords MIDI ▾ ] avec toggle, profils et volume (< 125 lignes).
 */
import React, { useState, useRef, useEffect } from 'react';
import type { HarmonyConfig, HarmonyProfileId } from '../../types/harmony.types';
import { useLanguage } from '../../i18n/LanguageContext';
import { Volume2, Music, Check } from 'lucide-react';

interface HarmonyProfileSelectorProps {
  config: HarmonyConfig;
  onChange: (nextConfig: HarmonyConfig) => void;
  disabled?: boolean;
}

export const HarmonyProfileSelector: React.FC<HarmonyProfileSelectorProps> = ({ config, onChange, disabled }) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const profiles: { id: HarmonyProfileId; label: string }[] = [
    { id: 'maracatu', label: t('harmonyProfileMaracatu') },
    { id: 'capoeira', label: t('harmonyProfileCapoeira') },
    { id: 'samba', label: t('harmonyProfileSamba') },
    { id: 'forro', label: t('harmonyProfileForro') },
  ];

  const currentLabel = profiles.find((p) => p.id === config.profile)?.label || config.profile;

  return (
    <div ref={containerRef} className="relative inline-block select-none text-xs">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`px-2.5 py-1 font-mono font-bold flex items-center gap-1.5 border rounded cursor-pointer transition-colors ${
          config.enabled
            ? 'border-amber-600 bg-amber-500/20 text-amber-800 dark:text-amber-200'
            : 'cordel-btn'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={`${t('harmonyToggleHelp')} — ${currentLabel}`}
      >
        <Music className={`w-3.5 h-3.5 ${config.enabled ? 'text-amber-600 dark:text-amber-400' : 'text-stone-500'}`} />
        <span>🎸 {t('harmonyBtnLabel')}</span>
        <span className={`w-2 h-2 rounded-full ${config.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-stone-500'}`} />
        <span className="text-[10px] opacity-75">▾</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-64 p-3 cordel-card shadow-lg z-50 flex flex-col gap-2.5 rounded animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-1.5 border-b border-[var(--cordel-border-sub)]">
            <span className="font-bold text-[11px] text-amber-700 dark:text-amber-400 tracking-wider uppercase">{t('harmonyTitle')}</span>
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
                className="accent-amber-500 cursor-pointer"
              />
              <span className="font-bold">{config.enabled ? 'ON' : 'OFF'}</span>
            </label>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-mono text-[var(--cordel-secondary-text)]">Profil sonore :</span>
            {profiles.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ ...config, profile: id })}
                className={`px-2 py-1 text-left text-[11px] font-mono flex items-center justify-between border rounded cursor-pointer ${
                  config.profile === id
                    ? 'border-amber-500/70 bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold'
                    : 'cordel-btn'
                }`}
              >
                <span>{label}</span>
                {config.profile === id && <Check className="w-3 h-3 text-amber-600 dark:text-amber-400" />}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1 pt-1 border-t border-[var(--cordel-border-sub)]">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="flex items-center gap-1 text-[var(--cordel-secondary-text)]"><Volume2 className="w-3 h-3" />{t('harmonyVolumeLabel')}</span>
              <span className="text-amber-700 dark:text-amber-300 font-bold">{Math.round(config.volume * 100)} %</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={config.volume}
              onChange={(e) => onChange({ ...config, volume: parseFloat(e.target.value) })}
              className="accent-[var(--cordel-wood)] cursor-pointer w-full h-1 rounded"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-[10.5px] font-mono text-[var(--cordel-secondary-text)] pt-1">
            <input
              type="checkbox"
              checked={Boolean(config.muteBass)}
              onChange={(e) => onChange({ ...config, muteBass: e.target.checked })}
              className="accent-amber-500 cursor-pointer"
            />
            <span>{t('harmonyMuteBass')}</span>
          </label>
        </div>
      )}
    </div>
  );
};
