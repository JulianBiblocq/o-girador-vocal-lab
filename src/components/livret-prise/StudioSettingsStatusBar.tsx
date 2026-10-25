/**
 * StudioSettingsStatusBar.tsx
 * Bandeau compact d'état matériel studio renvoyant en 1 clic vers l'onglet Réglages (< 55 lignes).
 */
import React from 'react';
import { Mic, Headphones, VolumeX, Sliders } from 'lucide-react';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { useLanguage } from '../../i18n/LanguageContext';

export const StudioSettingsStatusBar: React.FC = () => {
  const { listeningMode, selectedDeviceLabel } = useAudioHardware();
  const { activePattern } = useToadaProject();
  const { setActiveLivret } = useVocalTransportStore();
  const { t } = useLanguage();

  const tessituraLabel = activePattern.tessitura?.presetId
    ? activePattern.tessitura.presetId.charAt(0).toUpperCase() + activePattern.tessitura.presetId.slice(1)
    : 'Médium';

  return (
    <div className="cordel-card-sm px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono select-none rounded">
      <div className="flex items-center gap-3 text-[var(--cordel-secondary-text)] flex-wrap">
        <span className="flex items-center gap-1 max-w-[200px] sm:max-w-[300px]" title={selectedDeviceLabel || t('statusMicDefault')}>
          <Mic className="w-3.5 h-3.5 text-theme-accent shrink-0" />
          <span className="truncate font-bold text-theme-ink">{selectedDeviceLabel || t('statusMicDefault')}</span>
        </span>
        <span>•</span>
        <span className="flex items-center gap-1">
          {listeningMode === 'headphones' ? (
            <><Headphones className="w-3.5 h-3.5 text-theme-accent" /><span>{t('statusHeadphonesOn')}</span></>
          ) : (
            <><VolumeX className="w-3.5 h-3.5 text-theme-wood" /><span>{t('statusVisualMode')}</span></>
          )}
        </span>
        <span>•</span>
        <span>{t('statusTessituraLabel')} : <strong className="text-theme-ink">{tessituraLabel}</strong></span>
      </div>

      <button
        type="button"
        onClick={() => setActiveLivret('reglages')}
        className="px-2 py-0.5 cordel-btn text-[10.5px] font-bold flex items-center gap-1 cursor-pointer"
        title="Ouvrir les réglages techniques"
      >
        <Sliders className="w-3 h-3 text-theme-accent" />
        <span>{t('statusQuickEditBtn')}</span>
      </button>
    </div>
  );
};
