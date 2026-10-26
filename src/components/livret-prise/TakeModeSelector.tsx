/**
 * TakeModeSelector.tsx
 * Sélecteur de mode de prise : pattern unique vs prise continue Puxador / Coro (< 75 lignes).
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
        type="button"
        disabled={disabled}
        onClick={() => onChangeMode('pattern')}
        className={`px-3 py-1 text-xs font-mono font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
          mode === 'pattern'
            ? 'bg-stone-900 text-white shadow-2xs'
            : 'bg-white/60 text-stone-700 hover:bg-stone-100 border border-stone-300/60'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={t('takeModePatternTitle') || 'Enregistrer seulement le pattern sélectionné'}
      >
        <Target className="w-3.5 h-3.5" />
        <span>{t('takeModePattern') || '🎯 Ce pattern seul'}</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChangeMode('puxador')}
        className={`px-3 py-1 text-xs font-mono font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
          mode === 'puxador'
            ? 'bg-amber-800 text-white shadow-2xs'
            : 'bg-white/60 text-amber-900 hover:bg-amber-50 border border-amber-300/60'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={t('takeModePuxadorTitle') || 'Enregistrer tous les blocs Puxador de la chanson d une traite'}
      >
        <CircleDot className="w-3.5 h-3.5 text-amber-400" />
        <span>{t('takeModePuxador') || '🔴 Tout le Puxador d’un coup'}</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onChangeMode('coro')}
        className={`px-3 py-1 text-xs font-mono font-bold rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
          mode === 'coro'
            ? 'bg-emerald-800 text-white shadow-2xs'
            : 'bg-white/60 text-emerald-900 hover:bg-emerald-50 border border-emerald-300/60'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={t('takeModeCoroTitle') || 'Enregistrer tous les blocs Chœur de la chanson d une traite avec le Puxador dans le casque'}
      >
        <CircleDot className="w-3.5 h-3.5 text-emerald-300" />
        <span>{t('takeModeCoro') || '🟢 Tout le Coro d’un coup'}</span>
      </button>
    </div>
  );
};
