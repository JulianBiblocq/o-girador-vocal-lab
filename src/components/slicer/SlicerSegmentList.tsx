/**
 * SlicerSegmentList.tsx
 * Liste des cartes de tranches avec pré-assignation rapide et sélecteur de blocs (< 145 lignes).
 */
import React from 'react';
import type { VocalPatternItem } from '../../types/toadaProject.types';
import type { SliceSegment, PreAssignMode } from '../../types/slicerSegments.types';
import { Play, Square, Scissors, Trash2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface SlicerSegmentListProps {
  segments: SliceSegment[];
  patterns: VocalPatternItem[];
  playingSegmentId: string | null;
  selectedSegmentId: string | null;
  onSegmentsChange: (segments: SliceSegment[]) => void;
  onSelectSegment: (id: string | null) => void;
  onPlaySegment: (seg: SliceSegment) => void;
  onSplitSegment: (segId: string) => void;
  onDeleteSegment: (segId: string) => void;
  onPreAssign: (mode: PreAssignMode) => void;
}

export const SlicerSegmentList: React.FC<SlicerSegmentListProps> = ({
  segments, patterns, playingSegmentId, selectedSegmentId,
  onSegmentsChange, onSelectSegment, onPlaySegment, onSplitSegment, onDeleteSegment, onPreAssign,
}) => {
  const { t } = useLanguage();

  const handleTargetChange = (segId: string, targetId: string) => {
    onSegmentsChange(segments.map((s) => (s.id === segId ? { ...s, targetPatternId: targetId } : s)));
  };

  return (
    <div className="flex flex-col gap-2 p-2.5 cordel-card rounded text-xs font-mono">
      {/* Barre de pré-assignation rapide */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 border-b border-[var(--cordel-border-sub)]">
        <span className="font-bold text-[11px] text-[var(--cordel-secondary-text)] uppercase tracking-wider">
          {t('slicerAssignTitle')}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button" onClick={() => onPreAssign('puxador')}
            className="px-2 py-0.5 cordel-card-sm text-[10px] font-bold text-role-puxador hover:bg-role-puxador/15 cursor-pointer rounded"
          >
            {t('slicerPreAssignPuxador')}
          </button>
          <button
            type="button" onClick={() => onPreAssign('coro')}
            className="px-2 py-0.5 cordel-card-sm text-[10px] font-bold text-role-coro hover:bg-role-coro/15 cursor-pointer rounded"
          >
            {t('slicerPreAssignCoro')}
          </button>
          <button
            type="button" onClick={() => onPreAssign('all')}
            className="px-2 py-0.5 cordel-card-sm text-[10px] font-bold text-amber-500 hover:bg-amber-500/15 cursor-pointer rounded"
          >
            {t('slicerPreAssignAll')}
          </button>
        </div>
      </div>

      {/* Cartes déroulantes de chaque tranche */}
      <div className="max-h-52 overflow-y-auto flex flex-col gap-1.5 pr-1 cordel-scrollbar">
        {segments.length === 0 ? (
          <div className="text-center py-6 text-[var(--cordel-secondary-text)] italic">
            {t('slicerNoSegmentsNotice')}
          </div>
        ) : (
          segments.map((seg, idx) => {
            const isPlaying = playingSegmentId === seg.id;
            const isSelected = selectedSegmentId === seg.id;
            const dur = (seg.endSec - seg.startSec).toFixed(1);

            return (
              <div
                key={seg.id}
                onClick={() => onSelectSegment(seg.id)}
                className={`flex flex-wrap items-center justify-between gap-2 p-1.5 border rounded cursor-pointer transition-all ${
                  isSelected ? 'border-amber-500 bg-amber-500/10' : 'border-[var(--cordel-border-sub)] bg-[var(--cordel-subcard-bg)]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onPlaySegment(seg); }}
                    className="p-1 cordel-btn rounded shrink-0 cursor-pointer"
                    title="Écouter la tranche"
                  >
                    {isPlaying ? <Square className="w-3.5 h-3.5 fill-current text-amber-500" /> : <Play className="w-3.5 h-3.5 fill-current text-theme-accent" />}
                  </button>
                  <span className="font-bold text-[11px] text-theme-ink shrink-0">
                    #{idx + 1} ({dur}s)
                  </span>
                  <span className="text-[10px] text-[var(--cordel-secondary-text)] shrink-0 hidden sm:inline">
                    [{seg.startSec.toFixed(2)}s ── {seg.endSec.toFixed(2)}s]
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-1 justify-end min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[10px] text-theme-ink/70 shrink-0">{t('slicerAssignToLabel')} :</span>
                  <select
                    value={seg.targetPatternId}
                    onChange={(e) => handleTargetChange(seg.id, e.target.value)}
                    className="bg-[var(--cordel-surface)] border border-[var(--cordel-border-panel)] text-[11px] font-mono font-bold text-theme-ink px-1.5 py-0.5 rounded cursor-pointer max-w-[210px] truncate outline-none"
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
                    type="button" onClick={() => onSplitSegment(seg.id)}
                    className="p-1 cordel-card-sm text-[var(--cordel-secondary-text)] hover:text-amber-500 rounded cursor-pointer"
                    title="Scinder cette tranche en deux"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button" onClick={() => onDeleteSegment(seg.id)}
                    className="p-1 cordel-card-sm text-[var(--cordel-secondary-text)] hover:text-red-500 rounded cursor-pointer"
                    title="Supprimer cette tranche"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
