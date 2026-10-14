/**
 * LivretTabsBar.tsx
 * Onglets de bascule entre Livret 1 (Prise) et Livret 2 (Melodia & Letra).
 */
import React from 'react';
import { CordelMic, CordelNote } from '../common/CordelIcons';
import { useLanguage } from '../../i18n/LanguageContext';

interface LivretTabsBarProps {
  activeLivret: 'prise' | 'melodia';
  onSelectLivret: (livret: 'prise' | 'melodia') => void;
}

export const LivretTabsBar: React.FC<LivretTabsBarProps> = ({ activeLivret, onSelectLivret }) => {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-center gap-3 border-b border-theme-border/40 pb-2 select-none">
      <button
        type="button"
        onClick={() => onSelectLivret('prise')}
        className={`px-3.5 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 transition-all rounded-none cursor-pointer ${
          activeLivret === 'prise' ? 'cordel-btn-primary' : 'cordel-btn opacity-60 hover:opacity-100'
        }`}
      >
        <CordelMic className="w-3.5 h-3.5" />
        <span>{t('tabLivret1')}</span>
      </button>
      <button
        type="button"
        onClick={() => onSelectLivret('melodia')}
        className={`px-3.5 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 transition-all rounded-none cursor-pointer ${
          activeLivret === 'melodia' ? 'cordel-btn-primary' : 'cordel-btn opacity-60 hover:opacity-100'
        }`}
      >
        <CordelNote className="w-3.5 h-3.5" />
        <span>{t('tabLivret2')}</span>
      </button>
    </div>
  );
};
