/**
 * MainLivretNavbar.tsx
 * Barre de navigation principale permanente : 5 Livrets + ⚙️ Réglages (< 110 lignes).
 */
import React from 'react';
import { Layers, Mic, Scissors, Music, Headphones, Settings } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useVocalTransportStore, type LivretType } from '../../stores/useVocalTransportStore';
import { useToadaProject } from '../../context/ToadaProjectContext';

interface TabItem {
  id: LivretType;
  labelKey: 'tabLivret1' | 'tabLivret2' | 'tabLivret3' | 'tabLivret4' | 'tabLivret5' | 'tabReglages';
  icon: React.FC<{ className?: string }>;
}

const TABS: TabItem[] = [
  { id: 'structure', labelKey: 'tabLivret1', icon: Layers },
  { id: 'prise', labelKey: 'tabLivret2', icon: Mic },
  { id: 'calage', labelKey: 'tabLivret3', icon: Scissors },
  { id: 'melodia', labelKey: 'tabLivret4', icon: Music },
  { id: 'treino', labelKey: 'tabLivret5', icon: Headphones },
  { id: 'reglages', labelKey: 'tabReglages', icon: Settings },
];

export const MainLivretNavbar: React.FC = () => {
  const { activeLivret, setActiveLivret, viewRoleMode } = useVocalTransportStore();
  const { activePattern } = useToadaProject();
  const { t } = useLanguage();

  if (viewRoleMode === 'eleve') {
    return (
      <div className="flex items-center justify-center gap-2 border-b border-[var(--cordel-border-sub)] pb-2 select-none">
        <div className="cordel-btn-primary px-4 py-1.5 text-xs font-mono font-bold flex items-center gap-2 rounded">
          <Headphones className="w-3.5 h-3.5" />
          <span>{t('tabLivret5')}</span>
        </div>
      </div>
    );
  }

  const hasMelodia = Boolean(activePattern.pack || activePattern.isMidiInitialized);
  const hasAudio = Boolean(activePattern.variants[activePattern.activeVariantKey]?.recordingResult);

  return (
    <nav
      aria-label="Navigation des Livrets"
      className="w-full flex items-center justify-start sm:justify-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 mb-3 border-b border-[var(--cordel-border-sub)] select-none cordel-scrollbar"
    >
      {TABS.map(({ id, labelKey, icon: Icon }) => {
        const isActive = activeLivret === id;
        const isMelodiaTab = id === 'melodia';
        const isCalageTab = id === 'calage';

        let badgeDot: string | null = null;
        if (isCalageTab && hasAudio) badgeDot = '●';
        if (isMelodiaTab && hasMelodia) badgeDot = '●';

        return (
          <button
            key={id}
            type="button"
            onClick={() => setActiveLivret(id)}
            className={`px-2.5 sm:px-3.5 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 transition-all rounded whitespace-nowrap cursor-pointer shrink-0 ${
              isActive
                ? 'cordel-btn-primary shadow-sm'
                : 'cordel-btn opacity-70 hover:opacity-100 hover:border-amber-400/60'
            }`}
          >
            <Icon className="w-3.5 h-3.5 text-current shrink-0" />
            <span>{t(labelKey)}</span>
            {badgeDot && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
            )}
          </button>
        );
      })}
    </nav>
  );
};
