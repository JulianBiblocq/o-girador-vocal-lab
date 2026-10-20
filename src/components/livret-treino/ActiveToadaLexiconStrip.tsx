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
    <div className="cordel-card p-3 text-xs font-mono space-y-2">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--cordel-border-sub)] pb-1.5">
        <span className="font-bold text-[11px] uppercase tracking-wider text-[#9a3412] dark:text-[#f4a261] flex items-center gap-1.5">
          ⭐ Vocabulaire & Diction du Chant ({entries.length})
        </span>
        <button
          type="button"
          onClick={onOpenLexiconModal}
          className="cordel-btn px-2 py-0.5 text-[10px] rounded flex items-center gap-1 cursor-pointer"
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
              className={`cordel-card-sm p-1.5 rounded flex items-center gap-2 transition-transform cursor-pointer select-none border ${
                isSelected
                  ? 'border-[var(--cordel-coro)] bg-[var(--cordel-coro)]/15 -translate-y-0.5 shadow-sm'
                  : 'hover:border-[var(--cordel-accent)]'
              }`}
            >
              <div className="leading-tight">
                <span className="font-bold font-serif text-[11px] block text-[var(--cordel-text)]">{item.mot}</span>
                <span className="text-[9px] text-[var(--cordel-secondary-text)] block truncate max-w-[120px]">
                  {item.phonetique || item.traductionFr || item.explication}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => handleSpeak(item.mot, e)}
                title="Écouter le mot"
                className="cordel-btn p-1 rounded shrink-0"
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
