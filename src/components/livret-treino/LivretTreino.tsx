/**
 * LivretTreino.tsx
 * Espace Élève épuré en 5 ateliers Cordel : 1. Fiche & Paroles, 2. Karaoké, 3. Diction, 4. Mon Ambitus, 5. Jeux de Voix (< 95 lignes).
 */
import React, { useCallback, useEffect } from 'react';
import { BookOpen, Mic, Volume2, Compass, Target } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { StudentToadaSheetPanel } from './StudentToadaSheetPanel';
import { ChanterToadaWorkshop } from './ChanterToadaWorkshop';
import { PronunciationCardsPanel } from './PronunciationCardsPanel';
import { AmbitusFinderPanel } from './AmbitusFinderPanel';
import { MaracatuVocalGames } from './MaracatuVocalGames';
import { triggerTreinoKillSwitch } from '../../audio/maracatuVocalGameEngine';
import { stopAllActiveAudioEngines } from '../../audio/sharedAudioContext';
import { useVocalTransportStore, type TreinoSubTab } from '../../stores/useVocalTransportStore';

export type { TreinoSubTab };

export const LivretTreino: React.FC = () => {
  const { t } = useLanguage();
  const activeSubTab = useVocalTransportStore((s) => s.treinoSubTab);
  const setTreinoSubTab = useVocalTransportStore((s) => s.setTreinoSubTab);

  useEffect(() => () => {
    triggerTreinoKillSwitch();
    stopAllActiveAudioEngines();
  }, []);

  const handleSelectTab = useCallback((nextTab: TreinoSubTab) => {
    if (nextTab === activeSubTab) return;
    triggerTreinoKillSwitch();
    stopAllActiveAudioEngines();
    setTreinoSubTab(nextTab);
  }, [activeSubTab, setTreinoSubTab]);

  const tabs: { id: TreinoSubTab; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { id: 'fiche_paroles', label: t('studentTabSheet'), Icon: BookOpen },
    { id: 'chanter_toada', label: t('studentTabKaraoke'), Icon: Mic },
    { id: 'posture_diction', label: t('studentTabDiction'), Icon: Volume2 },
    { id: 'ambitus', label: t('studentTabAmbitus'), Icon: Compass },
    { id: 'warmup', label: t('studentTabGames'), Icon: Target },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 my-2">
      <div className="flex flex-wrap gap-2 border-b border-[var(--cordel-border-panel)] pb-3 select-none">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = activeSubTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleSelectTab(id)}
              className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 border rounded transition-transform cursor-pointer ${
                isActive
                  ? 'bg-[#9a3412] text-[#f4ecd8] border-[#9a3412] -translate-y-0.5 shadow-[var(--cordel-shadow-sm)]'
                  : 'bg-[var(--cordel-surface)] text-[var(--cordel-text)] border-[var(--cordel-border-panel)] hover:bg-[var(--cordel-subcard-bg)] hover:border-[var(--cordel-accent)] shadow-[var(--cordel-shadow-sm)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0 stroke-current" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div className="w-full">
        {activeSubTab === 'fiche_paroles' && <StudentToadaSheetPanel />}
        {activeSubTab === 'chanter_toada' && <ChanterToadaWorkshop />}
        {activeSubTab === 'posture_diction' && <PronunciationCardsPanel />}
        {activeSubTab === 'ambitus' && <AmbitusFinderPanel />}
        {activeSubTab === 'warmup' && <MaracatuVocalGames />}
      </div>
    </div>
  );
};
