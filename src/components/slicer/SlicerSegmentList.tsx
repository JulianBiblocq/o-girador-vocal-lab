/**
 * SlicerSegmentList.tsx
 * Liste des tranches avec pré-assignation rapide et détection des doublons (< 90 lignes).
 */
import React, { useMemo } from 'react';
import type { VocalPatternItem } from '../../types/toadaProject.types';
import type { SliceSegment, PreAssignMode } from '../../types/slicerSegments.types';
import { SlicerSegmentRow } from './SlicerSegmentRow';
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

  const duplicateTargetIds = useMemo(() => {
    const counts = new Map<string, number>();
    segments.forEach((s) => {
      if (s.targetPatternId !== 'ignore' && s.targetPatternId !== 'new') {
        counts.set(s.targetPatternId, (counts.get(s.targetPatternId) || 0) + 1);
      }
    });
    const dupes = new Set<string>();
    counts.forEach((cnt, id) => { if (cnt > 1) dupes.add(id); });
    return dupes;
  }, [segments]);

  const handleUpdateSegment = (segId: string, partial: Partial<SliceSegment>) => {
    onSegmentsChange(segments.map((s) => (s.id === segId ? { ...s, ...partial } : s)));
  };

  return (
    <div className="flex flex-col gap-2 p-2.5 cordel-card rounded text-xs font-mono">
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

      <div className="max-h-56 overflow-y-auto flex flex-col gap-1.5 pr-1 cordel-scrollbar">
        {segments.length === 0 ? (
          <div className="text-center py-6 text-[var(--cordel-secondary-text)] italic">
            {t('slicerNoSegmentsNotice')}
          </div>
        ) : (
          segments.map((seg, idx) => (
            <SlicerSegmentRow
              key={seg.id} segment={seg} index={idx} patterns={patterns}
              isPlaying={playingSegmentId === seg.id} isSelected={selectedSegmentId === seg.id}
              isDuplicateTarget={duplicateTargetIds.has(seg.targetPatternId)}
              onSelect={() => onSelectSegment(seg.id)} onPlay={() => onPlaySegment(seg)}
              onUpdate={(partial) => handleUpdateSegment(seg.id, partial)}
              onSplit={() => onSplitSegment(seg.id)} onDelete={() => onDeleteSegment(seg.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};
