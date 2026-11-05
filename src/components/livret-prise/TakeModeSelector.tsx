/**
 * TakeModeSelector.tsx
 * Sélecteur de mode de prise avec contrastes Jour/Nuit Cordel (< 70 lignes).
 */
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { Target, CircleDot } from 'lucide-react';

export type TakeRecordingMode = 'pattern' | 'puxador' | 'coro';

interface TakeModeSelectorProps {
  mode: TakeRecordingMode;
  onChangeMode: (m: TakeRecordingMode) => void;
  disabled?: boolean;
}

export const TakeModeSelector: React.FC<TakeModeSelectorProps> = ({ mode, onChangeMode, disabled = false }) => {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-center gap-1.5 p-1 cordel-card rounded-lg flex-wrap">
      <button
        type="button" disabled={disabled} onClick={() => onChangeMode('pattern')}
        className={`px-3 py-1 text-xs font-mono font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
          mode === 'pattern'
            ? 'bg-stone-900 dark:bg-stone-800 text-white border border-amber-500/60 shadow-2xs'
            : 'bg-[var(--cordel-subcard-bg)] text-theme-ink hover:opacity-90 border border-[var(--cordel-border-sub)]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={t('takeModePatternTitle')}
      >
        <Target className="w-3.5 h-3.5" />
        <span>{t('takeModePattern')}</span>
      </button>

      <button
        type="button" disabled={disabled} onClick={() => onChangeMode('puxador')}
        className={`px-3 py-1 text-xs font-mono font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
          mode === 'puxador'
            ? 'bg-amber-800 text-white shadow-2xs'
            : 'bg-[var(--cordel-subcard-bg)] text-amber-800 dark:text-amber-300 hover:bg-amber-500/10 border border-amber-500/40'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={t('takeModePuxadorTitle')}
      >
        <CircleDot className={`w-3.5 h-3.5 ${mode === 'puxador' ? 'text-amber-200' : 'text-amber-700 dark:text-amber-400'}`} />
        <span>{t('takeModePuxador')}</span>
      </button>

      <button
        type="button" disabled={disabled} onClick={() => onChangeMode('coro')}
        className={`px-3 py-1 text-xs font-mono font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
          mode === 'coro'
            ? 'bg-emerald-800 text-white shadow-2xs'
            : 'bg-[var(--cordel-subcard-bg)] text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/40'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={t('takeModeCoroTitle')}
      >
        <CircleDot className={`w-3.5 h-3.5 ${mode === 'coro' ? 'text-emerald-200' : 'text-emerald-700 dark:text-emerald-400'}`} />
        <span>{t('takeModeCoro')}</span>
      </button>
    </div>
  );
};
