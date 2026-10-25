/**
 * PatternInjectionBar.tsx
 * Barre d'injection directe Puxador -> Coro existant (< 85 lignes).
 * Pré-sélectionne le Coro correspondant au 1er mot du Puxador actif.
 */
import React, { useState, useEffect } from 'react';
import type { VocalPatternItem } from '../../types/toadaProject.types';
import { ArrowLeftRight, Sparkles, Plus } from 'lucide-react';

interface PatternInjectionBarProps {
  sourcePattern: VocalPatternItem | null;
  coroPatterns: VocalPatternItem[];
  onInject: (sourceId: string, targetId: string) => void;
  onCreateMirror: (sourceId: string) => void;
}

export const PatternInjectionBar: React.FC<PatternInjectionBarProps> = ({
  sourcePattern, coroPatterns, onInject, onCreateMirror,
}) => {
  const [selectedCoroId, setSelectedCoroId] = useState<string>('');

  useEffect(() => {
    if (!sourcePattern || coroPatterns.length === 0) { setSelectedCoroId(''); return; }
    const firstWord = (sourcePattern.name || '').trim().split(/\s+/)[0]?.toLowerCase();
    const match = coroPatterns.find((c) => (c.name || '').trim().split(/\s+/)[0]?.toLowerCase() === firstWord);
    setSelectedCoroId(match?.id ?? coroPatterns[0].id);
  }, [sourcePattern?.id, sourcePattern?.name, coroPatterns]);

  if (!sourcePattern) return null;
  const hasAudio = sourcePattern.recordingResult !== null && sourcePattern.recordingResult.pcm.length > 0;
  const targetCoro = coroPatterns.find((c) => c.id === selectedCoroId) ?? coroPatterns[0];

  return (
    <div className="flex flex-wrap items-center justify-between gap-1.5 px-2 py-1 bg-amber-950/20 border border-amber-600/30 rounded text-[10px] font-mono">
      <div className="flex items-center gap-1.5 min-w-0">
        <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
        <span className="text-[var(--cordel-secondary-text)] truncate">
          Source : <strong className="text-amber-300 font-bold">{sourcePattern.name}</strong>
        </span>
      </div>

      {coroPatterns.length > 0 && targetCoro ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--cordel-secondary-text)]">Vers :</span>
          <select
            value={selectedCoroId}
            onChange={(e) => setSelectedCoroId(e.target.value)}
            className="bg-[var(--cordel-surface)] border border-[var(--cordel-border-sub)] text-[var(--cordel-text)] px-1 py-0.5 rounded text-[10px] focus:outline-none"
          >
            {coroPatterns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!hasAudio}
            onClick={() => onInject(sourcePattern.id, targetCoro.id)}
            title={hasAudio ? `Injecter vers ${targetCoro.name}` : "Enregistrez d'abord une prise pour ce Puxador"}
            className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 cursor-pointer transition-all ${
              hasAudio
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm'
                : 'bg-white/5 text-stone-500 border border-white/10 cursor-not-allowed opacity-60'
            }`}
          >
            <ArrowLeftRight className="w-3 h-3" />
            <span>Injecter vers Coro</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onCreateMirror(sourcePattern.id)}
          className="px-2 py-0.5 rounded font-bold bg-amber-700 hover:bg-amber-600 text-white flex items-center gap-1 cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>Créer Coro miroir</span>
        </button>
      )}
    </div>
  );
};
