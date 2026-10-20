/**
 * SoundCardItem.tsx
 * Carte sonore individuelle avec badge de match dans le chant (< 50 lignes).
 */
import React from 'react';
import type { PortugueseSoundCardDef, SoundCardId } from '../../data/portugueseSoundCards';
import { Volume2 } from 'lucide-react';

interface Props {
  card: PortugueseSoundCardDef;
  isSelected: boolean;
  matchCount: number;
  titleText: string;
  ruleText: string;
  onSelect: (id: SoundCardId) => void;
  onSpeak: (sample: string, e: React.MouseEvent) => void;
}

export const SoundCardItem: React.FC<Props> = ({
  card, isSelected, matchCount, titleText, ruleText, onSelect, onSpeak
}) => (
  <div
    onClick={() => onSelect(card.id)}
    className={`p-3 border-2 border-[#1a1a1a] shadow-[3px_3px_0px_#1a1a1a] cursor-pointer transition-transform ${
      isSelected ? 'bg-[#2a9d8f]/15 -translate-y-0.5' : 'bg-[#f5edd6] dark:bg-[#2b2722]'
    }`}
  >
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-xs text-[#8b2a1a] dark:text-[#f4a261]">{titleText}</span>
        {matchCount > 0 && (
          <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-[#2a9d8f] text-white border border-[#1a1a1a]">
            ×{matchCount}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => onSpeak(card.speechSample, e)}
        className="px-2 py-0.5 text-[10px] font-bold bg-[#1a1a1a] text-[#f4ecd8] flex items-center gap-1 cursor-pointer"
      >
        <Volume2 className="w-3 h-3" />
        <span>Écouter</span>
      </button>
    </div>
    <p className="text-[11px] leading-relaxed mb-2 opacity-90">{ruleText}</p>
    <div className="flex flex-wrap gap-1">
      {card.examples.map((ex) => (
        <span key={ex} className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[#fcfaf2] dark:bg-[#1f1d1a] border border-[#1a1a1a]/30">
          {ex}
        </span>
      ))}
    </div>
  </div>
);
