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
    <div className="p-2.5 bg-[#f5edd6] dark:bg-[#2b2722] border border-[#1a1a1a]/25 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="text-sm font-serif text-[#8b2a1a] dark:text-[#f4a261]">{entry.mot}</strong>
          {entry.categorie && (
            <span className="px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider bg-[#1a1a1a] text-[#f4ecd8]">
              {entry.categorie}
            </span>
          )}
          {entry.soundCardId && (
            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-[#2a9d8f] text-white border border-[#1a1a1a]">
              Carte: {entry.soundCardId}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] pt-1 border-t border-[#1a1a1a]/10 dark:border-white/10">
          <div>
            <span className="opacity-70 font-semibold">FR : </span>
            <span className="italic">{entry.traductionFr || entry.explication}</span>
          </div>
          {entry.phonetique && (
            <div>
              <span className="opacity-70 font-semibold">Phonétique : </span>
              <span className="font-mono text-[#8b2a1a] dark:text-[#f4a261]">{entry.phonetique}</span>
            </div>
          )}
        </div>

        {entry.conseilDiction && (
          <p className="text-[10px] opacity-80 pt-0.5">
            💡 {entry.conseilDiction}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
        <button
          type="button"
          onClick={handleSpeak}
          title={t('lexiconListenTermBtn')}
          className="p-1.5 bg-[#1a1a1a] text-[#f4ecd8] border border-[#1a1a1a] shadow-[2px_2px_0px_#000] cursor-pointer hover:opacity-90 flex items-center gap-1 text-[11px] font-bold"
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Écouter</span>
        </button>

        {!isReadOnly && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(entry.mot)}
            title={t('lexiconDeleteTermTooltip')}
            className="p-1.5 bg-red-800 text-white border border-[#1a1a1a] shadow-[2px_2px_0px_#000] cursor-pointer hover:bg-red-700"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
