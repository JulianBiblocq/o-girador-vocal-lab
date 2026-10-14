import React from 'react';
import { Gauge, Music2, Grid } from 'lucide-react';

interface MetricConfigPanelProps {
  bpm: number;
  onBpmChange: (bpm: number) => void;
  measuresCount: number;
  onMeasuresCountChange: (count: number) => void;
  beatResolutions: number[]; // Tableau de 4 nombres (ex: [4, 4, 4, 4])
  onBeatResolutionsChange: (resolutions: number[]) => void;
  disabled?: boolean;
}

export const MetricConfigPanel: React.FC<MetricConfigPanelProps> = ({
  bpm,
  onBpmChange,
  measuresCount,
  onMeasuresCountChange,
  beatResolutions,
  onBeatResolutionsChange,
  disabled = false,
}) => {
  const toggleBeatResolution = (beatIndex: number) => {
    if (disabled) return;
    const next = [...beatResolutions];
    next[beatIndex] = next[beatIndex] === 4 ? 3 : 4;
    onBeatResolutionsChange(next);
  };

  return (
    <div className="cordel-card p-3 flex flex-col gap-3">
      {/* 1. Réglage du Tempo & Durée du bloc */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* BPM */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-theme-ink">
              <Gauge className="w-3.5 h-3.5 text-theme-accent" />
              Tempo (BPM)
            </span>
            <input
              type="number"
              min={60}
              max={220}
              value={bpm}
              disabled={disabled}
              onChange={(e) => onBpmChange(Math.max(60, Math.min(220, Number(e.target.value) || 100)))}
              className="w-14 bg-black/30 border border-theme-border text-center font-mono font-bold text-xs p-1 focus:outline-none focus:border-theme-accent"
            />
          </div>
          <input
            type="range"
            min={60}
            max={220}
            value={bpm}
            disabled={disabled}
            onChange={(e) => onBpmChange(Number(e.target.value))}
            className="w-full accent-[var(--cordel-wood)] cursor-pointer"
          />
        </div>

        {/* Mesures de chant N */}
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-theme-ink">
            <Music2 className="w-3.5 h-3.5 text-theme-accent" />
            Mesures de Chant (N)
          </span>
          <div className="grid grid-cols-4 gap-1">
            {[1, 2, 3, 4].map((count) => (
              <button
                key={count}
                type="button"
                disabled={disabled}
                onClick={() => onMeasuresCountChange(count)}
                className={`py-1 text-xs font-bold transition-all ${
                  measuresCount === count
                    ? 'cordel-btn-primary'
                    : 'cordel-btn'
                }`}
              >
                {count} M
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Grille de métrique : Bascule Binaire (4 pas) vs Triolet (3 pas) par temps */}
      <div className="flex flex-col gap-1.5 pt-1 border-t border-theme-border/20">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-theme-ink">
          <Grid className="w-3.5 h-3.5 text-theme-accent" />
          Métrique par temps (T1 à T4)
        </span>
        <div className="grid grid-cols-4 gap-1.5">
          {beatResolutions.map((res, idx) => (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => toggleBeatResolution(idx)}
              className={`p-1.5 flex flex-col items-center justify-center text-xs font-mono transition-all ${
                res === 4 ? 'cordel-card-sm' : 'cordel-btn-primary'
              }`}
            >
              <span className="text-[10px] opacity-75">T{idx + 1}</span>
              <span className="font-bold text-xs">
                {res === 4 ? '4 (Binaire)' : '3 (Triolet)'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
