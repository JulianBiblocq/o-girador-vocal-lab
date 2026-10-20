/**
 * SlicerWarpControls.tsx
 * Panneau de controle du Time-Warp elastique et de la métrique (< 125 lignes).
 */
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

interface SlicerWarpControlsProps {
  phraseBpm: number; warpPct: number; measuresCount: 1 | 2 | 3 | 4; hasAnacrusis: boolean;
  onBpmNudge: (delta: number) => void; onWarpPctChange: (pct: number) => void;
  onMeasuresCountChange: (m: 1 | 2 | 3 | 4) => void; onHasAnacrusisChange: (has: boolean) => void;
}

export const SlicerWarpControls: React.FC<SlicerWarpControlsProps> = ({
  phraseBpm, warpPct, measuresCount, hasAnacrusis,
  onBpmNudge, onWarpPctChange, onMeasuresCountChange, onHasAnacrusisChange
}) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col gap-2.5 p-3 cordel-card rounded text-xs font-mono">
      {/* 1. Ligne Tempo moyen et micro-calage */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-bold text-theme-accent">
          {t('slicerAverageBpm', { bpm: phraseBpm.toFixed(1) })}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button" onClick={() => onBpmNudge(-0.5)}
            className="h-7 px-2 cordel-btn rounded text-[11px] font-bold cursor-pointer"
            title="Ralentir le tempo de 0.5 BPM"
          >
            -0.5
          </button>
          <button
            type="button" onClick={() => onBpmNudge(0.5)}
            className="h-7 px-2 cordel-btn rounded text-[11px] font-bold cursor-pointer"
            title="Accélérer le tempo de 0.5 BPM"
          >
            +0.5
          </button>
        </div>
      </div>

      {/* 2. Curseur Time-Warp Elastique WSOLA */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-bold text-theme-ink">{t('slicerTimeWarpLabel')} : {warpPct} %</span>
          <span className="text-[10px] text-theme-ink/60">{warpPct === 0 ? t('slicerWarpRaw') : warpPct === 100 ? t('slicerWarpStrict') : 'Compromis naturel'}</span>
        </div>
        <input
          type="range" min={0} max={100} step={5} value={warpPct}
          onChange={(e) => onWarpPctChange(Number(e.target.value))}
          onMouseUp={(e) => e.currentTarget.blur()} onTouchEnd={(e) => e.currentTarget.blur()}
          className="w-full accent-[var(--cordel-wood)] cursor-pointer h-1.5 rounded"
        />
      </div>

      {/* 3. Choix des Mesures & Anacrouse */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--cordel-border-sub)]">
        <div className="flex items-center gap-1.5">
          <span className="text-theme-ink/70">Mesures :</span>
          {([1, 2, 3, 4] as const).map((m) => (
            <button
              key={m} type="button" onClick={() => onMeasuresCountChange(m)}
              className={`w-7 h-7 rounded text-xs font-bold cursor-pointer transition-colors ${
                measuresCount === m ? 'bg-theme-wood text-[#f4ecd8] font-black' : 'cordel-btn opacity-70 hover:opacity-100'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-theme-ink/70">{t('anacrusisOption')} :</span>
          <button
            type="button" onClick={() => onHasAnacrusisChange(!hasAnacrusis)}
            className={`h-7 px-2 rounded text-xs font-bold cursor-pointer transition-colors ${
              hasAnacrusis ? 'bg-[#9a3412] text-[#f4ecd8] border border-[#9a3412]' : 'cordel-btn opacity-70'
            }`}
          >
            {hasAnacrusis ? t('hasAnacrusisYes') : t('hasAnacrusisNo')}
          </button>
        </div>
      </div>
    </div>
  );
};
