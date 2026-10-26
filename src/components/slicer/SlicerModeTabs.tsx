/**
 * SlicerModeTabs.tsx
 * Onglets de bascule entre Découpe Multi-Blocs et Calage Piquets (< 50 lignes).
 */
import React from 'react';
import { Layers, Sliders } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export type SlicerWorkMode = 'multi' | 'single';

interface SlicerModeTabsProps {
  mode: SlicerWorkMode;
  onModeChange: (m: SlicerWorkMode) => void;
}

export const SlicerModeTabs: React.FC<SlicerModeTabsProps> = ({ mode, onModeChange }) => {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-1.5 border-b border-[var(--cordel-border-sub)] pb-1.5">
      <button
        type="button"
        onClick={() => onModeChange('multi')}
        className={`px-3 py-1 text-xs font-mono font-bold rounded flex items-center gap-1.5 cursor-pointer transition-colors ${
          mode === 'multi'
            ? 'bg-theme-wood text-[#f4ecd8] shadow-xs'
            : 'cordel-card-sm text-[var(--cordel-secondary-text)] hover:text-theme-ink'
        }`}
      >
        <Layers className="w-3.5 h-3.5" />
        <span>{t('slicerModeMultiTitle')}</span>
      </button>

      <button
        type="button"
        onClick={() => onModeChange('single')}
        className={`px-3 py-1 text-xs font-mono font-bold rounded flex items-center gap-1.5 cursor-pointer transition-colors ${
          mode === 'single'
            ? 'bg-theme-wood text-[#f4ecd8] shadow-xs'
            : 'cordel-card-sm text-[var(--cordel-secondary-text)] hover:text-theme-ink'
        }`}
      >
        <Sliders className="w-3.5 h-3.5" />
        <span>{t('slicerModeSingleTitle')}</span>
      </button>
    </div>
  );
};
