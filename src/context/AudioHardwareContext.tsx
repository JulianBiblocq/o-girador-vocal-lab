/**
 * AudioHardwareContext.tsx
 * Contexte centralise du materiel audio avec detection auto de carte son (< 120 lignes).
 */
import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { MetronomeEngine, type ListeningMode } from '../audio/MetronomeEngine';
import { VocalRecorderEngine } from '../audio/VocalRecorderEngine';
import { closeSharedAudioContext } from '../audio/sharedAudioContext';

const STORAGE_KEY_INPUT = 'ogirador_selected_audio_input_id';
const STORAGE_KEY_OUTPUT = 'ogirador_selected_audio_output_id';

interface AudioHardwareContextValue {
  engine: MetronomeEngine;
  recorder: VocalRecorderEngine;
  selectedDeviceId: string;
  selectedDeviceLabel: string;
  setSelectedDeviceId: (id: string, label?: string) => void;
  selectedOutputDeviceId: string;
  setSelectedOutputDeviceId: (id: string) => void;
  listeningMode: ListeningMode;
  setListeningMode: (mode: ListeningMode) => void;
  recordedSampleRate: number;
  setRecordedSampleRate: (rate: number) => void;
}

const AudioHardwareCtx = createContext<AudioHardwareContextValue | null>(null);

export const AudioHardwareProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const engine = useMemo(() => new MetronomeEngine(), []);
  const recorder = useMemo(() => new VocalRecorderEngine(), []);

  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY_INPUT) || ''; } catch { return ''; }
  });
  const [selectedDeviceLabel, setSelectedDeviceLabel] = useState<string>('');
  const [selectedOutputDeviceId, setSelectedOutputDeviceIdState] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY_OUTPUT) || ''; } catch { return ''; }
  });
  const [listeningMode, setListeningMode] = useState<ListeningMode>('headphones');
  const [recordedSampleRate, setRecordedSampleRate] = useState<number>(44100);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const inputs = devs.filter((d) => d.kind === 'audioinput');
      const outputs = devs.filter((d) => d.kind === 'audiooutput');
      if (inputs.length > 0) {
        const saved = localStorage.getItem(STORAGE_KEY_INPUT);
        const matching = inputs.find((d) => d.deviceId === saved && d.deviceId.length > 0);
        const usbSoundCard = inputs.find((d) => /USB|Audio|Interface|Focusrite|Scarlett|Behringer|Yamaha|Steinberg|Rode|PreSonus/i.test(d.label));
        const chosen = matching || usbSoundCard || inputs[0];
        setSelectedDeviceIdState(chosen.deviceId);
        setSelectedDeviceLabel(chosen.label || 'Microphone');
        try { localStorage.setItem(STORAGE_KEY_INPUT, chosen.deviceId); } catch {}
      }
      if (outputs.length > 0) {
        const savedOut = localStorage.getItem(STORAGE_KEY_OUTPUT);
        const chosenOut = outputs.find((d) => d.deviceId === savedOut && d.deviceId.length > 0) || outputs[0];
        setSelectedOutputDeviceIdState(chosenOut.deviceId);
        engine.setOutputDevice(chosenOut.deviceId);
      }
    } catch {}
  }, [engine]);

  useEffect(() => {
    refreshDevices();
    if (!navigator.mediaDevices?.addEventListener) return;
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
  }, [refreshDevices]);

  useEffect(() => () => {
    engine.stop();
    recorder.cleanup();
    closeSharedAudioContext();
  }, [engine, recorder]);

  const setSelectedDeviceId = useCallback((id: string, label?: string) => {
    setSelectedDeviceIdState(id);
    if (label) setSelectedDeviceLabel(label);
    try { localStorage.setItem(STORAGE_KEY_INPUT, id); } catch {}
  }, []);

  const setSelectedOutputDeviceId = useCallback((id: string) => {
    setSelectedOutputDeviceIdState(id);
    engine.setOutputDevice(id);
    try { localStorage.setItem(STORAGE_KEY_OUTPUT, id); } catch {}
  }, [engine]);

  const value = useMemo(() => ({
    engine, recorder, selectedDeviceId, selectedDeviceLabel, setSelectedDeviceId,
    selectedOutputDeviceId, setSelectedOutputDeviceId, listeningMode, setListeningMode,
    recordedSampleRate, setRecordedSampleRate,
  }), [engine, recorder, selectedDeviceId, selectedDeviceLabel, setSelectedDeviceId, selectedOutputDeviceId, setSelectedOutputDeviceId, listeningMode, recordedSampleRate]);

  return <AudioHardwareCtx.Provider value={value}>{children}</AudioHardwareCtx.Provider>;
};

export function useAudioHardware(): AudioHardwareContextValue {
  const ctx = useContext(AudioHardwareCtx);
  if (!ctx) throw new Error('useAudioHardware must be used within an AudioHardwareProvider');
  return ctx;
}
