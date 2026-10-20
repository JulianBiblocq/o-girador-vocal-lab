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
    className="w-full text-left p-2 cordel-card-sm hover:border-[var(--cordel-accent)] transition-all flex items-center justify-between gap-3 cursor-pointer group rounded"
  >
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="font-bold text-xs truncate text-[var(--cordel-text)] group-hover:text-[var(--cordel-accent-text)]">
        {item.titre}
      </span>
      <div className="flex items-center gap-2 text-[10px] font-mono text-[var(--cordel-secondary-text)]">
        {item.nacao && <span className="text-[var(--cordel-accent-text)]">{item.nacao}</span>}
        {item.rythme && <span>• {item.rythme}</span>}
        {item.bpmDefaut && <span>• {item.bpmDefaut} BPM</span>}
      </div>
    </div>
    <ArrowRight className="w-4 h-4 text-[var(--cordel-secondary-text)] group-hover:text-[var(--cordel-accent-text)] group-hover:translate-x-0.5 transition-all shrink-0" />
  </button>
);
