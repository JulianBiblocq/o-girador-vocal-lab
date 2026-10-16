/**
 * AmbitusSummaryCard.tsx
 * Carte récapitulative Cordel de l'ambitus et compatibilité Toada.
 * Statut de synchronisation automatique Firestore organizador (sans bouton export JSON).
 * Strictement < 100 lignes.
 */
import React from 'react';
import type { VocalProfilePayload } from '../../types/vocalProfile.types';
import { useLanguage } from '../../i18n/LanguageContext';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { analyzeToadaCompatibility } from '../../utils/ambitusStorage';
import { CheckCircle, ArrowRightLeft, Cloud } from 'lucide-react';

interface Props {
  profile: VocalProfilePayload;
  isCompleted?: boolean;
}

export const AmbitusSummaryCard: React.FC<Props> = ({ profile, isCompleted = true }) => {
  const { t } = useLanguage();
  const { project } = useToadaProject();

  const p = profile.vocalProfile;
  const compatibility = analyzeToadaCompatibility(profile, project.patterns);

  return (
    <div className="bg-[#fcfaf2] dark:bg-[#1f1d1a] border-2 border-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a] p-4 text-[#1a1a1a] dark:text-[#f4ecd8] rounded-none space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1a1a1a]/20 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs uppercase tracking-wider">{t('ambitusTessitureLabel')}</span>
          <span className="bg-[#2a9d8f] text-[#f4ecd8] px-2 py-0.5 text-xs font-bold uppercase rounded-none shadow-[1px_1px_0px_#1a1a1a]">
            {p.tessiture}
          </span>
        </div>
        <span className="text-xs font-mono opacity-80">
          {t('ambitusRangeLabel').replace('{n}', String(p.rangeSemitones))}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-[#f5edd6] dark:bg-[#2b2722] p-2 border border-[#1a1a1a]/15">
          <span className="block text-[10px] opacity-75">{t('ambitusLowestLabel')}</span>
          <span className="font-bold font-mono text-sm text-[#d97706]">{p.lowestSolidNote}</span>
        </div>
        <div className="bg-[#f5edd6] dark:bg-[#2b2722] p-2 border border-[#1a1a1a]/15">
          <span className="block text-[10px] opacity-75">{t('ambitusCenterLabel')}</span>
          <span className="font-bold font-mono text-sm text-[#2a9d8f]">{p.comfortCenterNote}</span>
        </div>
        <div className="bg-[#f5edd6] dark:bg-[#2b2722] p-2 border border-[#1a1a1a]/15">
          <span className="block text-[10px] opacity-75">{t('ambitusHighestLabel')}</span>
          <span className="font-bold font-mono text-sm text-[#d97706]">{p.highestSolidNote}</span>
        </div>
      </div>

      {/* Compatibilité avec la Toada active */}
      <div className="border border-[#1a1a1a]/20 p-2.5 text-xs flex items-center justify-between gap-2 bg-[#f9f6ed] dark:bg-[#26231e]">
        {compatibility.isCompatible ? (
          <div className="flex items-center gap-1.5 text-[#2a9d8f] font-semibold">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{t('ambitusToadaFit')}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[#d97706] font-semibold">
            <ArrowRightLeft className="w-4 h-4 shrink-0" />
            <span>
              {t('ambitusToadaTransposeAdvice').replace('{n}', (compatibility.suggestedTranspositionSemitones > 0 ? '+' : '') + compatibility.suggestedTranspositionSemitones)}
            </span>
          </div>
        )}
      </div>

      {/* Confirmation de Synchronisation Silencieuse Cloud organizador */}
      {isCompleted && (
        <div className="p-2.5 bg-[#2a9d8f]/15 border border-[#2a9d8f]/40 text-[#2a9d8f] dark:text-[#2a9d8f] text-xs font-bold flex items-center justify-center gap-2 rounded-none">
          <Cloud className="w-4 h-4 shrink-0" />
          <span>{t('ambitusSyncSuccessBadge')}</span>
        </div>
      )}
    </div>
  );
};
