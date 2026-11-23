/**
 * LivretReglages.tsx
 * Onglet Réglages : Micro/Casque, Latence (saveLatencyOffsetMs), Diapason Hz (Studio) & Déclinaisons (< 138 lignes).
 * Épuré automatiquement des options Studio lorsque viewRoleMode === 'eleve'.
 */
import React, { useState, useEffect } from 'react';
import { Sliders, Headphones, Cpu, Activity, VolumeX } from 'lucide-react';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useToadaProject } from '../../context/ToadaProjectContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { useLanguage } from '../../i18n/LanguageContext';
import { AudioDeviceSettingsSection } from './AudioDeviceSettingsSection';
import { ListeningModePanel } from '../livret-prise/ListeningModePanel';
import { CalibrationBanner } from '../livret-prise/CalibrationBanner';
import { LatencyNudgeBar } from '../livret-prise/LatencyNudgeBar';
import { TessituraBoundsPanel } from '../livret-prise/TessituraBoundsPanel';
import { VariantConfigBar } from '../livret-prise/VariantConfigBar';
import { MicGainAssistantCard } from './MicGainAssistantCard';
import { CordelAccordion } from '../common/CordelAccordion';
import { NumericDraftInput } from '../ui/NumericDraftInput';
import { getSavedLatencyOffsetMs, saveLatencyOffsetMs } from '../../utils/latencyStorage';
import { buildDeviceSignature } from '../../utils/deviceSignature';
import { DEFAULT_REFERENCE_PITCH_HZ, MIN_REFERENCE_PITCH_HZ, MAX_REFERENCE_PITCH_HZ, sanitizePitchHz } from '../../utils/pitchHzContract';
import { DEFAULT_TESSITURA, type TessituraRange } from '../../types/tessitura.types';

