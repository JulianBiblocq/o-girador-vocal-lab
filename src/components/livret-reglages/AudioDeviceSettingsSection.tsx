/**
 * AudioDeviceSettingsSection.tsx
 * Section des périphériques audio (micro/casque) avec test de signal GPU (0 setState en RAF) et Kill-Switch (< 108 lignes).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DeviceSelector } from '../livret-prise/DeviceSelector';
import { useLanguage } from '../../i18n/LanguageContext';
import { registerAudioKillSwitch } from '../../audio/sharedAudioContext';
import { Mic, Activity } from 'lucide-react';

interface AudioDeviceSettingsSectionProps {
  selectedDeviceId: string;
  onDeviceChange: (id: string, label?: string) => void;
  selectedOutputDeviceId: string;
  onOutputDeviceChange: (id: string) => void;
}

export const AudioDeviceSettingsSection: React.FC<AudioDeviceSettingsSectionProps> = ({
  selectedDeviceId, onDeviceChange, selectedOutputDeviceId, onOutputDeviceChange,
}) => {
  const { t } = useLanguage();
  const [isTestingMic, setIsTestingMic] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const srcNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const animRef = useRef<number | null>(null);
  const meterBarRef = useRef<HTMLDivElement | null>(null);
  const meterPctRef = useRef<HTMLSpanElement | null>(null);

  const stopMicTest = useCallback(() => {
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    if (srcNodeRef.current) { try { srcNodeRef.current.disconnect(); } catch {} srcNodeRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    setIsTestingMic(false);
  }, []);

  const startMicTest = async () => {
    stopMicTest();
    registerAudioKillSwitch('settings-mic-test', stopMicTest);
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          ...(selectedDeviceId && selectedDeviceId !== 'default' ? { deviceId: { exact: selectedDeviceId } } : {}),
          echoCancellation: false, noiseSuppression: false, autoGainControl: false,
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      const audioCtx = new AudioContext();
      ctxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      srcNodeRef.current = source;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const pcm = new Uint8Array(analyser.frequencyBinCount);

      setIsTestingMic(true);
      const loop = () => {
        analyser.getByteFrequencyData(pcm);
        let sum = 0;
        for (let i = 0; i < pcm.length; i++) sum += pcm[i];
        const pct = Math.min(100, Math.round(((sum / pcm.length) / 128) * 100));
        if (meterBarRef.current) meterBarRef.current.style.transform = `scaleX(${(pct / 100).toFixed(3)})`;
        if (meterPctRef.current) meterPctRef.current.textContent = `${pct}%`;
        animRef.current = requestAnimationFrame(loop);
      };
      animRef.current = requestAnimationFrame(loop);
    } catch {
      stopMicTest();
    }
  };

  useEffect(() => () => stopMicTest(), [stopMicTest]);

  return (
    <div className="cordel-card p-3 sm:p-4 flex flex-col gap-3">
      <DeviceSelector
        selectedDeviceId={selectedDeviceId} onDeviceChange={onDeviceChange}
        selectedOutputDeviceId={selectedOutputDeviceId} onOutputDeviceChange={onOutputDeviceChange}
      />

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--cordel-border-sub)]">
        <button
          type="button" onClick={isTestingMic ? stopMicTest : startMicTest}
          className={`px-3 py-1.5 text-xs font-mono font-bold rounded flex items-center gap-1.5 cursor-pointer transition-colors ${
            isTestingMic ? 'bg-red-800 text-[#f4ecd8] animate-pulse' : 'cordel-btn'
          }`}
        >
          <Mic className="w-3.5 h-3.5 text-theme-accent" />
          <span>{isTestingMic ? t('reglagesTestMicStop') : t('reglagesTestMicStart')}</span>
        </button>

        {isTestingMic && (
          <div className="flex-1 max-w-xs flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse shrink-0" />
            <div className="flex-1 h-3 bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] rounded-full overflow-hidden">
              <div ref={meterBarRef} className="h-full w-full origin-left bg-emerald-500 will-change-transform" style={{ transform: 'scaleX(0)' }} />
            </div>
            <span ref={meterPctRef} className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 w-8 text-right">0%</span>
          </div>
        )}
      </div>
    </div>
  );
};
