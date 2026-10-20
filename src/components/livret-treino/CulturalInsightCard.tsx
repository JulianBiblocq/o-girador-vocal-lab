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
    <div className="cordel-card p-4 space-y-3">
      <div className="font-bold uppercase tracking-wider text-xs border-b border-[var(--cordel-border-sub)] pb-1.5 flex items-center justify-between text-[var(--cordel-text)]">
        <span>📜 {meta.titre || project.title || 'Toada'}</span>
        {meta.nacao && <span className="text-[10px] text-[var(--cordel-secondary-text)] font-normal">Nação : {meta.nacao}</span>}
      </div>

      {meta.traduction && (
        <div className="text-xs">
          <span className="font-bold block text-[11px] text-[var(--cordel-secondary-text)] mb-1">{t('culturalTraductionLabel')}</span>
          <p className="italic leading-relaxed cordel-card-sm p-2 rounded text-[var(--cordel-text)]">
            {meta.traduction}
          </p>
        </div>
      )}

      {meta.anecdote && (
        <div className="text-xs">
          <span className="font-bold block text-[11px] text-[var(--cordel-secondary-text)]">{t('culturalAnecdoteLabel')}</span>
          <p className="mt-0.5 leading-relaxed text-[var(--cordel-text)]">{meta.anecdote}</p>
        </div>
      )}

      {meta.notesLexique && meta.notesLexique.length > 0 && (
        <div className="text-xs">
          <div className="flex items-center justify-between pb-1">
            <span className="font-bold block text-[11px] text-[var(--cordel-secondary-text)]">{t('culturalLexiqueLabel')}</span>
            {onOpenLexicon && (
              <button
                type="button"
                onClick={onOpenLexicon}
                className="cordel-btn px-2 py-0.5 text-[10px] rounded flex items-center gap-1 cursor-pointer"
              >
                <BookOpen className="w-3 h-3" />
                <span>Enrichir</span>
              </button>
            )}
          </div>
          <div className="mt-0.5 space-y-1.5 cordel-card-sm p-2 rounded font-mono text-[11px]">
            {meta.notesLexique.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 border-b border-[var(--cordel-border-sub)] pb-1 last:border-0 last:pb-0">
                <div>
                  <strong className="text-[#9a3412] dark:text-[#f4a261]">{item.mot}</strong> : {item.traductionFr || item.explication}
                  {item.phonetique && <span className="text-[var(--cordel-secondary-text)] text-[10px] ml-1.5 font-sans">({item.phonetique})</span>}
                </div>
                <button
                  type="button"
                  onClick={(e) => handleSpeak(item.mot, e)}
                  title="Écouter la prononciation"
                  className="cordel-btn p-1 rounded shrink-0"
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
