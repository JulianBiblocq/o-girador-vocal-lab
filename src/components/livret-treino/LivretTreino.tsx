/**
 * LivretTreino.tsx
 * Conteneur principal du Livret 3 (Entraînement Vocal) articulé en 4 ateliers Cordel.
 * Intègre des icônes vectorielles SVG monochromes et un Kill-Switch audio strict au changement d'onglet.
 * Strictement < 120 lignes.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { AmbitusFinderPanel } from './AmbitusFinderPanel';
import { MaracatuVocalGames } from './MaracatuVocalGames';
import { PronunciationCardsPanel } from './PronunciationCardsPanel';
import { ChanterToadaWorkshop } from './ChanterToadaWorkshop';
import { triggerTreinoKillSwitch } from '../../audio/maracatuVocalGameEngine';
import { Compass, Target, Volume2, Mic } from 'lucide-react';

export type TreinoSubTab = 'ambitus' | 'warmup' | 'posture_diction' | 'chanter_toada';

export const LivretTreino: React.FC = () => {
  const { t } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState<TreinoSubTab>('ambitus');

  useEffect(() => {
    return () => {
      triggerTreinoKillSwitch();
    };
  }, []);

  const handleSelectTab = useCallback((nextTab: TreinoSubTab) => {
    if (nextTab === activeSubTab) return;
    // Sécurité Kill-Switch : coupe immédiatement flux micro, RAF et nœuds Web Audio de l'atelier précédent
    triggerTreinoKillSwitch();
    setActiveSubTab(nextTab);
  }, [activeSubTab]);

  const tabs: { id: TreinoSubTab; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { id: 'ambitus', label: t('tabAmbitus'), Icon: Compass },
    { id: 'warmup', label: t('tabWarmup'), Icon: Target },
    { id: 'posture_diction', label: t('tabPostureDiction'), Icon: Volume2 },
    { id: 'chanter_toada', label: t('tabChanterToada'), Icon: Mic },
  ];

  return (
    <div className="w-full space-y-4">
      {/* Barre de navigation des 4 sous-ateliers Cordel avec icônes SVG monochromes */}
      <div className="flex flex-wrap gap-2 border-b-2 border-[#1a1a1a] pb-3 select-none">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = activeSubTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSelectTab(id)}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] rounded-none transition-transform cursor-pointer ${
                isActive
                  ? 'bg-[#8b2a1a] text-[#f4ecd8] -translate-y-0.5 shadow-[3px_3px_0px_#1a1a1a]'
                  : 'bg-[#fcfaf2] dark:bg-[#24211d] text-[#1a1a1a] dark:text-[#f4ecd8] hover:bg-[#f5edd6] dark:hover:bg-[#2f2b25]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0 stroke-current" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Rendu dynamique de l'atelier sélectionné */}
      <div className="w-full">
        {activeSubTab === 'ambitus' && <AmbitusFinderPanel />}
        {activeSubTab === 'warmup' && <MaracatuVocalGames />}
        {activeSubTab === 'posture_diction' && <PronunciationCardsPanel />}
        {activeSubTab === 'chanter_toada' && <ChanterToadaWorkshop />}
      </div>
    </div>
  );
};
