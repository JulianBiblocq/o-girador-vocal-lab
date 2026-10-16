/**
 * MelodyneControlsBar.tsx
 * Barre de contrôle des Régions Melodyne [ In ── Out ] & Aiguillage d'Octave :
 * Justesse, Stabilité, +/-1 Octave, Aimant Briques et actions rapides (< 135 lignes).
 */
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { CordelSpark } from '../common/CordelIcons';
import { Plus, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import type { MelodyneRegion } from '../../types/vocalPack.types';

interface MelodyneControlsBarProps {
  selectedRegion: MelodyneRegion | null;
  regionsCount: number;
  isProcessing?: boolean;
  isToolActive: boolean;
  onActivateTool: () => void;
  onAddWholePhrase: () => void;
  onUpdateSelected: (partial: Partial<MelodyneRegion>) => void;
  onDeleteSelected: () => void;
  onShiftOctave?: (delta: -1 | 1) => void;
  onAlignOctaveToBricks?: () => void;
  onClearAllMelodyne?: () => void;
}

export const MelodyneControlsBar: React.FC<MelodyneControlsBarProps> = ({
  selectedRegion, regionsCount, isProcessing = false, isToolActive,
  onActivateTool, onAddWholePhrase, onUpdateSelected, onDeleteSelected,
  onShiftOctave, onAlignOctaveToBricks, onClearAllMelodyne,
}) => {
  const { t } = useLanguage();

  return (
    <div className="cordel-card p-2 w-full flex flex-wrap items-center justify-between gap-3 bg-black/60 border border-theme-border/60 select-none rounded-none">
      {/* 1. Titre & Badge d'état de zone */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono font-bold text-theme-accent flex items-center gap-1.5 uppercase">
          <CordelSpark className="w-3.5 h-3.5 text-amber-500" />
          <span>{t('melodyneTitle')}</span>
        </span>
        {selectedRegion ? (
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[9.5px] font-mono font-bold bg-amber-950/70 text-amber-300 border border-amber-500/40">
              {t('melodyneZoneActiveBadge', { start: selectedRegion.startSec.toFixed(2), end: selectedRegion.endSec.toFixed(2) })}
            </span>
            <span className="text-[10px] font-mono text-amber-300/80 hidden 2xl:inline">• {t('melodyneZoneHelpHint')}</span>
          </div>
        ) : (
          <span className="text-[10px] font-mono text-theme-ink/60 italic hidden sm:inline">
            {regionsCount > 0 ? `${regionsCount} zone(s) - ${t('melodyneZoneHelpHint')}` : t('melodyneNoZoneSelected')}
          </span>
        )}
      </div>

      {/* 2. Les 2 Curseurs (Justesse, Stabilité) si une zone est sélectionnée */}
      {selectedRegion && (
        <div className="flex-1 min-w-[260px] max-w-lg flex items-center gap-3 px-1">
          <div className="flex-1 flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-[10.5px] font-mono font-bold text-theme-ink">
              <span>{t('melodynePitchCenter', { percent: selectedRegion.pitchCenterPct })}</span>
              {isProcessing && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
            </div>
            <input
              type="range" min={0} max={100} step={1} value={selectedRegion.pitchCenterPct}
              onChange={(e) => onUpdateSelected({ pitchCenterPct: Number(e.target.value) })}
              className="w-full accent-[var(--cordel-wood)] cursor-pointer h-1.5 bg-black/40 border border-theme-border/40"
            />
          </div>
          <div className="flex-1 flex flex-col gap-0.5 border-l border-theme-border/40 pl-3">
            <div className="flex items-center justify-between text-[10.5px] font-mono font-bold text-theme-ink">
              <span>{t('melodyneFlatten', { percent: selectedRegion.flattenPct })}</span>
            </div>
            <input
              type="range" min={0} max={100} step={1} value={selectedRegion.flattenPct}
              onChange={(e) => onUpdateSelected({ flattenPct: Number(e.target.value) })}
              className="w-full accent-amber-500 cursor-pointer h-1.5 bg-black/40 border border-theme-border/40"
            />
          </div>
        </div>
      )}

      {/* 3. Boutons d'action rapide & Aiguillage d'Octave */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {onShiftOctave && (
          <div className="flex items-center gap-1 border-r border-theme-border/40 pr-1.5">
            <button type="button" onClick={() => onShiftOctave(-1)} className="px-2 py-1 text-[10px] font-mono font-bold bg-[#1e293b] hover:bg-[#334155] text-amber-300 border border-amber-500/40 cursor-pointer rounded-none" title={selectedRegion ? `Courbe -1 Oct (${selectedRegion.startSec}s-${selectedRegion.endSec}s)` : 'Courbe -1 Oct phrase'}>
              <span>{t('melodyneShiftDownOct')}</span>
            </button>
            <button type="button" onClick={() => onShiftOctave(1)} className="px-2 py-1 text-[10px] font-mono font-bold bg-[#1e293b] hover:bg-[#334155] text-amber-300 border border-amber-500/40 cursor-pointer rounded-none" title={selectedRegion ? `Courbe +1 Oct (${selectedRegion.startSec}s-${selectedRegion.endSec}s)` : 'Courbe +1 Oct phrase'}>
              <span>{t('melodyneShiftUpOct')}</span>
            </button>
          </div>
        )}

        {onAlignOctaveToBricks && (
          <button
            type="button" onClick={onAlignOctaveToBricks}
            className="btn-octave-align px-2 py-1 text-[10px] font-mono font-bold cursor-pointer rounded-none transition-colors"
            title="Aimanter l'octave de la courbe verte vers les briques MIDI"
          ><span>{t('melodyneAlignToBricks')}</span></button>
        )}

        <button
          type="button" onClick={onActivateTool}
          className={`px-2.5 py-1 text-[10.5px] font-mono font-bold flex items-center gap-1 cursor-pointer rounded-none border ${
            isToolActive ? 'bg-[#9a3412] text-[#f4ecd8] border-2 border-[#1a1a1a] shadow-sm' : 'bg-white/5 hover:bg-white/10 text-theme-ink/80 border-theme-border/40'
          }`}
        >
          <Plus className="w-3 h-3" />
          <span>{t('melodyneCreateZoneBtn')}</span>
        </button>

        <button
          type="button" onClick={onAddWholePhrase}
          className="px-2 py-1 text-[10px] font-mono font-bold bg-white/5 hover:bg-white/10 text-theme-ink/75 border border-theme-border/40 cursor-pointer rounded-none"
        ><span>{t('melodyneWholePhraseBtn')}</span></button>

        {selectedRegion && (
          <>
            <button
              type="button" onClick={() => onUpdateSelected({ pitchCenterPct: 0, flattenPct: 0 })}
              className="px-2 py-1 text-[10px] font-mono font-bold bg-white/5 hover:bg-white/10 text-theme-ink/70 border border-theme-border/40 flex items-center gap-1 cursor-pointer rounded-none"
              title={t('melodyneResetZoneBtn')}
            ><RotateCcw className="w-3 h-3" /><span className="hidden sm:inline">0%</span></button>
            <button
              type="button" onClick={onDeleteSelected}
              className="px-2 py-1 text-[10px] font-mono font-bold bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-500/40 flex items-center gap-1 cursor-pointer rounded-none"
              title={t('melodyneDeleteZoneBtn')}
            ><Trash2 className="w-3 h-3" /></button>
          </>
        )}

        {regionsCount > 0 && onClearAllMelodyne && (
          <button
            type="button" onClick={onClearAllMelodyne}
            className="px-2 py-1 text-[10px] font-mono font-bold bg-amber-950/40 hover:bg-amber-900/60 text-amber-200 border border-amber-600/40 cursor-pointer rounded-none"
            title={t('melodynePurgeTooltip')}
          ><span>{t('melodynePurgeBtn')}</span></button>
        )}
      </div>
    </div>
  );
};
