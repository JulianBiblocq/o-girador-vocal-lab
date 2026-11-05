/**
 * ToadaConductorStrip.tsx
 * Ligne 2 : Frise Conducteur avec Rails Puxador/Coro, Pause Baque (1M..8M), Live Tempo et Timeline Audio (< 140 lignes).
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { batchUpdateProjectBpm } from '../../utils/projectBatchOps';
import { Play, Square, Plus, X, Layers, GripVertical, VolumeX } from 'lucide-react';
import { ToadaPlayerEngine } from './ToadaPlayerEngine';
import { ConductorLiveTempoControl } from './ConductorLiveTempoControl';
import { ConductorWaveformTimeline } from './ConductorWaveformTimeline';
import { ConductorBackingAndLoopBar, type ConductorLoopRange } from './ConductorBackingAndLoopBar';

export const ToadaConductorStrip: React.FC<{ outputDeviceId?: string }> = ({ outputDeviceId }) => {
  const { project, addSlot, removeSlot, updateSlot, reorderSlots, loadProject } = useToadaProject();
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

  const handleTogglePlay = async () => {
    if (isPlaying) {
      player.stop(); setIsPlaying(false); setCurrentSlotIdx(null);
    } else {
      setIsPlaying(true);
      await player.play(
        { ...project, bpm: liveBpm }, outputDeviceId,
        (slotIdx) => setCurrentSlotIdx(slotIdx),
        () => { setIsPlaying(false); setCurrentSlotIdx(null); },
        loopRange
      );
    }
  };

  const handleLiveBpmChange = (nb: number) => { setLiveBpm(nb); player.setLiveBpm(nb); };
  const handleApplyLiveBpm = (nb: number) => { loadProject(batchUpdateProjectBpm(project, 'all', [], nb)); };

  return (
    <div className="cordel-card p-2 w-full h-full flex flex-col select-none">
      <div className="flex items-center justify-between text-xs font-mono mb-1.5 flex-wrap gap-1">
        <span className="font-bold text-theme-ink flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
          <Layers className="w-3.5 h-3.5 text-theme-accent" /><span>{t('conductorTitle')}</span>
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          <ConductorLiveTempoControl liveBpm={liveBpm} projectBpm={project.bpm || 88} onBpmChange={handleLiveBpmChange} onApplyBpmToProject={handleApplyLiveBpm} />
          <button type="button" onClick={() => addSlot()} className="px-2 py-0.5 text-[11px] font-bold font-mono cordel-card-sm rounded flex items-center gap-1 cursor-pointer">
            <Plus className="w-3 h-3 text-theme-accent" /><span>{t('addConductorBlock')}</span>
          </button>
          <button type="button" onClick={() => addSlot(2)} className="px-2 py-0.5 text-[11px] font-bold font-mono cordel-card-sm rounded flex items-center gap-1 cursor-pointer text-amber-800 dark:text-amber-300" title={t('conductorAddSilenceBtn')}>
            <VolumeX className="w-3 h-3" /><span>{t('conductorAddSilenceBtn')}</span>
          </button>
          <button type="button" onClick={handleTogglePlay} className={`px-2.5 py-0.5 text-[11px] font-bold font-mono rounded flex items-center gap-1.5 cursor-pointer ${isPlaying ? 'bg-red-800 text-white font-bold animate-pulse' : 'cordel-btn-primary'}`}>
            {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
            <span>{isPlaying ? t('stopFullToada') : t('playFullToada')}</span>
          </button>
        </div>
      </div>

      <ConductorBackingAndLoopBar
        projectId={project.id} projectBpm={liveBpm} slotsCount={project.slots.length}
        loopRange={loopRange} onChangeLoopRange={setLoopRange} onBackingVolumeChange={(v) => player.setBackingVolume(v)}
      />
      <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1 cordel-scrollbar mt-1">
        <div className="flex flex-col justify-end gap-1 shrink-0 w-20 text-[10px] font-mono font-bold">
          <div className="h-6 flex items-center justify-end pr-1 text-role-puxador truncate">{t('railPuxador')}</div>
          <div className="h-6 flex items-center justify-end pr-1 text-role-coro truncate">{t('railCoro')}</div>
        </div>

        {project.slots.map((slot, idx) => {
          const isCurrent = currentSlotIdx === idx, isDropTarget = dropTargetIdx === idx && draggedIdx !== idx;
          const isSilenceSlot = !slot.puxadorPatternId && !slot.coroPatternId;
          const pauseMeasures = Math.max(1, Math.min(8, slot.advanceMeasures ?? 1));
          return (
            <div
              key={slot.slotId} draggable
              onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(idx)); setDraggedIdx(idx); }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDragEnter={() => setDropTargetIdx(idx)}
              onDragLeave={() => { if (dropTargetIdx === idx) setDropTargetIdx(null); }}
              onDrop={(e) => { e.preventDefault(); if (draggedIdx !== null && draggedIdx !== idx) reorderSlots(draggedIdx, idx); setDraggedIdx(null); setDropTargetIdx(null); }}
              onDragEnd={() => { setDraggedIdx(null); setDropTargetIdx(null); }}
              className={`flex flex-col gap-1 p-1 min-w-[130px] max-w-[155px] shrink-0 border transition-all rounded ${
                isDropTarget ? 'border-amber-400 ring-2 ring-amber-500 bg-amber-500/15' :
                isCurrent ? 'border-theme-accent bg-theme-accent/15 ring-2 ring-theme-accent shadow-md' :
                draggedIdx === idx ? 'opacity-40 border-dashed border-[var(--cordel-border-sub)]' :
                isSilenceSlot ? 'border-dashed border-amber-600/60 bg-amber-500/10' :
                'border-[var(--cordel-border-sub)] bg-[var(--cordel-subcard-bg)]'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono px-0.5 text-[var(--cordel-text)] font-bold gap-1">
                <div className="flex items-center gap-0.5 min-w-0">
                  <span className="p-0.5 text-[var(--cordel-text)]/50 hover:text-theme-accent cursor-grab active:cursor-grabbing" title={t('conductorDragReorderTitle')}>
                    <GripVertical className="w-3 h-3" />
                  </span>
                  <span className="truncate">{isSilenceSlot ? `🔇 ${t('conductorPauseShort')}` : t('blockLabel', { n: idx + 1 })}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {isSilenceSlot && (
                    <select value={pauseMeasures} onChange={(e) => updateSlot(slot.slotId, null, null, Number(e.target.value))} className="text-[10px] font-mono font-bold px-1 py-0 rounded bg-amber-600/20 text-amber-900 dark:text-amber-200 border border-amber-600/40 cursor-pointer">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((m) => <option key={m} value={m} className="bg-[var(--cordel-surface)] text-[var(--cordel-text)]">{m}M</option>)}
                    </select>
                  )}
                  {project.slots.length > 1 && (
                    <button type="button" onClick={() => removeSlot(slot.slotId)} className="p-0.5 text-[var(--cordel-text)]/50 hover:text-red-500 cursor-pointer"><X className="w-2.5 h-2.5" /></button>
                  )}
                </div>
              </div>
              <select
                value={slot.puxadorPatternId ?? ''} onChange={(e) => updateSlot(slot.slotId, e.target.value || null, slot.coroPatternId, e.target.value ? undefined : pauseMeasures)}
                className={`h-6 text-[10px] font-mono font-bold px-1 outline-none border cursor-pointer rounded ${slot.puxadorPatternId ? 'bg-role-puxador !text-white font-bold border-role-puxador' : 'bg-[var(--cordel-surface)] text-[var(--cordel-text)] border border-[var(--cordel-border-sub)] font-semibold'}`}
              >
                <option value="" className="bg-[var(--cordel-surface)] text-[var(--cordel-text)]">{isSilenceSlot ? `🔇 (${pauseMeasures}M)` : t('emptySlot')}</option>
                {puxPatterns.map((p) => <option key={p.id} value={p.id} className="bg-[var(--cordel-surface)] text-[var(--cordel-text)]">{p.name}</option>)}
              </select>
              <select
                value={slot.coroPatternId ?? ''} onChange={(e) => updateSlot(slot.slotId, slot.puxadorPatternId, e.target.value || null, e.target.value ? undefined : pauseMeasures)}
                className={`h-6 text-[10px] font-mono font-bold px-1 outline-none border cursor-pointer rounded ${slot.coroPatternId ? 'bg-role-coro !text-white font-bold border-role-coro' : 'bg-[var(--cordel-surface)] text-[var(--cordel-text)] border border-[var(--cordel-border-sub)] font-semibold'}`}
              >
                <option value="" className="bg-[var(--cordel-surface)] text-[var(--cordel-text)]">{isSilenceSlot ? `🔇 (${pauseMeasures}M)` : t('emptySlot')}</option>
                {coroPatterns.map((p) => <option key={p.id} value={p.id} className="bg-[var(--cordel-surface)] text-[var(--cordel-text)]">{p.name}</option>)}
              </select>
            </div>
          );
        })}
      </div>

      <ConductorWaveformTimeline project={project} isPlaying={isPlaying} playerEngine={player} />
    </div>
  );
};