export const LivretReglages: React.FC = () => {
  const {
    engine, selectedDeviceId, setSelectedDeviceId,
    selectedOutputDeviceId, setSelectedOutputDeviceId,
    listeningMode, setListeningMode, recordedSampleRate,
  } = useAudioHardware();
  const { project, activePattern, loadProject, updatePattern, updateScopedReferencePitch, updateScopedTessitura } = useToadaProject();
  const viewRoleMode = useVocalTransportStore((s) => s.viewRoleMode);
  const { t, locale } = useLanguage();
  const isEleve = viewRoleMode === 'eleve';

  const sig = buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, recordedSampleRate);
  const [latencyOffsetMs, setLatencyOffsetMs] = useState(() => getSavedLatencyOffsetMs(sig));

  useEffect(() => { setLatencyOffsetMs(getSavedLatencyOffsetMs(sig)); }, [sig]);

  const referencePitch = activePattern.referencePitch ?? 'C4';
  const pitchHz = sanitizePitchHz(project.referencePitchHz ?? project.toadaMeta?.referencePitchHz ?? DEFAULT_REFERENCE_PITCH_HZ);
  const hasRecording = activePattern.variants[activePattern.activeVariantKey]?.recordingResult !== null;
  const pCfg = activePattern.variantPitchesConfig ?? { refSemitones: 0, lowSemitones: -3, highSemitones: 3, enableHigh: false };
  const sCfg = activePattern.variantSpeedsConfig ?? { speed1Pct: 100, speed2Pct: 80, speed3Pct: 120, enableSpeed3: false };

  const handleTessituraChange = (newTess: TessituraRange) => {
    updatePattern(activePattern.id, { tessitura: newTess });
    updateScopedTessitura(newTess);
  };

  const handlePitchHzChange = (val: number) => {
    const cleanHz = sanitizePitchHz(val);
    loadProject({ ...project, referencePitchHz: cleanHz, toadaMeta: { ...(project.toadaMeta || {}), referencePitchHz: cleanHz } });
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-5xl mx-auto my-2">
      <div className="cordel-card p-3 sm:p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-theme-accent" />
          <h2 className="font-mono font-bold text-sm sm:text-base uppercase tracking-wider text-theme-ink">
            {isEleve ? t('btnStudentMicHeadphones') : t('reglagesTitle')}
          </h2>
        </div>
        <span className="text-xs font-mono text-[var(--cordel-secondary-text)] hidden sm:inline">{recordedSampleRate} Hz</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-start">
        <div className="flex flex-col gap-4">
          <div className="text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 text-theme-accent">
            <Cpu className="w-4 h-4" /><span>{t('reglagesAudioSection')}</span>
          </div>
          <AudioDeviceSettingsSection selectedDeviceId={selectedDeviceId} onDeviceChange={setSelectedDeviceId} selectedOutputDeviceId={selectedOutputDeviceId} onOutputDeviceChange={setSelectedOutputDeviceId} />
          <MicGainAssistantCard selectedDeviceId={selectedDeviceId} />
          <CalibrationBanner inputDeviceId={selectedDeviceId} outputDeviceId={selectedOutputDeviceId} sampleRate={recordedSampleRate} onCalibrationComplete={(ms) => { setLatencyOffsetMs(ms); saveLatencyOffsetMs(ms, sig); }} />
          <div className="cordel-card p-3">
            <LatencyNudgeBar latencyOffsetMs={latencyOffsetMs} onChange={setLatencyOffsetMs} persistToStorage={true} />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 text-theme-accent">
            <Headphones className="w-4 h-4" /><span>{t('reglagesListeningSection')}</span>
          </div>
          {isEleve ? (
            <div className="cordel-card p-3 flex items-center justify-between gap-2 text-xs font-mono">
              <span className="font-bold">{t('listeningModeTitle')}</span>
              <div className="inline-flex gap-1.5">
                <button type="button" onClick={() => setListeningMode('headphones')} className={`px-2.5 py-1 rounded font-bold inline-flex items-center gap-1 cursor-pointer ${listeningMode === 'headphones' ? 'cordel-btn-primary' : 'cordel-btn'}`}><Headphones className="w-3.5 h-3.5" /><span>{t('statusHeadphonesOn')}</span></button>
                <button type="button" onClick={() => setListeningMode('speakers')} className={`px-2.5 py-1 rounded font-bold inline-flex items-center gap-1 cursor-pointer ${listeningMode === 'speakers' ? 'cordel-btn-primary' : 'cordel-btn'}`}><VolumeX className="w-3.5 h-3.5" /><span>{t('statusVisualMode')}</span></button>
              </div>
            </div>
          ) : (
            <>
              <ListeningModePanel
                listeningMode={listeningMode} onListeningModeChange={setListeningMode} referencePitch={referencePitch}
                onReferencePitchChange={(p) => { updatePattern(activePattern.id, { referencePitch: p }); updateScopedReferencePitch(p); }}
                onPlayReferencePreview={() => engine.playReferencePitchPreview(referencePitch, 1.5, selectedOutputDeviceId, project.referencePitchHz ?? pitchHz)}
              />
              <div className="cordel-card p-3 flex items-center justify-between gap-2 text-xs font-mono">
                <span className="font-bold">{t('stampDiapasonHzLabel')} ({MIN_REFERENCE_PITCH_HZ}–{MAX_REFERENCE_PITCH_HZ} Hz)</span>
                <div className="inline-flex items-center gap-1.5">
                  <NumericDraftInput min={MIN_REFERENCE_PITCH_HZ} max={MAX_REFERENCE_PITCH_HZ} value={pitchHz} onChange={handlePitchHzChange} className="w-16 cordel-card-sm text-center font-bold py-1 rounded text-[#0f766e] dark:text-teal-300" />
                  <button type="button" onClick={() => handlePitchHzChange(DEFAULT_REFERENCE_PITCH_HZ)} className="px-2 py-1 cordel-btn rounded text-[11px] font-bold cursor-pointer">440 Hz</button>
                </div>
              </div>
              <div className="text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 text-theme-accent pt-1">
                <Activity className="w-4 h-4" /><span>{t('reglagesTessituraSection')}</span>
              </div>
              <TessituraBoundsPanel tessitura={activePattern.tessitura ?? DEFAULT_TESSITURA} onChange={handleTessituraChange} hasRecording={hasRecording} />
              <CordelAccordion title={t('drawerReglagesVariantsTitle')} defaultOpen={false}>
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
              </CordelAccordion>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
