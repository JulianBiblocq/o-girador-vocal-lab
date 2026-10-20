/**
 * ActiveToadaLexiconStrip.tsx
 * Bandeau interactif du vocabulaire de la Toada active avec écoute et liaison aux cartes sonores (< 110 lignes).
 */
import React, { useCallback } from 'react';
import type { ToadaLexiconEntry } from '../../types/toadaLexicon.types';
import type { SoundCardId } from '../../data/portugueseSoundCards';
import { Volume2, BookOpen } from 'lucide-react';

interface Props {
  entries: ToadaLexiconEntry[];
  activeCardId: SoundCardId | null;
  onSelectCard: (cardId: SoundCardId | null) => void;
  onOpenLexiconModal: () => void;
}

export const ActiveToadaLexiconStrip: React.FC<Props> = ({
  entries,
  activeCardId,
  onSelectCard,
  onOpenLexiconModal,
}) => {
  const handleSpeak = useCallback((mot: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(mot);
    utt.lang = 'pt-BR';
    utt.rate = 0.82;
    window.speechSynthesis.speak(utt);
  }, []);

  if (entries.length === 0) return null;

  return (
    <div className="p-3 bg-[#f5edd6] dark:bg-[#2b2722] border-2 border-[#1a1a1a] shadow-[3px_3px_0px_#1a1a1a] text-xs font-mono space-y-2">
      <div className="flex items-center justify-between gap-2 border-b border-[#1a1a1a]/20 pb-1.5">
        <span className="font-bold text-[11px] uppercase tracking-wider text-[#8b2a1a] dark:text-[#f4a261] flex items-center gap-1.5">
          ⭐ Vocabulaire & Diction du Chant ({entries.length})
        </span>
        <button
          type="button"
          onClick={onOpenLexiconModal}
          className="px-2 py-0.5 text-[10px] font-bold bg-[#1a1a1a] text-[#f4ecd8] flex items-center gap-1 cursor-pointer hover:opacity-90"
        >
          <BookOpen className="w-3 h-3" />
          <span>Fiche & Quiz</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {entries.map((item, idx) => {
          const isSelected = item.soundCardId && activeCardId === item.soundCardId;
          return (
            <div
              key={`${item.mot}_${idx}`}
              onClick={() => item.soundCardId && onSelectCard(isSelected ? null : item.soundCardId)}
              className={`p-1.5 border border-[#1a1a1a] flex items-center gap-2 transition-transform cursor-pointer select-none ${
                isSelected
                  ? 'bg-[#2a9d8f] text-white shadow-[2px_2px_0px_#000] -translate-y-0.5'
                  : 'bg-[#fcfaf2] dark:bg-[#1f1d1a] shadow-[1px_1px_0px_#1a1a1a]'
              }`}
            >
              <div className="leading-tight">
                <span className="font-bold font-serif text-[11px] block">{item.mot}</span>
                <span className="text-[9px] opacity-75 block truncate max-w-[120px]">
                  {item.phonetique || item.traductionFr || item.explication}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => handleSpeak(item.mot, e)}
                title="Écouter le mot"
                className="p-1 bg-[#1a1a1a] text-white rounded-none hover:bg-stone-800 shrink-0"
              >
                <Volume2 className="w-2.5 h-2.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
