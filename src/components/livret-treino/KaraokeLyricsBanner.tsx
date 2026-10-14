/**
 * KaraokeLyricsBanner.tsx
 * Bandeau Karaoke synchronise avec badge Puxador / Coro,
 * indicateur "A vous de chanter !" et surlignage des syllabes sans saccade (Zero Render Thrashing).
 */
import React from 'react';
import type { VocalRole } from '../../types/toadaProject.types';
import type { StudentRole } from './TrainerConfigBar';
import { useLanguage } from '../../i18n/LanguageContext';

export interface KaraokeSyllableItem {
  text: string;
  stepIndex: number;
}

interface KaraokeLyricsBannerProps {
  currentRole: VocalRole;
  studentRole: StudentRole;
  patternName: string;
  syllables: KaraokeSyllableItem[];
  activeStepIndex: number;
}

export const KaraokeLyricsBanner: React.FC<KaraokeLyricsBannerProps> = ({
  currentRole, studentRole, patternName, syllables, activeStepIndex
}) => {
  const { t } = useLanguage();
  const isPux = currentRole === 'puxador';
  const isStudentTurn = studentRole === 'all' || studentRole === currentRole;

  return (
    <div className="cordel-card p-3 w-full flex flex-col md:flex-row md:items-center justify-between gap-3 bg-stone-950/80 border border-theme-border/60 select-none">
      {/* 1. Badges de role et de tour de chant */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`px-2 py-0.5 text-xs font-black tracking-wider uppercase ${isPux ? 'bg-role-puxador text-white' : 'bg-role-coro text-white'}`}>
          {isPux ? t('rolePuxador') : t('roleCoro')}
        </span>
        <span className="text-xs font-mono font-bold text-theme-ink/80 truncate max-w-[120px]">
          {patternName}
        </span>
        <span className={`px-2 py-0.5 text-[11px] font-black font-mono tracking-wide ${
          isStudentTurn ? 'bg-emerald-600 text-white animate-pulse' : 'bg-stone-800 text-stone-400'
        }`}>
          {isStudentTurn ? t('karaoke_your_turn') : t('karaoke_listen_guide')}
        </span>
      </div>

      {/* 2. Syllabes synchronisees avec surlignage */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 font-mono text-sm leading-relaxed cordel-scrollbar">
        {syllables.length === 0 ? (
          <span className="text-xs text-theme-ink/40 italic">{t('karaoke_no_lyrics')}</span>
        ) : (
          syllables.map((syl, idx) => {
            const isPassed = syl.stepIndex < activeStepIndex;
            const isCurrent = syl.stepIndex === activeStepIndex;
            return (
              <span
                key={`${syl.stepIndex}-${idx}`}
                className={`transition-colors duration-150 px-1 py-0.5 rounded-none ${
                  isCurrent
                    ? 'bg-amber-400 text-stone-950 font-black shadow scale-105'
                    : isPassed
                    ? 'text-theme-ink/40 font-medium'
                    : 'text-theme-ink font-bold'
                }`}
              >
                {syl.text}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
};
