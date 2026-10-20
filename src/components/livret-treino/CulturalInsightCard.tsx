/**
 * CulturalInsightCard.tsx
 * Carte culturelle Cordel affichant la traduction, l'anecdote et le lexique bilingue de la Toada (< 85 lignes).
 */
import React, { useCallback } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { BookOpen, Volume2 } from 'lucide-react';

interface Props {
  onOpenLexicon?: () => void;
}

export const CulturalInsightCard: React.FC<Props> = ({ onOpenLexicon }) => {
  const { t } = useLanguage();
  const { project } = useToadaProject();
  const meta = project.toadaMeta;

  const handleSpeak = useCallback((mot: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(mot);
    utt.lang = 'pt-BR';
    utt.rate = 0.82;
    window.speechSynthesis.speak(utt);
  }, []);

  if (!meta) return null;
  const hasContent = Boolean(meta.traduction || meta.anecdote || (meta.notesLexique && meta.notesLexique.length > 0));
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
          <div className="flex items-center justify-between pb-1">
            <span className="font-bold block text-[11px] opacity-80">{t('culturalLexiqueLabel')}</span>
            {onOpenLexicon && (
              <button
                type="button"
                onClick={onOpenLexicon}
                className="px-2 py-0.5 text-[10px] font-bold bg-[#1a1a1a] text-[#f4ecd8] flex items-center gap-1 cursor-pointer hover:opacity-90"
              >
                <BookOpen className="w-3 h-3" />
                <span>Enrichir</span>
              </button>
            )}
          </div>
          <div className="mt-0.5 space-y-1.5 bg-[#f0ebd9] dark:bg-[#26231e] p-2 border border-[#1a1a1a]/15 font-mono text-[11px]">
            {meta.notesLexique.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 border-b border-[#1a1a1a]/10 dark:border-white/10 pb-1 last:border-0 last:pb-0">
                <div>
                  <strong className="text-[#8b2a1a] dark:text-[#f4a261]">{item.mot}</strong> : {item.traductionFr || item.explication}
                  {item.phonetique && <span className="opacity-70 text-[10px] ml-1.5 font-sans">({item.phonetique})</span>}
                </div>
                <button
                  type="button"
                  onClick={(e) => handleSpeak(item.mot, e)}
                  title="Écouter la prononciation"
                  className="p-1 bg-[#1a1a1a] text-white hover:bg-stone-800 shrink-0"
                >
                  <Volume2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
