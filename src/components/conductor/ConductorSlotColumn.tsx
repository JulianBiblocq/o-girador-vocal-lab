/**
 * ConductorSlotColumn.tsx
 * Colonne de slot de la Frise Conducteur (rails Puxador / Coro, pause Batuque, glisser-déposer) et puce `+`
 * d'insertion entre deux colonnes. Les colonnes ne portent que des `patternId` : aucun audio n'est décalé (< 110 lignes).
 */
import React from 'react';
import { X, GripVertical, VolumeX } from 'lucide-react';
import type { ToadaArrangementSlot, VocalPatternItem } from '../../types/toadaProject.types';
import { useLanguage } from '../../i18n/LanguageContext';
import { InsertHereIcon } from '../icons/CordelActionIcons';

export interface SlotDragHandlers {
  start: (idx: number) => void; enter: (idx: number) => void; leave: (idx: number) => void; drop: (idx: number) => void; end: () => void;
}

export const ConductorInsertChip: React.FC<{ onClick: () => void; title: string }> = ({ onClick, title }) => (
  <button
    type="button" onClick={onClick} title={title} aria-label={title}
    className="shrink-0 self-stretch w-6 flex items-center justify-center rounded border border-dashed border-[var(--cordel-border-sub)] text-[var(--cordel-text)]/55 hover:text-theme-accent hover:border-amber-500 hover:bg-amber-500/10 cursor-pointer"
  >
    <InsertHereIcon className="w-3.5 h-3.5" />
  </button>
);

interface ColumnProps {
  slot: ToadaArrangementSlot; idx: number; canRemove: boolean; puxPatterns: VocalPatternItem[]; coroPatterns: VocalPatternItem[];
  isCurrent: boolean; isDropTarget: boolean; isDragged: boolean; drag: SlotDragHandlers;
  onUpdate: (slotId: string, puxId: string | null, coroId: string | null, advance?: number) => void; onRemove: (slotId: string) => void;
}

const ROLE_ON = { puxador: 'bg-role-puxador !text-white border-role-puxador', coro: 'bg-role-coro !text-white border-role-coro' } as const;
const optCls = 'bg-[var(--cordel-surface)] text-[var(--cordel-text)]';

export const ConductorSlotColumn: React.FC<ColumnProps> = ({ slot, idx, canRemove, puxPatterns, coroPatterns, isCurrent, isDropTarget, isDragged, drag, onUpdate, onRemove }) => {
  const { t } = useLanguage();
  const isSilence = !slot.puxadorPatternId && !slot.coroPatternId, pause = Math.max(1, Math.min(8, slot.advanceMeasures ?? 1));
  const emptyLabel = isSilence ? `[Pause ${pause}M]` : t('emptySlot');
  const selCls = (on: boolean, role: 'puxador' | 'coro') => `h-6 text-[10px] font-mono font-bold px-1 outline-none border cursor-pointer rounded ${on ? ROLE_ON[role] : 'bg-[var(--cordel-surface)] text-[var(--cordel-text)] border-[var(--cordel-border-sub)] font-semibold'}`;
  return (
    <div
      draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(idx)); drag.start(idx); }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDragEnter={() => drag.enter(idx)} onDragLeave={() => drag.leave(idx)}
      onDrop={(e) => { e.preventDefault(); drag.drop(idx); }} onDragEnd={drag.end}
      className={`flex flex-col gap-1 p-1 min-w-[130px] max-w-[155px] shrink-0 border transition-all rounded ${
        isDropTarget ? 'border-amber-400 ring-2 ring-amber-500 bg-amber-500/15' : isCurrent ? 'border-theme-accent bg-theme-accent/15 ring-2 ring-theme-accent shadow-md'
        : isDragged ? 'opacity-40 border-dashed border-[var(--cordel-border-sub)]' : isSilence ? 'border-dashed border-amber-600/60 bg-amber-500/10' : 'border-[var(--cordel-border-sub)] bg-[var(--cordel-subcard-bg)]'}`}
    >
      <div className="flex items-center justify-between text-[10px] font-mono px-0.5 text-[var(--cordel-text)] font-bold gap-1">
        <div className="flex items-center gap-0.5 min-w-0">
          <span className="p-0.5 text-[var(--cordel-text)]/50 hover:text-theme-accent cursor-grab active:cursor-grabbing" title={t('conductorDragReorderTitle')}><GripVertical className="w-3 h-3" /></span>
          <span className="truncate flex items-center gap-0.5">{isSilence ? <><VolumeX className="w-3 h-3 shrink-0" /><span>{t('conductorPauseShort')}</span></> : t('blockLabel', { n: idx + 1 })}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isSilence && (
            <select value={pause} onChange={(e) => onUpdate(slot.slotId, null, null, Number(e.target.value))} className="text-[10px] font-mono font-bold px-1 py-0 rounded bg-amber-600/20 text-amber-900 dark:text-amber-200 border border-amber-600/40 cursor-pointer">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((m) => <option key={m} value={m} className={optCls}>{m}M</option>)}
            </select>
          )}
          {canRemove && <button type="button" onClick={() => onRemove(slot.slotId)} title={t('conductorRemoveBlockTitle')} className="p-0.5 text-[var(--cordel-text)]/50 hover:text-red-500 cursor-pointer"><X className="w-2.5 h-2.5" /></button>}
        </div>
      </div>
      <select value={slot.puxadorPatternId ?? ''} onChange={(e) => onUpdate(slot.slotId, e.target.value || null, slot.coroPatternId, e.target.value ? undefined : pause)} className={selCls(Boolean(slot.puxadorPatternId), 'puxador')}>
        <option value="" className={optCls}>{emptyLabel}</option>
        {puxPatterns.map((p) => <option key={p.id} value={p.id} className={optCls}>{p.name}</option>)}
      </select>
      <select value={slot.coroPatternId ?? ''} onChange={(e) => onUpdate(slot.slotId, slot.puxadorPatternId, e.target.value || null, e.target.value ? undefined : pause)} className={selCls(Boolean(slot.coroPatternId), 'coro')}>
        <option value="" className={optCls}>{emptyLabel}</option>
        {coroPatterns.map((p) => <option key={p.id} value={p.id} className={optCls}>{p.name}</option>)}
      </select>
    </div>
  );
};
