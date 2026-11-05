/**
 * MelodyneControlsBar.tsx
 * Barre de contrôle des Régions Melodyne Studio 2.0 (3 DDL + Auto-Justesse Douce) (< 138 lignes).
 */
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { CordelSpark } from '../common/CordelIcons';
import { Plus, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import type { MelodyneRegion } from '../../types/vocalPack.types';

interface MelodyneControlsBarProps {
  selectedRegion: MelodyneRegion | null; regionsCount: number; isProcessing?: boolean; isToolActive: boolean;
  onActivateTool: () => void; onAddWholePhrase: () => void; onAutoSweetSpot?: () => void;
  onUpdateSelected: (partial: Partial<MelodyneRegion>) => void; onDeleteSelected: () => void;
  onShiftOctave?: (delta: -1 | 1) => void; onAlignOctaveToBricks?: () => void; onClearAllMelodyne?: () => void;
}

export const MelodyneControlsBar: React.FC<MelodyneControlsBarProps> = ({
  selectedRegion, regionsCount, isProcessing = false, isToolActive,
  onActivateTool, onAddWholePhrase, onAutoSweetSpot, onUpdateSelected, onDeleteSelected,
  onShiftOctave, onAlignOctaveToBricks, onClearAllMelodyne,
}) => {
  const { t } = useLanguage();
  const driftPct = selectedRegion ? (selectedRegion.driftCorrectionPct ?? 80) : 80;
  const rangeCls = 'w-full cursor-pointer h-1.5 bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] rounded';

  return (
    <div className="cordel-card p-2 w-full flex flex-wrap items-center justify-between gap-2.5 select-none rounded">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-bold text-theme-accent flex items-center gap-1.5 uppercase">
          <CordelSpark className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>{t('melodyneTitle')}</span>
        </span>
        {selectedRegion ? (
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[9.5px] font-mono font-bold bg-amber-500/15 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border border-amber-500/40 rounded">
              {t('melodyneZoneActiveBadge', { start: selectedRegion.startSec.toFixed(2), end: selectedRegion.endSec.toFixed(2) })}
            </span>
            <span className="text-[10px] font-mono text-amber-800 dark:text-amber-300/80 hidden 2xl:inline">• {t('melodyneZoneHelpHint')}</span>
          </div>
        ) : (
          <span className="text-[10px] font-mono text-theme-ink/60 italic hidden sm:inline">
            {regionsCount > 0 ? `${regionsCount} zone(s) - ${t('melodyneZoneHelpHint')}` : t('melodyneNoZoneSelected')}
          </span>
        )}
      </div>

      {selectedRegion && (
        <div className="flex-1 min-w-[300px] max-w-2xl flex items-center gap-2.5 px-1">
          <div className="flex-1 flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-theme-ink">
              <span>{t('melodynePitchCenter', { percent: selectedRegion.pitchCenterPct })}</span>
              {isProcessing && <Loader2 className="w-3 h-3 animate-spin text-amber-600 dark:text-amber-400" />}
            </div>
            <input type="range" min={0} max={100} step={1} value={selectedRegion.pitchCenterPct} onChange={(e) => onUpdateSelected({ pitchCenterPct: Number(e.target.value) })} className={`${rangeCls} accent-[var(--cordel-wood)]`} />
          </div>
          <div className="flex-1 flex flex-col gap-0.5 border-l border-theme-border/40 pl-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-theme-ink">
              <span>{t('melodyneDriftLabel', { percent: driftPct })}</span>
            </div>
            <input type="range" min={0} max={100} step={1} value={driftPct} onChange={(e) => onUpdateSelected({ driftCorrectionPct: Number(e.target.value) })} className={`${rangeCls} accent-emerald-600`} />
          </div>
          <div className="flex-1 flex flex-col gap-0.5 border-l border-theme-border/40 pl-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-theme-ink">
              <span>{t('melodyneFlatten', { percent: selectedRegion.flattenPct })}</span>
            </div>
            <input type="range" min={0} max={100} step={1} value={selectedRegion.flattenPct} onChange={(e) => onUpdateSelected({ flattenPct: Number(e.target.value) })} className={`${rangeCls} accent-amber-500`} />
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {onAutoSweetSpot && (
          <button
            type="button" onClick={onAutoSweetSpot} title={t('melodyneAutoSweetTitle')}
            className="px-2.5 py-1 text-[10.5px] font-mono font-bold bg-emerald-700 hover:bg-emerald-800 text-[#f4ecd8] border border-emerald-900/50 shadow-sm cursor-pointer rounded transition-colors"
          ><span>{t('melodyneAutoSweetBtn')}</span></button>
        )}

        {onShiftOctave && (
          <div className="flex items-center gap-1 border-r border-theme-border/40 pr-1.5">
            <button type="button" onClick={() => onShiftOctave(-1)} className="cordel-btn px-2 py-1 text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300 border border-amber-500/40 cursor-pointer rounded"><span>{t('melodyneShiftDownOct')}</span></button>
            <button type="button" onClick={() => onShiftOctave(1)} className="cordel-btn px-2 py-1 text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300 border border-amber-500/40 cursor-pointer rounded"><span>{t('melodyneShiftUpOct')}</span></button>
          </div>
        )}

        {onAlignOctaveToBricks && (
          <button type="button" onClick={onAlignOctaveToBricks} className="btn-octave-align px-2 py-1 text-[10px] font-mono font-bold cursor-pointer rounded transition-colors"><span>{t('melodyneAlignToBricks')}</span></button>
        )}

        <button
          type="button" onClick={onActivateTool}
          className={`px-2.5 py-1 text-[10.5px] font-mono font-bold flex items-center gap-1 cursor-pointer rounded border ${isToolActive ? 'bg-[#9a3412] text-[#f4ecd8] border border-[#9a3412] shadow-sm' : 'cordel-btn'}`}
        ><Plus className="w-3 h-3" /><span>{t('melodyneCreateZoneBtn')}</span></button>

        <button type="button" onClick={onAddWholePhrase} className="cordel-btn px-2 py-1 text-[10px] font-mono font-bold cursor-pointer rounded"><span>{t('melodyneWholePhraseBtn')}</span></button>

        {selectedRegion && (
          <>
            <button
              type="button" onClick={() => onUpdateSelected({ pitchCenterPct: 0, driftCorrectionPct: 0, flattenPct: 0 })}
              className="cordel-btn px-2 py-1 text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer rounded" title={t('melodyneResetZoneBtn')}
            ><RotateCcw className="w-3 h-3" /><span className="hidden sm:inline">0%</span></button>
            <button
              type="button" onClick={onDeleteSelected} title={t('melodyneDeleteZoneBtn')}
              className="cordel-btn px-2 py-1 text-[10px] font-mono font-bold text-red-700 dark:text-red-300 hover:bg-red-500/10 border-red-500/30 flex items-center gap-1 cursor-pointer rounded"
            ><Trash2 className="w-3 h-3" /></button>
          </>
        )}

        {regionsCount > 0 && onClearAllMelodyne && (
          <button
            type="button" onClick={onClearAllMelodyne} title={t('melodynePurgeTooltip')}
            className="cordel-btn px-2 py-1 text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300 border-amber-600/40 cursor-pointer rounded"
          ><span>{t('melodynePurgeBtn')}</span></button>
        )}
      </div>
    </div>
  );
};
