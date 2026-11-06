/**
 * SlicerSegmentRow.tsx
 * Ligne de contrôle d'une tranche ou Pause Batuque : Drag & Drop, ▲/▼, -1M/+1M, 1M..4M et cible (< 140 lignes).
 */
import React from 'react';
import type { VocalPatternItem } from '../../types/toadaProject.types';
import type { SliceSegment } from '../../types/slicerSegments.types';
import { Play, Square, Scissors, Link2, Trash2, AlertTriangle, VolumeX, Plus } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface SlicerSegmentRowProps {
  segment: SliceSegment; index: number; totalSegments?: number; patterns: VocalPatternItem[];
  isPlaying: boolean; isSelected: boolean; isDuplicateTarget: boolean; canMergeNext?: boolean;
  onSelect: () => void; onPlay: () => void; onUpdate: (partial: Partial<SliceSegment>) => void;
  onUpdatePauseMeasures?: (measures: 1 | 2 | 3 | 4) => void; onShiftMeasures?: (deltaMeasures: number) => void;
  onMoveSegment?: (fromIndex: number, toIndex: number) => void;
  onInsertPauseBefore?: () => void; onInsertSliceAfter?: () => void;
  onSplit: () => void; onMergeNext?: () => void; onDelete: () => void;
}

export const SlicerSegmentRow: React.FC<SlicerSegmentRowProps> = ({
  segment, index, totalSegments = 1, patterns, isPlaying, isSelected, isDuplicateTarget, canMergeNext = false,
  onSelect, onPlay, onUpdate, onUpdatePauseMeasures, onShiftMeasures, onMoveSegment,
  onInsertPauseBefore, onInsertSliceAfter, onSplit, onMergeNext, onDelete,
}) => {
  const { t } = useLanguage();
  const dur = (segment.endSec - segment.startSec).toFixed(1);
  const curMeasures = segment.measuresCount ?? (segment.isPause ? 1 : 2);
  const hasAna = segment.hasAnacrusis !== false;
  const hasTail = segment.hasTailBeat !== false;

  const handleMeasureClick = (m: 1 | 2 | 3 | 4) => {
    if (segment.isPause && onUpdatePauseMeasures) onUpdatePauseMeasures(m);
    else onUpdate({ measuresCount: m });
  };

  return (
    <div
      draggable={Boolean(onMoveSegment)}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(index))}
      onDragOver={(e) => { if (onMoveSegment) e.preventDefault(); }}
      onDrop={(e) => {
        e.preventDefault();
        const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (!Number.isNaN(from) && from !== index && onMoveSegment) onMoveSegment(from, index);
      }}
      onClick={onSelect}
      className={`flex flex-wrap items-center justify-between gap-1.5 p-1.5 border rounded cursor-pointer transition-all ${
        segment.isPause
          ? isSelected ? 'border-stone-400 bg-stone-500/20 border-dashed' : 'border-stone-500/40 bg-stone-500/10 border-dashed'
          : isSelected ? 'border-amber-500 bg-amber-500/10' : 'border-[var(--cordel-border-sub)] bg-[var(--cordel-subcard-bg)]'
      }`}
    >
      <div className="flex items-center gap-1 min-w-0 shrink-0" onClick={(e) => e.stopPropagation()}>
        <span className="cursor-grab text-[11px] opacity-60 hover:opacity-100 px-0.5 select-none" title="⠿">⠿</span>
        {onMoveSegment && (
          <div className="flex items-center gap-0.5">
            <button type="button" disabled={index === 0} onClick={() => onMoveSegment(index, index - 1)}
              className="px-1 py-0.5 text-[9px] font-bold cordel-card-sm rounded disabled:opacity-25 cursor-pointer" title={t('slicerMoveUpTitle')}>▲</button>
            <button type="button" disabled={index >= totalSegments - 1} onClick={() => onMoveSegment(index, index + 1)}
              className="px-1 py-0.5 text-[9px] font-bold cordel-card-sm rounded disabled:opacity-25 cursor-pointer" title={t('slicerMoveDownTitle')}>▼</button>
          </div>
        )}
        {!segment.isPause && (
          <button type="button" onClick={onPlay} className="p-1 cordel-btn rounded shrink-0 cursor-pointer" title={t('slicerListenSliceTitle')}>
            {isPlaying ? <Square className="w-3.5 h-3.5 fill-current text-amber-500" /> : <Play className="w-3.5 h-3.5 fill-current text-theme-accent" />}
          </button>
        )}
        <span className="font-bold text-[11px] text-theme-ink shrink-0" onClick={onSelect}>
          #{index + 1} {segment.isPause ? t('slicerPauseRowBadge', { m: curMeasures }) : `(${dur}s)`}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        {onShiftMeasures && (
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => onShiftMeasures(-1)} className="px-1.5 py-0.5 text-[9.5px] font-bold cordel-card-sm hover:bg-amber-500/20 rounded cursor-pointer" title={t('slicerShiftMinus1MTitle')}>‹ -1M</button>
            <button type="button" onClick={() => onShiftMeasures(1)} className="px-1.5 py-0.5 text-[9.5px] font-bold cordel-card-sm hover:bg-amber-500/20 rounded cursor-pointer" title={t('slicerShiftPlus1MTitle')}>+1M ›</button>
          </div>
        )}

        <div className="flex items-center p-0.5 cordel-card-sm rounded">
          {([1, 2, 3, 4] as const).map((m) => (
            <button key={m} type="button" onClick={() => handleMeasureClick(m)}
              className={`px-1.5 py-0.5 text-[9px] font-bold rounded cursor-pointer transition-colors ${curMeasures === m ? 'bg-theme-wood text-[#f4ecd8] font-black' : 'opacity-60 hover:opacity-100'}`}>
              {m}M
            </button>
          ))}
        </div>

        {!segment.isPause && (
          <>
            <button type="button" onClick={() => onUpdate({ hasAnacrusis: !hasAna })}
              className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded cursor-pointer transition-colors ${hasAna ? 'bg-amber-600 text-white shadow-xs' : 'cordel-card-sm opacity-50'}`} title={t('slicerToggleAnaTitle')}>+Ana</button>
            <button type="button" onClick={() => onUpdate({ hasTailBeat: !hasTail })}
              className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded cursor-pointer transition-colors ${hasTail ? 'bg-emerald-700 text-white shadow-xs' : 'cordel-card-sm opacity-50'}`} title={t('slicerToggleTailTitle')}>+1T</button>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 flex-1 justify-end min-w-[210px]" onClick={(e) => e.stopPropagation()}>
        {segment.isPause ? (
          <span className="text-[10.5px] font-bold text-[var(--cordel-secondary-text)] italic mr-auto pl-1">{t('slicerPauseRowHint')}</span>
        ) : (
          <>
            {isDuplicateTarget && (
              <span className="px-1.5 py-0.5 text-[9px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/50 rounded flex items-center gap-1 shrink-0 animate-pulse">
                <AlertTriangle className="w-3 h-3 shrink-0" /><span>{t('slicerDuplicateTargetAlert')}</span>
              </span>
            )}
            <select value={segment.targetPatternId} onChange={(e) => onUpdate({ targetPatternId: e.target.value })}
              className={`bg-[var(--cordel-surface)] border text-[11px] font-mono font-bold text-theme-ink px-1.5 py-0.5 rounded cursor-pointer max-w-[185px] truncate outline-none ${isDuplicateTarget ? 'border-amber-500 ring-1 ring-amber-500' : 'border-[var(--cordel-border-panel)]'}`}>
              <option value="ignore">{t('slicerOptionIgnore')}</option>
              <option value="new">{t('slicerOptionNewPattern')}</option>
              <optgroup label={t('slicerExistingPatternsGroup')}>
                {patterns.map((p, pIdx) => (
                  <option key={p.id} value={p.id}>{pIdx + 1}. [{p.role === 'puxador' ? 'PUX' : 'COR'}] {p.name} ({p.measuresCount}M)</option>
                ))}
              </optgroup>
            </select>
          </>
        )}

        {onInsertPauseBefore && (
          <button type="button" onClick={onInsertPauseBefore} className="p-1 cordel-card-sm text-[var(--cordel-secondary-text)] hover:text-amber-500 rounded cursor-pointer" title={t('slicerInsertPauseBeforeTitle')}><VolumeX className="w-3.5 h-3.5" /></button>
        )}
        {onInsertSliceAfter && (
          <button type="button" onClick={onInsertSliceAfter} className="p-1 cordel-card-sm text-[var(--cordel-secondary-text)] hover:text-emerald-500 rounded cursor-pointer" title={t('slicerInsertSliceAfterTitle')}><Plus className="w-3.5 h-3.5" /></button>
        )}
        {!segment.isPause && (
          <button type="button" onClick={onSplit} className="p-1 cordel-card-sm text-[var(--cordel-secondary-text)] hover:text-amber-500 rounded cursor-pointer" title={t('slicerSplitSliceTitle')}><Scissors className="w-3.5 h-3.5" /></button>
        )}
        {!segment.isPause && canMergeNext && onMergeNext && (
          <button type="button" onClick={onMergeNext} className="p-1 cordel-card-sm text-[var(--cordel-secondary-text)] hover:text-emerald-500 rounded cursor-pointer" title={t('slicerMergeSliceTitle')}><Link2 className="w-3.5 h-3.5" /></button>
        )}
        <button type="button" onClick={onDelete} className="p-1 cordel-card-sm text-[var(--cordel-secondary-text)] hover:text-red-500 rounded cursor-pointer" title={t('slicerDeleteSliceTitle')}><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
};
