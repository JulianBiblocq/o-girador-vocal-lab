/**
 * BpmStampPopover.tsx
 * Poinçon gravé interactif [BPM] : Stepper, Tap Tempo, Portée d'application & Batuque (.wav) (< 135 lignes).
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Drum, Minus, Plus, Hand, Trash2, Volume2, ChevronDown } from 'lucide-react';
import { DEFAULT_TOADA_BPM } from '../../types/toadaProject.types';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { NumericDraftInput } from '../ui/NumericDraftInput';
import { decodeAudioFile } from '../../utils/directAudioImporter';
import {
  getActiveBackingTrack, setActiveBackingTrack, updateActiveBackingTrack,
  subscribeBackingTrack, extractBpmFromFileName, type BackingTrackData,
} from '../../utils/backingTrackStorage';

export const BpmStampPopover: React.FC = () => {
  const { project, activePattern, updateScopedBpm, applyScope, setApplyScope } = useToadaProject();
  const { t, language } = useLanguage();
  const isBr = language === 'br';
  const [isOpen, setIsOpen] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [backingTrack, setBackingTrack] = useState<BackingTrackData | null>(() => getActiveBackingTrack(project.id));
  const popRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tapTimesRef = useRef<number[]>([]);

  const bpm = activePattern.bpm ?? activePattern.baseBpm ?? project.bpm ?? DEFAULT_TOADA_BPM;

  useEffect(() => {
    setBackingTrack(getActiveBackingTrack(project.id));
    return subscribeBackingTrack(() => setBackingTrack(getActiveBackingTrack(project.id)));
  }, [project.id]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onClose = () => setIsOpen(false);
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('cordel-close-popovers', onClose);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('cordel-close-popovers', onClose);
    };
  }, []);

  const handleTapTempo = useCallback(() => {
    const now = performance.now();
    const next = [...tapTimesRef.current.filter((x) => now - x < 2600), now].slice(-6);
    tapTimesRef.current = next;
    setTapCount(next.length);
    if (next.length >= 3) {
      const intervals = next.slice(1).map((x, i) => x - next[i]).sort((a, b) => a - b);
      updateScopedBpm(Math.max(35, Math.min(220, Math.round(60000 / Math.max(200, intervals[Math.floor(intervals.length / 2)])))));
    }
  }, [updateScopedBpm]);

  const handleImportWav = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const decoded = await decodeAudioFile(file);
    const refBpm = extractBpmFromFileName(file.name, bpm || 88);
    setActiveBackingTrack({
      projectId: project.id, fileName: file.name, pcm: decoded.pcm, sampleRate: decoded.sampleRate,
      referenceBpm: refBpm, firstDownbeatOffsetSec: 0, volume: 0.65, enabled: true,
      loopTrack: decoded.durationSec <= 4 * (60 / refBpm) * 8.5,
    }, project.id);
    e.target.value = '';
  };

  return (
    <div className="relative inline-flex items-center" ref={popRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title={t('stampBpmTitle')}
        className="h-8 px-2.5 cordel-card-sm text-xs font-mono font-bold inline-flex items-center gap-1.5 hover:border-amber-500/70 transition-colors cursor-pointer"
      >
        <Drum className="w-3.5 h-3.5 text-[#9a3412] dark:text-amber-300 shrink-0" />
        <span className="text-theme-ink font-black">{bpm} BPM</span>
        {backingTrack?.enabled && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {isOpen && (
        <div className="absolute top-9 left-0 z-[100] w-72 cordel-card p-3 bg-[var(--cordel-surface)] text-[var(--cordel-text)] border border-[var(--cordel-border-panel)] shadow-lg flex flex-col gap-2.5 text-xs font-mono rounded">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center cordel-card-sm rounded overflow-hidden">
              <button type="button" onClick={() => updateScopedBpm(Math.max(30, bpm - 1))} className="px-2 py-1 hover:bg-amber-500/20 font-bold cursor-pointer"><Minus className="w-3 h-3" /></button>
              <NumericDraftInput min={30} max={240} value={bpm} onChange={updateScopedBpm} className="w-12 bg-transparent text-center font-mono font-bold text-xs py-0.5 text-[#9a3412] dark:text-amber-300" />
              <button type="button" onClick={() => updateScopedBpm(Math.min(240, bpm + 1))} className="px-2 py-1 hover:bg-amber-500/20 font-bold cursor-pointer"><Plus className="w-3 h-3" /></button>
            </div>
            <button type="button" onClick={handleTapTempo} className="px-2.5 py-1 cordel-btn font-bold flex items-center gap-1 rounded cursor-pointer">
              <Hand className="w-3.5 h-3.5 text-theme-accent" /><span>Tap {tapCount >= 2 ? `(${tapCount})` : ''}</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-1 text-[11px] pt-1 border-t border-[var(--cordel-border-sub)]">
            <span className="opacity-75">{isBr ? 'Aplicar a :' : 'Appliquer à :'}</span>
            <div className="inline-flex rounded cordel-card-sm p-0.5">
              <button type="button" onClick={() => setApplyScope('all')} className={`px-2 py-0.5 rounded font-bold cursor-pointer ${applyScope === 'all' ? 'bg-theme-wood text-[var(--cordel-on-primary)]' : 'opacity-70'}`}>{isBr ? 'Toda a Toada' : 'Toute la Toada'}</button>
              <button type="button" onClick={() => setApplyScope('current')} className={`px-2 py-0.5 rounded font-bold cursor-pointer ${applyScope === 'current' ? 'bg-theme-wood text-[var(--cordel-on-primary)]' : 'opacity-70'}`}>{isBr ? 'Este bloco' : 'Ce bloc'}</button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 pt-1.5 border-t border-[var(--cordel-border-sub)]">
            <div className="flex items-center justify-between gap-1.5">
              <button type="button" onClick={() => fileRef.current?.click()} className="flex-1 px-2 py-1 cordel-card-sm hover:border-amber-500 font-bold flex items-center justify-center gap-1.5 rounded cursor-pointer text-theme-accent truncate">
                <Drum className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{backingTrack ? backingTrack.fileName : t('stampBatuqueWavBtn')}</span>
              </button>
              {backingTrack && (
                <button type="button" onClick={() => setActiveBackingTrack(null, project.id)} className="p-1.5 cordel-card-sm hover:text-red-500 cursor-pointer" title={isBr ? 'Remover Batuque' : 'Retirer le Batuque'}><Trash2 className="w-3.5 h-3.5" /></button>
              )}
              <input ref={fileRef} type="file" accept=".wav,.mp3,.ogg,audio/*" onChange={handleImportWav} className="hidden" />
            </div>
            {backingTrack && (
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold">
                  <input type="checkbox" checked={backingTrack.enabled} onChange={(e) => updateActiveBackingTrack(project.id, { enabled: e.target.checked })} />
                  <span>{isBr ? 'Ativo' : 'Actif'}</span>
                </label>
                <div className="inline-flex items-center gap-1.5 flex-1">
                  <Volume2 className="w-3.5 h-3.5 opacity-70" />
                  <input type="range" min={0} max={100} value={Math.round(backingTrack.volume * 100)} onChange={(e) => updateActiveBackingTrack(project.id, { volume: Number(e.target.value) / 100 })} className="w-full accent-[#9a3412] cursor-pointer" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
