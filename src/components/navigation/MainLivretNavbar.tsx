/**
 * MainLivretNavbar.tsx
 * Barre de navigation principale permanente : 5 Livrets + ⚙️ Réglages (< 85 lignes).
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

const ELEVE_TABS = TABS.filter((t) => t.id === 'treino' || t.id === 'reglages');

export const MainLivretNavbar: React.FC = () => {
  const activeLivret = useVocalTransportStore((s) => s.activeLivret);
  const setActiveLivret = useVocalTransportStore((s) => s.setActiveLivret);
  const viewRoleMode = useVocalTransportStore((s) => s.viewRoleMode);
  const { activePattern } = useToadaProject();
  const { t } = useLanguage();

  const visibleTabs = viewRoleMode === 'eleve' ? ELEVE_TABS : TABS;
  const hasMelodia = Boolean(
    activePattern?.pack ||
    activePattern?.isMidiInitialized ||
    activePattern?.mainSteps?.some((s) => s.active)
  );
  const hasAudio = Boolean(
    activePattern?.recordingResult?.pcm?.length ||
    activePattern?.rawAudioSamples?.length ||
    activePattern?.variants?.[activePattern.activeVariantKey]?.recordingResult?.pcm?.length
  );

  return (
    <nav
      aria-label="Navigation des Livrets"
      className="w-full flex items-center justify-start sm:justify-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 mb-3 border-b border-[var(--cordel-border-sub)] select-none cordel-scrollbar"
    >
      {visibleTabs.map(({ id, labelKey, icon: Icon }) => {
        const isActive = activeLivret === id;
        const showDot = (id === 'calage' && hasAudio) || (id === 'melodia' && hasMelodia);

        return (
          <button
            key={id}
            type="button"
            onClick={() => setActiveLivret(id)}
            className={`px-2.5 sm:px-3.5 py-1.5 text-xs font-mono font-bold flex items-center gap-1.5 transition-all rounded whitespace-nowrap cursor-pointer shrink-0 ${
              isActive
                ? 'cordel-btn-primary shadow-sm'
                : 'cordel-btn opacity-75 hover:opacity-100 hover:border-amber-400/60'
            }`}
          >
            <Icon className="w-3.5 h-3.5 text-current shrink-0" />
            <span>{t(labelKey)}</span>
            {showDot && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />}
          </button>
        );
      })}
    </nav>
  );
};
