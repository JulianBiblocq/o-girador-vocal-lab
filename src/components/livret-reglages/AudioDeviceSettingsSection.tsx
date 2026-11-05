/**
 * AudioDeviceSettingsSection.tsx
 * Section des périphériques audio (micro/casque) avec test de signal à coupure immédiate (< 105 lignes).
 */
import React, { useState, useEffect, useRef } from 'react';
import { DeviceSelector } from '../livret-prise/DeviceSelector';
import { useLanguage } from '../../i18n/LanguageContext';
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
  const [micLevel, setMicLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const animRef = useRef<number | null>(null);

  const stopMicTest = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    setIsTestingMic(false);
    setMicLevel(0);
  };

  const startMicTest = async () => {
    stopMicTest();
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      const audioCtx = new AudioContext();
      ctxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const pcm = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        analyser.getByteFrequencyData(pcm);
        let sum = 0;
        for (let i = 0; i < pcm.length; i++) sum += pcm[i];
        const avg = sum / pcm.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animRef.current = requestAnimationFrame(loop);
      };
      animRef.current = requestAnimationFrame(loop);
      setIsTestingMic(true);
    } catch {
      stopMicTest();
    }
  };

  useEffect(() => () => stopMicTest(), []);

  return (
    <div className="cordel-card p-3 sm:p-4 flex flex-col gap-3">
      <DeviceSelector
        selectedDeviceId={selectedDeviceId}
        onDeviceChange={onDeviceChange}
        selectedOutputDeviceId={selectedOutputDeviceId}
        onOutputDeviceChange={onOutputDeviceChange}
      />

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-[var(--cordel-border-sub)]">
        <button
          type="button"
          onClick={isTestingMic ? stopMicTest : startMicTest}
          className={`px-3 py-1.5 text-xs font-mono font-bold rounded flex items-center gap-1.5 cursor-pointer transition-colors ${
            isTestingMic ? 'bg-red-800 text-[var(--cordel-text)] animate-pulse' : 'cordel-btn'
          }`}
        >
          <Mic className="w-3.5 h-3.5 text-theme-accent" />
          <span>{isTestingMic ? t('reglagesTestMicStop') : t('reglagesTestMicStart')}</span>
        </button>

        {isTestingMic && (
          <div className="flex-1 max-w-xs flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500 animate-pulse shrink-0" />
            <div className="flex-1 h-3 bg-[var(--cordel-subcard-bg)] border border-[var(--cordel-border-sub)] rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-75"
                style={{ width: `${micLevel}%` }}
              />
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 w-8 text-right">{micLevel}%</span>
          </div>
        )}
      </div>
    </div>
  );
};
