/**
 * ToadaConductorStrip.tsx
 * Ligne 2 : Frise Conducteur avec Rails Puxador/Coro, Live Tempo Varispeed et Timeline Audio (< 135 lignes).
 */
import React, { useState, useMemo, useEffect } from 'react';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { Play, Square, Plus, X, Layers } from 'lucide-react';
import { ToadaPlayerEngine } from './ToadaPlayerEngine';
import { ConductorLiveTempoControl } from './ConductorLiveTempoControl';
import { ConductorWaveformTimeline } from './ConductorWaveformTimeline';

export const ToadaConductorStrip: React.FC<{ outputDeviceId?: string }> = ({ outputDeviceId }) => {
  const { project, addSlot, removeSlot, updateSlot } = useToadaProject();
  const { t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSlotIdx, setCurrentSlotIdx] = useState<number | null>(null);
  const [liveBpm, setLiveBpm] = useState(project.bpm || 88);

  const player = useMemo(() => new ToadaPlayerEngine(), []);
  const puxPatterns = useMemo(() => project.patterns.filter((p) => p.role === 'puxador'), [project.patterns]);
  const coroPatterns = useMemo(() => project.patterns.filter((p) => p.role === 'coro'), [project.patterns]);

  useEffect(() => { setLiveBpm(project.bpm || 88); }, [project.bpm]);

  const handleTogglePlay = async () => {
    if (isPlaying) {
      player.stop(); setIsPlaying(false); setCurrentSlotIdx(null);
    } else {
      setIsPlaying(true);
      await player.play(
        { ...project, bpm: liveBpm }, outputDeviceId,
        (slotIdx) => setCurrentSlotIdx(slotIdx),
        () => { setIsPlaying(false); setCurrentSlotIdx(null); }
      );
    }
  };

  const handleLiveBpmChange = (nb: number) => {
    setLiveBpm(nb);
    player.setLiveBpm(nb);
  };

  return (
    <div className="cordel-card p-2 w-full h-full flex flex-col select-none">
      <div className="flex items-center justify-between text-xs font-mono mb-1.5 flex-wrap gap-1">
        <span className="font-bold text-theme-ink flex items-center gap-1.5 uppercase text-[11px] tracking-wider">
          <Layers className="w-3.5 h-3.5 text-theme-accent" />
          <span>{t('conductorTitle')}</span>
        </span>
        <div className="flex items-center gap-2">
          <ConductorLiveTempoControl liveBpm={liveBpm} onBpmChange={handleLiveBpmChange} />
          <button
            type="button" onClick={addSlot}
            className="px-2 py-0.5 text-[11px] font-bold font-mono cordel-card-sm rounded flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3 text-theme-accent" />
            <span>{t('addConductorBlock')}</span>
          </button>
          <button
            type="button" onClick={handleTogglePlay}
            className={`px-2.5 py-0.5 text-[11px] font-bold font-mono rounded flex items-center gap-1.5 cursor-pointer ${
              isPlaying ? 'bg-red-800 text-white font-bold animate-pulse' : 'cordel-btn-primary'
            }`}
          >
            {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
            <span>{isPlaying ? t('stopFullToada') : t('playFullToada')}</span>
          </button>
        </div>
      </div>

      {/* Grille des blocs sequentiels avec defilement */}
      <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1 cordel-scrollbar mt-1">
        <div className="flex flex-col justify-end gap-1 shrink-0 w-20 text-[10px] font-mono font-bold">
          <div className="h-6 flex items-center justify-end pr-1 text-role-puxador truncate">{t('railPuxador')}</div>
          <div className="h-6 flex items-center justify-end pr-1 text-role-coro truncate">{t('railCoro')}</div>
        </div>

        {project.slots.map((slot, idx) => {
          const isCurrent = currentSlotIdx === idx;
          return (
            <div
              key={slot.slotId}
              className={`flex flex-col gap-1 p-1 min-w-[125px] max-w-[145px] shrink-0 border transition-all rounded ${
                isCurrent ? 'border-theme-accent bg-theme-accent/15 ring-2 ring-theme-accent shadow-md' : 'border-[var(--cordel-border-sub)] bg-[var(--cordel-subcard-bg)]'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono px-0.5 text-[var(--cordel-text)] font-bold">
                <span>{t('blockLabel', { n: idx + 1 })}</span>
                {project.slots.length > 1 && (
                  <button type="button" onClick={() => removeSlot(slot.slotId)} className="p-0.5 text-[var(--cordel-text)]/50 hover:text-red-500 cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
              <select
                value={slot.puxadorPatternId ?? ''} onChange={(e) => updateSlot(slot.slotId, e.target.value || null, slot.coroPatternId)}
                className={`h-6 text-[10px] font-mono font-bold px-1 outline-none border cursor-pointer rounded ${
                  slot.puxadorPatternId ? 'bg-role-puxador !text-white font-bold border-role-puxador' : 'bg-[var(--cordel-surface)] text-[var(--cordel-text)] border border-[var(--cordel-border-sub)] font-semibold'
                }`}
              >
                <option value="" className="bg-[var(--cordel-surface)] text-[var(--cordel-text)]">{t('emptySlot')}</option>
                {puxPatterns.map((p) => <option key={p.id} value={p.id} className="bg-[var(--cordel-surface)] text-[var(--cordel-text)]">{p.name}</option>)}
              </select>
              <select
                value={slot.coroPatternId ?? ''} onChange={(e) => updateSlot(slot.slotId, slot.puxadorPatternId, e.target.value || null)}
                className={`h-6 text-[10px] font-mono font-bold px-1 outline-none border cursor-pointer rounded ${
                  slot.coroPatternId ? 'bg-role-coro !text-white font-bold border-role-coro' : 'bg-[var(--cordel-surface)] text-[var(--cordel-text)] border border-[var(--cordel-border-sub)] font-semibold'
                }`}
              >
                <option value="" className="bg-[var(--cordel-surface)] text-[var(--cordel-text)]">{t('emptySlot')}</option>
                {coroPatterns.map((p) => <option key={p.id} value={p.id} className="bg-[var(--cordel-surface)] text-[var(--cordel-text)]">{p.name}</option>)}
              </select>
            </div>
          );
        })}
      </div>

      {/* Timeline Audio Visuelle continue de reconstruction */}
      <ConductorWaveformTimeline project={project} isPlaying={isPlaying} playerEngine={player} />
    </div>
  );
};
