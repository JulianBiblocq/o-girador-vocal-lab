/**
 * LivretReglages.tsx
 * Onglet ⚙️ Réglages : Configuration technique audio, micro/casque, calibration, latence et tessiture (< 130 lignes).
 */
import React, { useState } from 'react';
import { Sliders, Headphones, Cpu, Activity, Sparkles } from 'lucide-react';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { AudioDeviceSettingsSection } from './AudioDeviceSettingsSection';
import { ListeningModePanel } from '../livret-prise/ListeningModePanel';
import { CalibrationBanner } from '../livret-prise/CalibrationBanner';
import { LatencyNudgeBar } from '../livret-prise/LatencyNudgeBar';
import { TessituraBoundsPanel } from '../livret-prise/TessituraBoundsPanel';
import { VariantConfigBar } from '../livret-prise/VariantConfigBar';
import { getSavedLatencyOffsetMs } from '../../utils/latencyStorage';
import { DEFAULT_TESSITURA, type TessituraRange } from '../../types/tessitura.types';

export const LivretReglages: React.FC = () => {
  const {
    engine, selectedDeviceId, setSelectedDeviceId,
    selectedOutputDeviceId, setSelectedOutputDeviceId,
    listeningMode, setListeningMode, recordedSampleRate,
  } = useAudioHardware();
  const {
    project, activePattern, updatePattern, updateScopedReferencePitch,
    updateScopedTessitura,
  } = useToadaProject();
  const { t, locale } = useLanguage();

  const [latencyOffsetMs, setLatencyOffsetMs] = useState(getSavedLatencyOffsetMs);
  const referencePitch = activePattern.referencePitch ?? 'C4';
  const hasRecording = activePattern.variants[activePattern.activeVariantKey]?.recordingResult !== null;

  const handleTessituraChange = (newTess: TessituraRange) => {
    updatePattern(activePattern.id, { tessitura: newTess });
    updateScopedTessitura(newTess);
  };

  const pCfg = activePattern.variantPitchesConfig ?? { refSemitones: 0, lowSemitones: -3, highSemitones: 3, enableHigh: false };
  const sCfg = activePattern.variantSpeedsConfig ?? { speed1Pct: 100, speed2Pct: 80, speed3Pct: 120, enableSpeed3: false };

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* En-tête des Réglages */}
      <div className="cordel-card p-3 sm:p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-theme-accent" />
          <h2 className="font-mono font-bold text-sm sm:text-base uppercase tracking-wider text-theme-ink">
            {t('reglagesTitle')}
          </h2>
        </div>
        <span className="text-xs font-mono text-[var(--cordel-secondary-text)] hidden sm:inline">
          {activePattern.name} • {recordedSampleRate} Hz
        </span>
      </div>

      {/* Grille principale des réglages techniques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-stretch">
        {/* Colonne 1 : Périphériques Audio & Test */}
        <div className="flex flex-col gap-4">
          <div className="text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 text-theme-accent">
            <Cpu className="w-4 h-4" /><span>{t('reglagesAudioSection')}</span>
          </div>
          <AudioDeviceSettingsSection
            selectedDeviceId={selectedDeviceId}
            onDeviceChange={setSelectedDeviceId}
            selectedOutputDeviceId={selectedOutputDeviceId}
            onOutputDeviceChange={setSelectedOutputDeviceId}
          />
          <CalibrationBanner
            inputDeviceId={selectedDeviceId}
            outputDeviceId={selectedOutputDeviceId}
            sampleRate={recordedSampleRate}
            onCalibrationComplete={() => {}}
          />
          <div className="cordel-card p-3">
            <LatencyNudgeBar latencyOffsetMs={latencyOffsetMs} onChange={setLatencyOffsetMs} />
          </div>
        </div>

        {/* Colonne 2 : Mode d'écoute, Diapason & Tessiture */}
        <div className="flex flex-col gap-4">
          <div className="text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 text-theme-accent">
            <Headphones className="w-4 h-4" /><span>{t('reglagesListeningSection')}</span>
          </div>
          <ListeningModePanel
            listeningMode={listeningMode}
            onListeningModeChange={setListeningMode}
            referencePitch={referencePitch}
            onReferencePitchChange={(p) => { updatePattern(activePattern.id, { referencePitch: p }); updateScopedReferencePitch(p); }}
            onPlayReferencePreview={() => engine.playReferencePitchPreview(referencePitch, 1.5, selectedOutputDeviceId)}
          />

          <div className="text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 text-theme-accent pt-1">
            <Activity className="w-4 h-4" /><span>{t('reglagesTessituraSection')}</span>
          </div>
          <TessituraBoundsPanel
            tessitura={activePattern.tessitura ?? DEFAULT_TESSITURA}
            onChange={handleTessituraChange}
            hasRecording={hasRecording}
          />

          <div className="cordel-card p-3 flex flex-col gap-2">
            <span className="text-[11px] font-mono font-bold uppercase text-[var(--cordel-secondary-text)] flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Paramètres par défaut des Déclinaisons</span>
            </span>
            <VariantConfigBar
              refSemitones={pCfg.refSemitones} lowSemitones={pCfg.lowSemitones} highSemitones={pCfg.highSemitones}
              enableHighPitch={pCfg.enableHigh} speed2Pct={sCfg.speed2Pct} speed3Pct={sCfg.speed3Pct} enableSpeed3={sCfg.enableSpeed3}
              baseBpm={activePattern.baseBpm ?? project.bpm} referencePitch={referencePitch} locale={locale}
              onRefSemitonesChange={(v) => updatePattern(activePattern.id, { variantPitchesConfig: { ...pCfg, refSemitones: v } })}
              onLowSemitonesChange={(v) => updatePattern(activePattern.id, { variantPitchesConfig: { ...pCfg, lowSemitones: v } })}
              onHighSemitonesChange={(v) => updatePattern(activePattern.id, { variantPitchesConfig: { ...pCfg, highSemitones: v } })}
              onToggleHighPitch={() => updatePattern(activePattern.id, { variantPitchesConfig: { ...pCfg, enableHigh: !pCfg.enableHigh } })}
              onSpeed2Change={(v) => updatePattern(activePattern.id, { variantSpeedsConfig: { ...sCfg, speed2Pct: v } })}
              onSpeed3Change={(v) => updatePattern(activePattern.id, { variantSpeedsConfig: { ...sCfg, speed3Pct: v } })}
              onToggleSpeed3={() => updatePattern(activePattern.id, { variantSpeedsConfig: { ...sCfg, enableSpeed3: !sCfg.enableSpeed3 } })}
              t={t}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
