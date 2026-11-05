/**
 * ConductorBackingAndLoopBar.tsx
 * Barre de contrôle du Bounce Rythmique (Baque Témoin de Sequenciador) et de la Boucle de Section A/B (< 130 lignes).
 */
import React, { useRef, useState, useEffect } from 'react';
import { Drum, Repeat, Trash2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { decodeAudioFile } from '../../utils/directAudioImporter';
import {
  getActiveBackingTrack, setActiveBackingTrack, updateActiveBackingTrack,
  subscribeBackingTrack, hydrateBackingTrackFromIdb, extractBpmFromFileName, type BackingTrackData,
} from '../../utils/backingTrackStorage';

export interface ConductorLoopRange {
  enabled: boolean;
  startSlot: number;
  endSlot: number;
}

interface ConductorBackingAndLoopBarProps {
  projectId: string;
  projectBpm: number;
  slotsCount: number;
  loopRange: ConductorLoopRange;
  onChangeLoopRange: (next: ConductorLoopRange) => void;
  onBackingVolumeChange?: (vol: number) => void;
}

export const ConductorBackingAndLoopBar: React.FC<ConductorBackingAndLoopBarProps> = ({
  projectId, projectBpm, slotsCount, loopRange, onChangeLoopRange, onBackingVolumeChange,
}) => {
  const { t } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [track, setTrack] = useState<BackingTrackData | null>(() => getActiveBackingTrack(projectId));

  useEffect(() => {
    hydrateBackingTrackFromIdb(projectId).then((res) => { if (res) setTrack(res); });
    return subscribeBackingTrack(() => setTrack(getActiveBackingTrack(projectId)));
  }, [projectId]);

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const decoded = await decodeAudioFile(file);
    const refBpm = extractBpmFromFileName(file.name, projectBpm || 88);
    const measureSec = 4 * (60 / refBpm);
    const isShortLoop = decoded.durationSec <= measureSec * 8.5;
    const newTrack: BackingTrackData = {
      projectId, fileName: file.name, pcm: decoded.pcm, sampleRate: decoded.sampleRate,
      referenceBpm: refBpm, firstDownbeatOffsetSec: 0, volume: 0.65, enabled: true, loopTrack: isShortLoop,
    };
    setActiveBackingTrack(newTrack, projectId);
    e.target.value = '';
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1.5 py-1 mb-1 rounded border border-[var(--cordel-border-sub)] bg-[var(--cordel-subcard-bg)] text-[10.5px] font-mono">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button" onClick={() => fileRef.current?.click()}
          className="px-2 py-0.5 cordel-card-sm rounded font-bold flex items-center gap-1 cursor-pointer text-theme-accent"
          title={t('backingImportTooltip')}
        >
          <Drum className="w-3.5 h-3.5" /><span>{track ? track.fileName.slice(0, 18) : t('backingImportBtn')}</span>
        </button>
        <input ref={fileRef} type="file" accept=".wav,.mp3,.ogg,audio/*" onChange={handleImportFile} className="hidden" />

        {track && (
          <>
            <button
              type="button"
              onClick={() => updateActiveBackingTrack(projectId, { enabled: !track.enabled })}
              className={`px-1.5 py-0.5 rounded font-bold cursor-pointer border ${track.enabled ? 'bg-emerald-700 text-white border-emerald-600' : 'cordel-card-sm opacity-60'}`}
            >
              {track.enabled ? 'ON' : 'OFF'}
            </button>
            <label className="flex items-center gap-1">
              <span>BPM:</span>
              <input
                type="number" min={35} max={240} value={track.referenceBpm}
                onChange={(e) => updateActiveBackingTrack(projectId, { referenceBpm: Math.max(35, Math.min(240, Number(e.target.value) || 88)) })}
                className="w-12 px-1 py-0.2 cordel-card-sm rounded text-center font-bold"
              />
            </label>
            <button type="button" onClick={() => updateActiveBackingTrack(projectId, { firstDownbeatOffsetSec: Math.max(0, Math.round((track.firstDownbeatOffsetSec - 0.01) * 1000) / 1000) })} className="px-1 cordel-card-sm rounded cursor-pointer">-10ms</button>
            <span className="font-bold text-theme-wood">{track.firstDownbeatOffsetSec.toFixed(2)}s</span>
            <button type="button" onClick={() => updateActiveBackingTrack(projectId, { firstDownbeatOffsetSec: Math.round((track.firstDownbeatOffsetSec + 0.01) * 1000) / 1000 })} className="px-1 cordel-card-sm rounded cursor-pointer">+10ms</button>
            <button
              type="button" onClick={() => updateActiveBackingTrack(projectId, { loopTrack: !track.loopTrack })}
              className={`px-1.5 py-0.5 rounded cursor-pointer border ${track.loopTrack ? 'bg-theme-wood text-[#f4ecd8] font-bold' : 'cordel-card-sm opacity-70'}`}
            >
              🔁
            </button>
            <input
              type="range" min={0} max={1} step={0.05} value={track.volume}
              onChange={(e) => { const v = parseFloat(e.target.value); updateActiveBackingTrack(projectId, { volume: v }); onBackingVolumeChange?.(v); }}
              className="w-14 accent-[var(--cordel-wood)] cursor-pointer"
            />
            <button type="button" onClick={() => setActiveBackingTrack(null, projectId)} className="p-0.5 text-red-500 hover:text-red-400 cursor-pointer">
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChangeLoopRange({ ...loopRange, enabled: !loopRange.enabled })}
          className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 cursor-pointer border ${loopRange.enabled ? 'bg-amber-600 text-white border-amber-500' : 'cordel-card-sm'}`}
        >
          <Repeat className="w-3 h-3" /><span>{t('conductorLoopSelectionBtn')}</span>
        </button>
        <select
          value={loopRange.startSlot}
          onChange={(e) => { const s = Number(e.target.value); onChangeLoopRange({ ...loopRange, startSlot: s, endSlot: Math.max(s, loopRange.endSlot) }); }}
          className="px-1 py-0.5 cordel-card-sm rounded font-bold cursor-pointer"
        >
          {Array.from({ length: Math.max(1, slotsCount) }, (_, i) => <option key={i} value={i}>#{i + 1}</option>)}
        </select>
        <span>➔</span>
        <select
          value={Math.min(Math.max(0, slotsCount - 1), loopRange.endSlot)}
          onChange={(e) => { const end = Number(e.target.value); onChangeLoopRange({ ...loopRange, startSlot: Math.min(loopRange.startSlot, end), endSlot: end }); }}
          className="px-1 py-0.5 cordel-card-sm rounded font-bold cursor-pointer"
        >
          {Array.from({ length: Math.max(1, slotsCount) }, (_, i) => <option key={i} value={i}>#{i + 1}</option>)}
        </select>
      </div>
    </div>
  );
};

