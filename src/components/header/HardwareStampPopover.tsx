/**
 * HardwareStampPopover.tsx
 * Poinçon gravé interactif [Matériel] : Micro/Casque, Latence ms & Calibration, Gain 3s, MIDI & Ambitus (< 130 lignes).
 */
import React, { useState, useRef, useEffect } from 'react';
import { Sliders, Mic, Headphones, VolumeX, Check, ChevronDown, Piano, ArrowRight } from 'lucide-react';
import { useAudioHardware } from '../../context/AudioHardwareContext';
import { useVocalTransportStore } from '../../stores/useVocalTransportStore';
import { useLanguage } from '../../i18n/LanguageContext';
import { buildDeviceSignature } from '../../utils/deviceSignature';
import { getSavedLatencyOffsetMs, isLatencyCalibrated, markLatencyCalibrated } from '../../utils/latencyStorage';
import { hasSavedAmbitusProfile } from '../../utils/ambitusStorage';
import { CalibrationBanner } from '../livret-prise/CalibrationBanner';
import { MicGainAssistantCard } from '../livret-reglages/MicGainAssistantCard';

export const HardwareStampPopover: React.FC = () => {
  const { selectedDeviceId, selectedDeviceLabel, selectedOutputDeviceId, recordedSampleRate, listeningMode, setListeningMode } = useAudioHardware();
  const isMidiConnected = useVocalTransportStore((s) => s.isMidiConnected);
  const activeMidiDeviceName = useVocalTransportStore((s) => s.activeMidiDeviceName);
  const setActiveLivret = useVocalTransportStore((s) => s.setActiveLivret);
  const setTreinoSubTab = useVocalTransportStore((s) => s.setTreinoSubTab);
  const setViewRoleMode = useVocalTransportStore((s) => s.setViewRoleMode);
  const { t, language } = useLanguage(), isBr = language === 'br';
  const [isOpen, setIsOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  const sig = buildDeviceSignature(selectedDeviceId, selectedOutputDeviceId, recordedSampleRate);
  const [latencyMs, setLatencyMs] = useState<number>(() => getSavedLatencyOffsetMs(sig));
  const [isCalibrated, setIsCalibrated] = useState<boolean>(() => isLatencyCalibrated(selectedDeviceId));
  const [hasAmbitus, setHasAmbitus] = useState<boolean>(() => hasSavedAmbitusProfile());

  useEffect(() => {
    const sync = () => {
      setLatencyMs(getSavedLatencyOffsetMs(sig));
      setIsCalibrated(isLatencyCalibrated(selectedDeviceId));
      setHasAmbitus(hasSavedAmbitusProfile());
    };
    sync();
    window.addEventListener('ogirador-latency-calibrated', sync);
    window.addEventListener('ogirador-ambitus-updated', sync);
    return () => {
      window.removeEventListener('ogirador-latency-calibrated', sync);
      window.removeEventListener('ogirador-ambitus-updated', sync);
    };
  }, [sig, selectedDeviceId]);

  useEffect(() => {
    const onOut = (e: MouseEvent) => { if (popRef.current && !popRef.current.contains(e.target as Node)) setIsOpen(false); };
    const onClose = () => setIsOpen(false);
    document.addEventListener('mousedown', onOut); window.addEventListener('cordel-close-popovers', onClose);
    return () => { document.removeEventListener('mousedown', onOut); window.removeEventListener('cordel-close-popovers', onClose); };
  }, []);

  const allReady = isCalibrated && hasAmbitus;

  return (
    <div className="relative inline-flex items-center" ref={popRef}>
      <button type="button" onClick={() => setIsOpen((p) => !p)} title={t('stampHardwareTitle')} className="h-8 px-2.5 cordel-card-sm text-xs font-mono font-bold inline-flex items-center gap-1.5 hover:border-amber-500/70 transition-colors cursor-pointer">
        <span className={`w-2 h-2 rounded-full shrink-0 ${allReady ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-amber-500'}`} />
        <Sliders className="w-3.5 h-3.5 text-theme-accent shrink-0" />
        <span className="text-theme-ink font-bold">{isBr ? 'Áudio' : 'Matériel'}</span>
        <span className="text-[10px] opacity-75 hidden md:inline">{latencyMs > 0 ? `+${latencyMs}` : latencyMs}ms</span>
        {isMidiConnected && <Piano className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300 shrink-0" />}
        <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-9 right-0 z-[100] w-84 max-w-[92vw] cordel-card p-3 bg-[var(--cordel-surface)] text-[var(--cordel-text)] border border-[var(--cordel-border-panel)] shadow-lg flex flex-col gap-2.5 text-xs font-mono rounded">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--cordel-border-sub)]">
            <span className="inline-flex items-center gap-1.5 truncate font-bold text-theme-ink" title={selectedDeviceLabel}>
              <Mic className="w-3.5 h-3.5 text-theme-accent shrink-0" />
              <span className="truncate">{selectedDeviceLabel || t('statusMicDefault')}</span>
            </span>
            <button type="button" onClick={() => setListeningMode(listeningMode === 'headphones' ? 'speakers' : 'headphones')} className="px-2 py-0.5 cordel-card-sm rounded font-bold inline-flex items-center gap-1 cursor-pointer shrink-0">
              {listeningMode === 'headphones' ? <Headphones className="w-3.5 h-3.5 text-theme-accent" /> : <VolumeX className="w-3.5 h-3.5 text-theme-wood" />}
              <span>{listeningMode === 'headphones' ? (isBr ? 'Fone' : 'Casque') : (isBr ? 'Visual' : 'Visuel')}</span>
            </button>
          </div>

          <CalibrationBanner inputDeviceId={selectedDeviceId} outputDeviceId={selectedOutputDeviceId} sampleRate={recordedSampleRate} onCalibrationComplete={(ms) => { setLatencyMs(ms); setIsCalibrated(true); }} />

          {!isCalibrated && (
            <button type="button" onClick={() => { markLatencyCalibrated(selectedDeviceId); setIsCalibrated(true); }} className="w-full py-1 rounded bg-[#0f766e] text-white font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer">
              <Check className="w-3.5 h-3.5" /><span>{t('latencyReminderAlreadyDone')}</span>
            </button>
          )}

          <MicGainAssistantCard inputDeviceId={selectedDeviceId} />

          {isMidiConnected && (
            <div className="px-2 py-1 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1.5">
              <Piano className="w-3.5 h-3.5 shrink-0" /><span className="truncate">MIDI : {activeMidiDeviceName || 'OK'}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[var(--cordel-border-sub)]">
            <button type="button" onClick={() => { setIsOpen(false); setTreinoSubTab('ambitus'); setViewRoleMode('eleve'); }} className="px-2 py-1 cordel-card-sm rounded font-bold inline-flex items-center gap-1 cursor-pointer text-[11px]">
              <span className={`w-1.5 h-1.5 rounded-full ${hasAmbitus ? 'bg-emerald-600' : 'bg-amber-500'}`} />
              <span>{t('stampAmbitusCalibrateBtn')}</span>
            </button>
            <button type="button" onClick={() => { setIsOpen(false); setActiveLivret('reglages'); }} className="px-2.5 py-1 cordel-btn-primary rounded font-bold inline-flex items-center gap-1 cursor-pointer text-[11px]">
              <span>{t('stampOpenAllSettingsBtn')}</span><ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
