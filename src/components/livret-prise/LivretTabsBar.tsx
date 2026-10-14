/**
 * LivretTabsBar.tsx
 * Onglets de bascule entre Livret 1 (Prise), Livret 2 (Melodia & Letra) et Livret 3 (Entrainement).
 */
import React from 'react';
import { CordelMic, CordelNote } from '../common/CordelIcons';
import { Headphones } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export type LivretTabType = 'prise' | 'melodia' | 'treino';

interface LivretTabsBarProps {
  activeLivret: LivretTabType;
  onSelectLivret: (livret: LivretTabType) => void;
  canAccessMelodia?: boolean;
}

export const LivretTabsBar: React.FC<LivretTabsBarProps> = ({ activeLivret, onSelectLivret, canAccessMelodia = true }) => {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-center gap-2.5 border-b border-theme-border/40 pb-2 select-none">
      <button
        type="button"
        onClick={() => onSelectLivret('prise')}
        className={`px-3 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 transition-all rounded-none cursor-pointer ${
          activeLivret === 'prise' ? 'cordel-btn-primary' : 'cordel-btn opacity-60 hover:opacity-100'
        }`}
      >
        <CordelMic className="w-3.5 h-3.5" />
        <span>{t('tabLivret1')}</span>
      </button>

      {canAccessMelodia && (
        <button
          type="button"
          onClick={() => onSelectLivret('melodia')}
          className={`px-3 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 transition-all rounded-none cursor-pointer ${
            activeLivret === 'melodia' ? 'cordel-btn-primary' : 'cordel-btn opacity-60 hover:opacity-100'
          }`}
        >
          <CordelNote className="w-3.5 h-3.5" />
          <span>{t('tabLivret2')}</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => onSelectLivret('treino')}
        className={`px-3 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 transition-all rounded-none cursor-pointer ${
          activeLivret === 'treino' ? 'cordel-btn-primary' : 'cordel-btn opacity-60 hover:opacity-100'
        }`}
      >
        <Headphones className="w-3.5 h-3.5" />
        <span>{t('tabLivret3')}</span>
      </button>
    </div>
  );
};
