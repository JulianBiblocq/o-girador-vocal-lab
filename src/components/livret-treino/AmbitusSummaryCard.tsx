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
    <div className="cordel-card p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--cordel-border-sub)] pb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xs uppercase tracking-wider text-[var(--cordel-text)]">{t('ambitusTessitureLabel')}</span>
          <span className="bg-[var(--cordel-coro)] text-[#f4ecd8] px-2 py-0.5 text-xs font-bold uppercase rounded shadow-sm">
            {p.tessiture}
          </span>
        </div>
        <span className="text-xs font-mono text-[var(--cordel-secondary-text)]">
          {t('ambitusRangeLabel').replace('{n}', String(p.rangeSemitones))}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="cordel-card-sm p-2.5 rounded">
          <span className="block text-[10px] text-[var(--cordel-secondary-text)]">{t('ambitusLowestLabel')}</span>
          <span className="font-bold font-mono text-sm text-[#9a3412] dark:text-[#c88a2b]">{p.lowestSolidNote}</span>
        </div>
        <div className="cordel-card-sm p-2.5 rounded">
          <span className="block text-[10px] text-[var(--cordel-secondary-text)]">{t('ambitusCenterLabel')}</span>
          <span className="font-bold font-mono text-sm text-[#0f766e] dark:text-[#2dd4bf]">{p.comfortCenterNote}</span>
        </div>
        <div className="cordel-card-sm p-2.5 rounded">
          <span className="block text-[10px] text-[var(--cordel-secondary-text)]">{t('ambitusHighestLabel')}</span>
          <span className="font-bold font-mono text-sm text-[#9a3412] dark:text-[#c88a2b]">{p.highestSolidNote}</span>
        </div>
      </div>

      {/* Compatibilité avec la Toada active */}
      <div className={`p-2.5 text-xs flex items-center justify-between gap-2 rounded border ${
        compatibility.isCompatible
          ? 'bg-[#0f766e]/10 border-[#0f766e]/30 text-[#0f766e] dark:text-[#2dd4bf]'
          : 'bg-[#c25e38]/10 border-[#c25e38]/30 text-[#9a3412] dark:text-[#e69d35]'
      }`}>
        {compatibility.isCompatible ? (
          <div className="flex items-center gap-1.5 font-semibold">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{t('ambitusToadaFit')}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 font-semibold">
            <ArrowRightLeft className="w-4 h-4 shrink-0" />
            <span>
              {t('ambitusToadaTransposeAdvice').replace('{n}', (compatibility.suggestedTranspositionSemitones > 0 ? '+' : '') + compatibility.suggestedTranspositionSemitones)}
            </span>
          </div>
        )}
      </div>

      {/* Confirmation de Synchronisation Silencieuse Cloud organizador */}
      {isCompleted && (
        <div className="p-2.5 bg-[#0f766e]/10 border border-[#0f766e]/30 text-[#0f766e] dark:text-[#2dd4bf] text-xs font-bold flex items-center justify-center gap-2 rounded">
          <Cloud className="w-4 h-4 shrink-0" />
          <span>{t('ambitusSyncSuccessBadge')}</span>
        </div>
      )}
    </div>
  );
};
