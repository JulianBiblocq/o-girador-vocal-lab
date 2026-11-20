/**
 * ExportTwinMutualizerSection.tsx
 * Encart Cordel de mutualisation des prises répétées avant export vers Sequenciador
 * + option décochée par défaut de purge locale IndexedDB (< 120 lignes).
 */
import React, { useEffect, useRef, useState } from 'react';
import type { ToadaProject } from '../../types/toadaProject.types';
import type { UnusedPatternsSummary } from '../../utils/unusedPatternsPurger';
import { type ExportTwinChoice, type ExportTwinGroup, getEffectivePatternPcm } from '../../utils/exportTwinMutualizer';
import { getSharedAudioContext, stopAllActiveAudioEngines } from '../../audio/sharedAudioContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { MutualizeTakesIcon, PlayTriangleIcon, StopSquareIcon } from '../icons/CordelActionIcons';

interface Props {
  project: ToadaProject;
  groups: ExportTwinGroup[];
  choices: Record<string, ExportTwinChoice>;
  onChangeChoice: (groupKey: string, choice: ExportTwinChoice) => void;
  unusedSummary: UnusedPatternsSummary;
  purgeLocalUnused: boolean;
  onTogglePurgeLocalUnused: (checked: boolean) => void;
}

export const ExportTwinMutualizerSection: React.FC<Props> = ({
  project, groups, choices, onChangeChoice, unusedSummary, purgeLocalUnused, onTogglePurgeLocalUnused,
}) => {
  const { t } = useLanguage();
  const [playingPatId, setPlayingPatId] = useState<string | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);

  const stopPreview = () => {
    if (srcRef.current) {
      try { srcRef.current.stop(); } catch { /* ignore */ }
      try { srcRef.current.disconnect(); } catch { /* ignore */ }
      srcRef.current = null;
    }
    setPlayingPatId(null);
  };

  useEffect(() => () => stopPreview(), []);

  const handlePreviewBest = async (patternId: string) => {
    if (playingPatId === patternId) { stopPreview(); return; }
    stopPreview();
    stopAllActiveAudioEngines('export-twin-preview');
    const pat = project.patterns.find((p) => p.id === patternId);
    if (!pat) return;
    const { pcm, sampleRate } = getEffectivePatternPcm(pat);
    if (!pcm) return;
    const ctx = await getSharedAudioContext();
    const buf = ctx.createBuffer(1, pcm.length, sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(ctx.destination);
    src.onended = () => { srcRef.current = null; setPlayingPatId(null); };
    srcRef.current = src; setPlayingPatId(patternId);
    const startSec = Math.max(0, pat.trimStartSec || 0);
    const durSec = pat.trimEndSec && pat.trimEndSec > startSec ? pat.trimEndSec - startSec : undefined;
    src.start(0, startSec, durSec);
  };

  return (
    <div className="p-2 rounded bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] flex flex-col gap-1.5 text-[11px]">
      {groups.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 font-bold text-[#9a3412] dark:text-amber-300">
            <MutualizeTakesIcon className="w-3.5 h-3.5 shrink-0" />
            <span>{t('exportMutualizeTitle')}</span>
          </div>
          <div className="opacity-80 text-[10.5px]">{t('exportMutualizeSub')}</div>
          <div className="max-h-28 overflow-y-auto flex flex-col gap-1.5 pr-1 cordel-scrollbar">
            {groups.map((g) => {
              const cur = choices[g.groupKey] ?? g.recommendedChoice;
              const isPlaying = playingPatId === g.bestPatternId;
              const btnCls = (opt: ExportTwinChoice) =>
                `px-2 py-0.5 rounded border text-[10px] font-bold cursor-pointer transition-colors ${
                  cur === opt ? 'bg-[#9a3412] text-white border-[#9a3412]' : 'cordel-btn border-[var(--cordel-border-sub)]'
                }`;
              return (
                <div key={g.groupKey} className="p-1.5 rounded bg-[var(--cordel-surface)] border border-[var(--cordel-border-sub)] flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`px-1.5 py-0.2 text-[9px] font-black uppercase rounded text-white shrink-0 ${g.role === 'puxador' ? 'bg-role-puxador' : 'bg-role-coro'}`}>
                        {g.role === 'puxador' ? t('rolePuxador') : t('roleCoro')}
                      </span>
                      <span className="font-bold truncate">{g.displayLabel}</span>
                      {g.hasAdjacentRepeat && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-[#9a3412] dark:text-amber-300 text-[9.5px] font-bold shrink-0">
                          {t('exportMutualizeAdjacentBadge')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] opacity-75">{t('exportMutualizeOccurrences', { slots: g.slotOccurrencesCount, takes: g.distinctAudioCount })}</span>
                      <button type="button" onClick={() => handlePreviewBest(g.bestPatternId)} title={t('exportPreviewBestTakeTitle')} className="p-1 rounded cordel-btn cursor-pointer">
                        {isPlaying ? <StopSquareIcon className="w-2.5 h-2.5" /> : <PlayTriangleIcon className="w-2.5 h-2.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <button type="button" onClick={() => onChangeChoice(g.groupKey, 'single')} className={btnCls('single')}>{t('exportMutualizeOptSingle')}</button>
                    <button type="button" onClick={() => onChangeChoice(g.groupKey, 'pair_ab')} className={btnCls('pair_ab')}>{t('exportMutualizeOptPairAB')}</button>
                    <button type="button" onClick={() => onChangeChoice(g.groupKey, 'keep')} className={btnCls('keep')}>{t('exportMutualizeOptKeep', { n: g.distinctAudioCount })}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {unusedSummary.count > 0 && (
        <label className="inline-flex items-center gap-1.5 font-bold cursor-pointer select-none pt-0.5">
          <input type="checkbox" checked={purgeLocalUnused} onChange={(e) => onTogglePurgeLocalUnused(e.target.checked)} className="accent-[#9a3412]" />
          <span>{t('exportPurgeLocalUnusedLabel', { count: unusedSummary.count, mb: unusedSummary.formattedMegabytes })}</span>
        </label>
      )}

      <div className="text-[10px] opacity-75">{t('exportCloudAutoCleanHint')}</div>
    </div>
  );
};
