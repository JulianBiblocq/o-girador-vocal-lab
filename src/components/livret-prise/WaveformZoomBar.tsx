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
    <div className="cordel-card-sm flex flex-wrap items-center justify-between gap-1.5 px-2 py-1 text-xs rounded">
      <div className="flex items-center gap-1">
        <span className="text-[11px] font-mono text-theme-ink/70 font-semibold mr-1">ZOOM</span>
        <button
          type="button"
          onClick={onZoomOut}
          disabled={zoomLevel <= 1.05}
          title={t('zoomOutTitle')}
          className="cordel-btn px-2 py-0.5 rounded active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed font-mono text-[11px]"
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
              className={`px-2 py-0.5 rounded font-mono text-[11px] transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#9a3412] text-[#f4ecd8] font-bold border border-[#9a3412]'
                  : 'cordel-btn'
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
          className="cordel-btn px-2 py-0.5 rounded active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed font-mono text-[11px]"
        >
          🔍+
        </button>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        <button
          type="button"
          onClick={onSeeStart}
          title={t('zoomSeeStartTitle')}
          className="px-2 py-0.5 rounded bg-[#0f766e] border border-[#0f766e] text-[#f4ecd8] hover:bg-[#115e59] font-mono text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
        >
          {t('zoomSeeStart')}
        </button>
        <button
          type="button"
          onClick={onSeeEnd}
          title={t('zoomSeeEndTitle')}
          className="px-2 py-0.5 rounded bg-[#b45309] border border-[#b45309] text-[#f4ecd8] hover:bg-[#92400e] font-mono text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
        >
          {t('zoomSeeEnd')}
        </button>
      </div>
    </div>
  );
};
