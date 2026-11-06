/**
 * ConductorLiveTempoControl.tsx
 * Contrôle Live du tempo (BPM Varispeed) avec bouton d'application au projet [✓] (< 65 lignes).
 */
import React from 'react';
import { Zap, Check } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface ConductorLiveTempoControlProps {
  liveBpm: number;
  projectBpm?: number;
  onBpmChange: (bpm: number) => void;
  onApplyBpmToProject?: (bpm: number) => void;
  disabled?: boolean;
}

export const ConductorLiveTempoControl: React.FC<ConductorLiveTempoControlProps> = ({
  liveBpm, projectBpm, onBpmChange, onApplyBpmToProject, disabled = false,
}) => {
  const { t } = useLanguage();
  const nudge = (delta: number) => {
    onBpmChange(Math.max(40, Math.min(220, liveBpm + delta)));
  };
  const isModified = projectBpm !== undefined && liveBpm !== projectBpm;

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-[var(--cordel-border-panel)] bg-[var(--cordel-surface)] text-[11px] font-mono select-none">
      <span className="font-bold flex items-center gap-1 text-[#9a3412] dark:text-amber-300 uppercase tracking-wider text-[10px]">
        <Zap className="w-3 h-3 fill-current" />
        <span>{t('conductorLiveTempoLabel')}</span>
      </span>
      <button type="button" disabled={disabled} onClick={() => nudge(-5)} className="px-1 py-0.2 cordel-card-sm rounded hover:bg-amber-500/20 font-bold text-[10px] cursor-pointer" title="-5 BPM">-5</button>
      <button type="button" disabled={disabled} onClick={() => nudge(-1)} className="px-1 py-0.2 cordel-card-sm rounded hover:bg-amber-500/20 font-bold text-[10px] cursor-pointer" title="-1 BPM">-1</button>
      <input
        type="range" min={45} max={180} value={liveBpm} disabled={disabled}
        onChange={(e) => onBpmChange(Number(e.target.value))}
        className="w-16 h-1.5 accent-[#9a3412] cursor-pointer"
      />
      <button type="button" disabled={disabled} onClick={() => nudge(1)} className="px-1 py-0.2 cordel-card-sm rounded hover:bg-amber-500/20 font-bold text-[10px] cursor-pointer" title="+1 BPM">+1</button>
      <button type="button" disabled={disabled} onClick={() => nudge(5)} className="px-1 py-0.2 cordel-card-sm rounded hover:bg-amber-500/20 font-bold text-[10px] cursor-pointer" title="+5 BPM">+5</button>
      <span className="font-bold text-theme-ink w-14 text-right tabular-nums">{liveBpm} BPM</span>
      {isModified && onApplyBpmToProject && (
        <button
          type="button" onClick={() => onApplyBpmToProject(liveBpm)}
          title={t('conductorApplyLiveTempoTitle', { bpm: liveBpm })}
          className="px-1.5 py-0.2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold rounded flex items-center cursor-pointer"
        >
          <Check className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
