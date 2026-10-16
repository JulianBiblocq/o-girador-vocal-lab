/**
 * CulturalInsightCard.tsx
 * Carte culturelle Cordel affichant la traduction, l'anecdote et le lexique de la Toada.
 * Strictement < 150 lignes.
 */

import React from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';

export const CulturalInsightCard: React.FC = () => {
  const { t } = useLanguage();
  const { project } = useToadaProject();
  const meta = project.toadaMeta;

  if (!meta) return null;

  const hasContent = Boolean(meta.traduction || meta.anecdote || meta.notesLexique);
  if (!hasContent) return null;

  return (
    <div className="bg-[#fcfaf2] dark:bg-[#1f1d1a] border-2 border-[#1a1a1a] shadow-[4px_4px_0px_#1a1a1a] p-4 text-[#1a1a1a] dark:text-[#f4ecd8] space-y-3 rounded-none">
      <div className="font-bold uppercase tracking-wider text-xs border-b border-[#1a1a1a]/20 dark:border-white/20 pb-1 flex items-center justify-between">
        <span>📜 {meta.titre || project.title || 'Toada'}</span>
        {meta.nacao && <span className="text-[10px] opacity-75 font-normal">Nação : {meta.nacao}</span>}
      </div>

      {meta.traduction && (
        <div className="text-xs">
          <span className="font-bold block text-[11px] opacity-80">{t('culturalTraductionLabel')}</span>
          <p className="italic mt-0.5 leading-relaxed bg-[#f5edd6] dark:bg-[#2b2722] p-2 border border-[#1a1a1a]/15">
            {meta.traduction}
          </p>
        </div>
      )}

      {meta.anecdote && (
        <div className="text-xs">
          <span className="font-bold block text-[11px] opacity-80">{t('culturalAnecdoteLabel')}</span>
          <p className="mt-0.5 leading-relaxed">{meta.anecdote}</p>
        </div>
      )}

      {meta.notesLexique && meta.notesLexique.length > 0 && (
        <div className="text-xs">
          <span className="font-bold block text-[11px] opacity-80">{t('culturalLexiqueLabel')}</span>
          <div className="mt-0.5 space-y-1 bg-[#f0ebd9] dark:bg-[#26231e] p-2 border border-[#1a1a1a]/15 font-mono text-[11px]">
            {meta.notesLexique.map((item, idx) => (
              <div key={idx}>
                <strong className="text-[#8b2a1a] dark:text-[#f4a261]">{item.mot}</strong> : {item.explication}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
