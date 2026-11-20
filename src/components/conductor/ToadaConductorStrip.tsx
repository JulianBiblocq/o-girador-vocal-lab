/**
 * ToadaConductorStrip.tsx
 * Frise Conducteur : rails Puxador/Coro, puces `+` d'insertion entre colonnes et en fin de frise, Pause Batuque (1M..8M),
 * Live Tempo et Timeline Audio. Liaison stricte par `patternId` immuable (< 100 lignes).
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Layers } from 'lucide-react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { batchUpdateProjectBpm } from '../../utils/projectBatchOps';
import { ToadaPlayerEngine } from './ToadaPlayerEngine';
import { ConductorWaveformTimeline } from './ConductorWaveformTimeline';
import { ConductorBackingAndLoopBar, type ConductorLoopRange } from './ConductorBackingAndLoopBar';
import { ConductorStripActions } from './ConductorStripActions';
import { ConductorSlotColumn, ConductorInsertChip } from './ConductorSlotColumn';

interface StripProps { outputDeviceId?: string; isManualStructureEdit?: boolean; frameless?: boolean; onRequestManualEdit?: () => Promise<boolean>; }

export const ToadaConductorStrip: React.FC<StripProps> = ({ outputDeviceId, isManualStructureEdit = false, frameless = false, onRequestManualEdit }) => {
  const { project, addSlot, insertSlotAt, removeSlot, updateSlot, reorderSlots, loadProject } = useToadaProject();
  const { t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false), [currentSlotIdx, setCurrentSlotIdx] = useState<number | null>(null);
  const [liveBpm, setLiveBpm] = useState(project.bpm || 88);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null), [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const [loopRange, setLoopRange] = useState<ConductorLoopRange>({ enabled: false, startSlot: 0, endSlot: Math.max(0, project.slots.length - 1) });

  const player = useMemo(() => new ToadaPlayerEngine(), []);
  const puxPatterns = useMemo(() => project.patterns.filter((p) => p.role === 'puxador'), [project.patterns]);
  const coroPatterns = useMemo(() => project.patterns.filter((p) => p.role === 'coro'), [project.patterns]);

  useEffect(() => { setLiveBpm(project.bpm || 88); }, [project.bpm]);
  useEffect(() => () => { player.stop(); }, [player]);

  const guarded = useCallback(async (action: () => void) => {
    if (isManualStructureEdit || !onRequestManualEdit || (await onRequestManualEdit())) action();
  }, [isManualStructureEdit, onRequestManualEdit]);

  const handleTogglePlay = async () => {
    if (isPlaying) { player.stop(); setIsPlaying(false); setCurrentSlotIdx(null); return; }
    setIsPlaying(true);
    await player.play({ ...project, bpm: liveBpm }, outputDeviceId, (idx) => setCurrentSlotIdx(idx), () => { setIsPlaying(false); setCurrentSlotIdx(null); }, loopRange);
  };

  const drag = useMemo(() => ({
    start: (i: number) => setDraggedIdx(i), enter: (i: number) => setDropTargetIdx(i), leave: (i: number) => setDropTargetIdx((cur) => (cur === i ? null : cur)),
    drop: (i: number) => { if (draggedIdx !== null && draggedIdx !== i) reorderSlots(draggedIdx, i); setDraggedIdx(null); setDropTargetIdx(null); },
    end: () => { setDraggedIdx(null); setDropTargetIdx(null); },
  }), [draggedIdx, reorderSlots]);

  return (
    <div className={`${frameless ? '' : 'cordel-card p-2'} w-full h-full flex flex-col select-none`}>
      <div className="flex items-center justify-between text-xs font-mono mb-1.5 flex-wrap gap-1">
        <span className="font-bold text-theme-ink flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
          <Layers className="w-3.5 h-3.5 text-theme-accent" /><span>{t('conductorTitle')}</span>
        </span>
        <ConductorStripActions
          liveBpm={liveBpm} projectBpm={project.bpm || 88} isPlaying={isPlaying} onTogglePlay={handleTogglePlay}
          onBpmChange={(nb) => { setLiveBpm(nb); player.setLiveBpm(nb); }} onApplyBpm={(nb) => loadProject(batchUpdateProjectBpm(project, 'all', [], nb))}
          onAddBlock={() => void guarded(() => addSlot())} onAddPause={() => void guarded(() => addSlot(2))}
        />
      </div>

      <ConductorBackingAndLoopBar projectId={project.id} projectBpm={liveBpm} slotsCount={project.slots.length} loopRange={loopRange} onChangeLoopRange={setLoopRange} onBackingVolumeChange={(v) => player.setBackingVolume(v)} />
      <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1 cordel-scrollbar mt-1">
        <div className="flex flex-col justify-end gap-1 shrink-0 w-20 text-[10px] font-mono font-bold">
          <div className="h-6 flex items-center justify-end pr-1 text-role-puxador truncate">{t('railPuxador')}</div>
          <div className="h-6 flex items-center justify-end pr-1 text-role-coro truncate">{t('railCoro')}</div>
        </div>
        {project.slots.map((slot, idx) => (
          <React.Fragment key={slot.slotId}>
            <ConductorInsertChip onClick={() => void guarded(() => insertSlotAt(idx))} title={t('conductorInsertHere')} />
            <ConductorSlotColumn
              slot={slot} idx={idx} canRemove={project.slots.length > 1} puxPatterns={puxPatterns} coroPatterns={coroPatterns}
              isCurrent={currentSlotIdx === idx} isDropTarget={dropTargetIdx === idx && draggedIdx !== idx} isDragged={draggedIdx === idx}
              drag={drag} onUpdate={updateSlot} onRemove={(id) => void guarded(() => removeSlot(id))}
            />
          </React.Fragment>
        ))}
        <ConductorInsertChip onClick={() => void guarded(() => insertSlotAt(project.slots.length))} title={t('conductorInsertAtEnd')} />
      </div>

      <ConductorWaveformTimeline project={project} isPlaying={isPlaying} playerEngine={player} />
    </div>
  );
};
