/**
 * CabineMonitoringAndPunchBar.tsx
 * Barre studio du Livret 2 (Cabine) (< 125 lignes) :
 * - Retour Casque Confort non-destructif (Off | Studio Doux | Roda Chaude + dosage)
 * - Option Baque dans le casque pendant la prise
 * - Sélecteur de reprise partielle Punch-in par mesure (Tout le bloc | Mesure 1..N)
 * - Témoin de saturation à mémoire de crête (-0.5 dBFS / Peak Hold).
 */
import React from 'react';
import { Headphones, Target, AlertTriangle, Drum } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { ComfortMonitoringPreset } from '../../audio/ComfortMonitoringNode';
import type { ListeningMode } from '../../audio/MetronomeEngine';

interface CabineMonitoringAndPunchBarProps {
  listeningMode: ListeningMode;
  comfortPreset: ComfortMonitoringPreset;
  comfortMix: number;
  onChangeComfortPreset: (preset: ComfortMonitoringPreset) => void;
  onChangeComfortMix: (mix: number) => void;
  hasBackingTrack: boolean;
  backingInHeadphones: boolean;
  onToggleBackingInHeadphones: () => void;
  measuresCount: number;
  hasRecording: boolean;
  punchMeasureIndex: number | null; // null = Tout le bloc, 1..N = Mesure K
  onChangePunchMeasureIndex: (m: number | null) => void;
  peakDb: number | null;
  hasClipped: boolean;
  onResetClipIndicator: () => void;
  disabled?: boolean;
}

export const CabineMonitoringAndPunchBar: React.FC<CabineMonitoringAndPunchBarProps> = ({
  listeningMode, comfortPreset, comfortMix, onChangeComfortPreset, onChangeComfortMix,
  hasBackingTrack, backingInHeadphones, onToggleBackingInHeadphones,
  measuresCount, hasRecording, punchMeasureIndex, onChangePunchMeasureIndex,
  peakDb, hasClipped, onResetClipIndicator, disabled,
}) => {
  const { t } = useLanguage();
  const isHeadphones = listeningMode === 'headphones';

  return (
    <div className="cordel-card-sm px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono rounded select-none">
      <div className="flex flex-wrap items-center gap-2">
        {isHeadphones && (
          <div className="flex items-center gap-1.5">
            <Headphones className="w-3.5 h-3.5 text-theme-accent" />
            <span className="font-bold text-theme-ink">{t('comfortMonitorLabel')}</span>
            <select
              value={comfortPreset}
              disabled={disabled}
              onChange={(e) => onChangeComfortPreset(e.target.value as ComfortMonitoringPreset)}
              className="px-1.5 py-0.5 cordel-card-sm rounded font-bold cursor-pointer"
            >
              <option value="off">{t('comfortPresetOff')}</option>
              <option value="studio_doux">{t('comfortPresetStudio')}</option>
              <option value="roda_chaude">{t('comfortPresetRoda')}</option>
            </select>
            {comfortPreset !== 'off' && (
              <input
                type="range" min={0.1} max={1} step={0.05} value={comfortMix}
                onChange={(e) => onChangeComfortMix(parseFloat(e.target.value))}
                className="w-14 accent-[var(--cordel-wood)] cursor-pointer"
              />
            )}
          </div>
        )}

        {isHeadphones && hasBackingTrack && (
          <button
            type="button" disabled={disabled} onClick={onToggleBackingInHeadphones}
            className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 cursor-pointer border ${backingInHeadphones ? 'bg-emerald-700 text-white border-emerald-600' : 'cordel-card-sm opacity-75'}`}
          >
            <Drum className="w-3 h-3" /><span>{t('cabineBaqueInHeadphonesBtn')}</span>
          </button>
        )}

        {measuresCount >= 2 && hasRecording && (
          <div className="flex items-center gap-1.5 border-l border-[var(--cordel-border-sub)] pl-2">
            <Target className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="font-bold">{t('punchInSelectLabel')}</span>
            <select
              value={punchMeasureIndex ?? 0}
              disabled={disabled}
              onChange={(e) => { const v = Number(e.target.value); onChangePunchMeasureIndex(v === 0 ? null : v); }}
              className="px-1.5 py-0.5 cordel-card-sm rounded font-bold text-theme-accent cursor-pointer"
            >
              <option value={0}>{t('punchInWholeBlock')}</option>
              {Array.from({ length: measuresCount }, (_, i) => (
                <option key={i + 1} value={i + 1}>{t('punchInMeasureOption', { n: i + 1 })}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {peakDb !== null && (
          <span className="text-[10.5px] font-bold text-[var(--cordel-secondary-text)]">
            Peak : <strong className={hasClipped ? 'text-red-500' : 'text-theme-ink'}>{peakDb.toFixed(1)} dB</strong>
          </span>
        )}
        {hasClipped && (
          <button
            type="button" onClick={onResetClipIndicator}
            className="px-2 py-0.5 rounded bg-red-700 text-white font-bold flex items-center gap-1 animate-pulse cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" /><span>{t('peakClipWarningBadge')}</span>
          </button>
        )}
      </div>
    </div>
  );
};

