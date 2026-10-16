/**
 * AmbitusStageBar.tsx
 * Barre d'etapes du parcours d'ambitus (1: Balayage, 2: Grave, 3: Aigu, 4: Escalier).
 * Respect strict de la charte Cordel « Zero Rouge » (< 70 lignes).
 */
import React from 'react';

export type AmbitusStage = 'sweep' | 'low_test' | 'high_test' | 'staircase' | 'completed';

interface Props {
  currentStage: AmbitusStage;
  isStageDone: (s: AmbitusStage) => boolean;
  onSelectStage: (s: AmbitusStage) => void;
  t: (k: any) => string;
}

export const AmbitusStageBar: React.FC<Props> = ({ currentStage, isStageDone, onSelectStage, t }) => {
  const stages: Array<{ key: AmbitusStage; label: string }> = [
    { key: 'sweep', label: t('ambitusStage1Short') },
    { key: 'low_test', label: t('ambitusStage2Short') },
    { key: 'high_test', label: t('ambitusStage3Short') },
    { key: 'staircase', label: t('ambitusStage4Short') },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-[var(--cordel-bg)]/80 border border-[var(--cordel-border)]">
      {stages.map((st) => {
        const isActive = currentStage === st.key;
        const isDone = isStageDone(st.key);

        return (
          <button
            key={st.key}
            type="button"
            onClick={() => onSelectStage(st.key)}
            className={`py-1 px-2 text-xs font-mono font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
              isActive
                ? 'bg-[#2a9d8f] text-[#f4ecd8] border-[#1a1a1a] shadow-sm'
                : isDone
                ? 'bg-[#2a9d8f]/20 text-[#2a9d8f] dark:text-[#2a9d8f] border-[#2a9d8f]/40 hover:bg-[#2a9d8f]/30'
                : 'bg-[var(--cordel-surface)] text-[var(--cordel-text)]/70 border-[var(--cordel-border)] hover:text-[var(--cordel-text)]'
            }`}
          >
            <span>{isDone ? '✓' : '○'}</span>
            <span>{st.label}</span>
          </button>
        );
      })}
    </div>
  );
};
