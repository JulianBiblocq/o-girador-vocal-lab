/**
 * WaveformZoomBar.tsx
 * Barre d'outils compacte de zoom horizontal (1x à 8x) et de centrage sur les trims (i18n pur via t).
 */
import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

interface WaveformZoomBarProps {
  zoomLevel: number;
  onSetZoom: (zoom: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSeeStart: () => void;
  onSeeEnd: () => void;
}

export const WaveformZoomBar: React.FC<WaveformZoomBarProps> = ({
  zoomLevel, onSetZoom, onZoomIn, onZoomOut, onSeeStart, onSeeEnd,
}) => {
  const { t } = useLanguage();
  const presets = [1, 2, 4, 8];

  return (
    <div className="flex flex-wrap items-center justify-between gap-1.5 px-2 py-1 bg-black/40 border border-theme-border/40 rounded-lg text-xs">
      <div className="flex items-center gap-1">
        <span className="text-[11px] font-mono text-theme-ink/70 font-semibold mr-1">ZOOM</span>
        <button
          type="button"
          onClick={onZoomOut}
          disabled={zoomLevel <= 1.05}
          title={t('zoomOutTitle')}
          className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-theme-ink font-mono"
        >
          🔍-
        </button>
        {presets.map((preset) => {
          const isActive = Math.abs(zoomLevel - preset) < 0.1;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onSetZoom(preset)}
              className={`px-2 py-0.5 rounded font-mono text-[11px] transition-colors ${
                isActive
                  ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500/50 shadow-sm'
                  : 'bg-white/5 hover:bg-white/10 text-theme-ink/80'
              }`}
            >
              {preset === 1 ? t('zoomComplete') : `${preset}x`}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onZoomIn}
          disabled={zoomLevel >= 7.95}
          title={t('zoomInTitle')}
          className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-theme-ink font-mono"
        >
          🔍+
        </button>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <button
          type="button"
          onClick={onSeeStart}
          title={t('zoomSeeStartTitle')}
          className="px-2 py-0.5 rounded bg-sky-950/60 border border-sky-500/40 text-sky-300 hover:bg-sky-900/60 font-mono text-[11px] flex items-center gap-1 transition-all active:scale-95"
        >
          {t('zoomSeeStart')}
        </button>
        <button
          type="button"
          onClick={onSeeEnd}
          title={t('zoomSeeEndTitle')}
          className="px-2 py-0.5 rounded bg-red-950/60 border border-red-500/40 text-red-300 hover:bg-red-900/60 font-mono text-[11px] flex items-center gap-1 transition-all active:scale-95"
        >
          {t('zoomSeeEnd')}
        </button>
      </div>
    </div>
  );
};
