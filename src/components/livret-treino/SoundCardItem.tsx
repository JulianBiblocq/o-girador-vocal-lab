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
    className={`cordel-card-sm p-3 rounded cursor-pointer transition-all border ${
      isSelected
        ? 'border-[var(--cordel-coro)] bg-[var(--cordel-coro)]/10 -translate-y-0.5 shadow-sm'
        : 'hover:border-[var(--cordel-accent)]'
    }`}
  >
    <div className="flex items-center justify-between gap-2 mb-1.5">
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-xs text-[#9a3412] dark:text-[#f4a261]">{titleText}</span>
        {matchCount > 0 && (
          <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-[var(--cordel-coro)] text-[#f4ecd8] rounded">
            ×{matchCount}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => onSpeak(card.speechSample, e)}
        className="cordel-btn px-2 py-0.5 text-[10px] rounded flex items-center gap-1 cursor-pointer"
      >
        <Volume2 className="w-3 h-3" />
        <span>Écouter</span>
      </button>
    </div>
    <p className="text-[11px] leading-relaxed mb-2 text-[var(--cordel-secondary-text)]">{ruleText}</p>
    <div className="flex flex-wrap gap-1">
      {card.examples.map((ex) => (
        <span key={ex} className="px-1.5 py-0.5 text-[10px] font-mono font-bold bg-[var(--cordel-surface)] text-[var(--cordel-text)] border border-[var(--cordel-border-sub)] rounded">
          {ex}
        </span>
      ))}
    </div>
  </div>
);
