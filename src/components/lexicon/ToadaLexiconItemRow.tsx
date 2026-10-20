/**
 * ToadaLexiconItemRow.tsx
 * Ligne d'affichage bilingue permanent [ FR | PT-BR ] avec écoute TTS ralentie (< 110 lignes).
 */
import React, { useCallback } from 'react';
import type { ToadaLexiconEntry } from '../../types/toadaLexicon.types';
import { useLanguage } from '../../i18n/LanguageContext';
import { Volume2, Trash2 } from 'lucide-react';

interface Props {
  entry: ToadaLexiconEntry;
  onDelete?: (mot: string) => void;
  isReadOnly?: boolean;
}

export const ToadaLexiconItemRow: React.FC<Props> = ({ entry, onDelete, isReadOnly }) => {
  const { t } = useLanguage();

  const handleSpeak = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(entry.mot);
    utt.lang = 'pt-BR';
    utt.rate = 0.82;
    window.speechSynthesis.speak(utt);
  }, [entry.mot]);

  return (
    <div className="cordel-card-sm p-2.5 rounded text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border">
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-sm font-serif text-[#9a3412] dark:text-[#f4a261]">{entry.mot}</strong>
          {entry.categorie && (
            <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider bg-[var(--cordel-surface)] text-[var(--cordel-text)] border border-[var(--cordel-border-sub)] rounded">
              {entry.categorie}
            </span>
          )}
          {entry.soundCardId && (
            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[var(--cordel-coro)] text-[#f4ecd8] rounded">
              Carte: {entry.soundCardId}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] pt-1 border-t border-[var(--cordel-border-sub)]">
          <div>
            <span className="text-[var(--cordel-secondary-text)] font-semibold">FR : </span>
            <span className="italic text-[var(--cordel-text)]">{entry.traductionFr || entry.explication}</span>
          </div>
          {entry.phonetique && (
            <div>
              <span className="text-[var(--cordel-secondary-text)] font-semibold">Phonétique : </span>
              <span className="font-mono text-[#9a3412] dark:text-[#f4a261]">{entry.phonetique}</span>
            </div>
          )}
        </div>

        {entry.conseilDiction && (
          <p className="text-[10px] text-[var(--cordel-secondary-text)] pt-0.5">
            💡 {entry.conseilDiction}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
        <button
          type="button"
          onClick={handleSpeak}
          title={t('lexiconListenTermBtn')}
          className="cordel-btn p-1.5 rounded cursor-pointer flex items-center gap-1 text-[11px] font-bold"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Écouter</span>
        </button>

        {!isReadOnly && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(entry.mot)}
            title={t('lexiconDeleteTermTooltip')}
            className="cordel-btn p-1.5 rounded cursor-pointer text-[#9a3412] hover:bg-[#9a3412]/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
