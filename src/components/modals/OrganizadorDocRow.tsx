/**
 * OrganizadorDocRow.tsx
 * Ligne d'affichage d'une fiche chant Organizador (< 40 lignes).
 */
import React from 'react';
import type { ToadaDocument } from '../../services/firebaseClient';
import { ArrowRight } from 'lucide-react';

interface OrganizadorDocRowProps {
  item: ToadaDocument;
  onSelect: (item: ToadaDocument) => void;
}

export const OrganizadorDocRow: React.FC<OrganizadorDocRowProps> = ({ item, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(item)}
    className="w-full text-left p-2 border border-stone-800 bg-stone-900/40 hover:bg-theme-wood/20 hover:border-theme-wood transition-all flex items-center justify-between gap-3 cursor-pointer group rounded-none"
  >
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="font-bold text-xs truncate group-hover:text-amber-400 text-stone-200">
        {item.titre}
      </span>
      <div className="flex items-center gap-2 text-[10px] font-mono text-stone-400">
        {item.nacao && <span className="text-amber-300/80">{item.nacao}</span>}
        {item.rythme && <span>• {item.rythme}</span>}
        {item.bpmDefaut && <span>• {item.bpmDefaut} BPM</span>}
      </div>
    </div>
    <ArrowRight className="w-4 h-4 text-stone-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all shrink-0" />
  </button>
);
