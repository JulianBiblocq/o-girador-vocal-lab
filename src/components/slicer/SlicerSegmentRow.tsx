/**
 * SlicerSegmentRow.tsx
 * Ligne de contrôle d'une tranche : Mesures (1M..4M), Anacrouse, Chute 1T et cible (< 140 lignes).
 */
import React from 'react';
import type { VocalPatternItem } from '../../types/toadaProject.types';
import type { SliceSegment } from '../../types/slicerSegments.types';
import { Play, Square, Scissors, Trash2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface SlicerSegmentRowProps {
  segment: SliceSegment;
  index: number;
  patterns: VocalPatternItem[];
  isPlaying: boolean;
  isSelected: boolean;
  isDuplicateTarget: boolean;
  onSelect: () => void;
  onPlay: () => void;
  onUpdate: (partial: Partial<SliceSegment>) => void;
  onSplit: () => void;
  onDelete: () => void;
}

export const SlicerSegmentRow: React.FC<SlicerSegmentRowProps> = ({
  segment, index, patterns, isPlaying, isSelected, isDuplicateTarget,
  onSelect, onPlay, onUpdate, onSplit, onDelete,
}) => {
  const { t } = useLanguage();
  const dur = (segment.endSec - segment.startSec).toFixed(1);
  const curMeasures = segment.measuresCount ?? 2;
  const hasAna = segment.hasAnacrusis !== false;
  const hasTail = segment.hasTailBeat !== false;

  return (
    <div
      onClick={onSelect}
      className={`flex flex-wrap items-center justify-between gap-2 p-1.5 border rounded cursor-pointer transition-all ${
        isSelected ? 'border-amber-500 bg-amber-500/10' : 'border-[var(--cordel-border-sub)] bg-[var(--cordel-subcard-bg)]'
      }`}
    >
      {/* 1. Play & Durée */}
      <div className="flex items-center gap-1.5 min-w-0 shrink-0">
        <button
          type="button" onClick={(e) => { e.stopPropagation(); onPlay(); }}
          className="p-1 cordel-btn rounded shrink-0 cursor-pointer" title="Écouter la tranche"
        >
          {isPlaying ? <Square className="w-3.5 h-3.5 fill-current text-amber-500" /> : <Play className="w-3.5 h-3.5 fill-current text-theme-accent" />}
        </button>
        <span className="font-bold text-[11px] text-theme-ink shrink-0">#{index + 1} ({dur}s)</span>
      </div>

      {/* 2. Contrôle Mesures 1M..4M, Anacrouse (+Ana) & Chute 1er Temps (+1T) */}
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center p-0.5 cordel-card-sm rounded">
          {([1, 2, 3, 4] as const).map((m) => (
            <button
              key={m} type="button" onClick={() => onUpdate({ measuresCount: m })}
              className={`px-1.5 py-0.5 text-[9px] font-bold rounded cursor-pointer transition-colors ${
                curMeasures === m ? 'bg-theme-wood text-[#f4ecd8] font-black' : 'opacity-60 hover:opacity-100'
              }`}
            >
              {m}M
            </button>
          ))}
        </div>

        <button
          type="button" onClick={() => onUpdate({ hasAnacrusis: !hasAna })}
          className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded cursor-pointer transition-colors ${
            hasAna ? 'bg-amber-600 text-white shadow-xs' : 'cordel-card-sm opacity-50'
          }`}
          title="Activer/Désactiver l'anacrouse (+Ana)"
        >
          +Ana
        </button>

        <button
          type="button" onClick={() => onUpdate({ hasTailBeat: !hasTail })}
          className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded cursor-pointer transition-colors ${
            hasTail ? 'bg-emerald-700 text-white shadow-xs' : 'cordel-card-sm opacity-50'
          }`}
          title="Chute sur le 1er temps suivant (+1T)"
        >
          +1T
        </button>
      </div>

      {/* 3. Sélecteur de Cible & Alerte Doublon */}
      <div className="flex items-center gap-1.5 flex-1 justify-end min-w-[220px]" onClick={(e) => e.stopPropagation()}>
        {isDuplicateTarget && (
          <span className="px-1.5 py-0.5 text-[9px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/50 rounded flex items-center gap-1 shrink-0 animate-pulse">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span>{t('slicerDuplicateTargetAlert')}</span>
          </span>
        )}

        <select
          value={segment.targetPatternId}
          onChange={(e) => onUpdate({ targetPatternId: e.target.value })}
          className={`bg-[var(--cordel-surface)] border text-[11px] font-mono font-bold text-theme-ink px-1.5 py-0.5 rounded cursor-pointer max-w-[200px] truncate outline-none ${
            isDuplicateTarget ? 'border-amber-500 ring-1 ring-amber-500' : 'border-[var(--cordel-border-panel)]'
          }`}
        >
          <option value="ignore">{t('slicerOptionIgnore')}</option>
          <option value="new">{t('slicerOptionNewPattern')}</option>
          <optgroup label={t('slicerExistingPatternsGroup')}>
            {patterns.map((p, pIdx) => (
              <option key={p.id} value={p.id}>
                {pIdx + 1}. [{p.role === 'puxador' ? 'PUX' : 'COR'}] {p.name} ({p.measuresCount}M)
              </option>
            ))}
          </optgroup>
        </select>

        <button
          type="button" onClick={onSplit} className="p-1 cordel-card-sm text-[var(--cordel-secondary-text)] hover:text-amber-500 rounded cursor-pointer"
          title="Scinder cette tranche en deux"
        >
          <Scissors className="w-3.5 h-3.5" />
        </button>
        <button
          type="button" onClick={onDelete} className="p-1 cordel-card-sm text-[var(--cordel-secondary-text)] hover:text-red-500 rounded cursor-pointer"
          title="Supprimer cette tranche"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
