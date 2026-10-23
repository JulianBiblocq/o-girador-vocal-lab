/**
 * AudioHardwareContext.tsx
 * Contexte centralisé de gestion du matériel audio (micro, casque, engine métronome) (< 95 lignes).
 */
import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { MetronomeEngine, type ListeningMode } from '../audio/MetronomeEngine';
import { VocalRecorderEngine } from '../audio/VocalRecorderEngine';
import { closeSharedAudioContext } from '../audio/sharedAudioContext';

interface AudioHardwareContextValue {
  engine: MetronomeEngine;
  recorder: VocalRecorderEngine;
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
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

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [selectedOutputDeviceId, setSelectedOutputDeviceId] = useState<string>('');
  const [listeningMode, setListeningMode] = useState<ListeningMode>('headphones');
  const [recordedSampleRate, setRecordedSampleRate] = useState<number>(44100);

  useEffect(() => {
    return () => {
      engine.stop();
      recorder.cleanup();
      closeSharedAudioContext();
    };
  }, [engine, recorder]);

  const value = useMemo(
    () => ({
      engine,
      recorder,
      selectedDeviceId,
      setSelectedDeviceId,
      selectedOutputDeviceId,
      setSelectedOutputDeviceId: (id: string) => {
        setSelectedOutputDeviceId(id);
        engine.setOutputDevice(id);
      },
      listeningMode,
      setListeningMode,
      recordedSampleRate,
      setRecordedSampleRate,
    }),
    [engine, recorder, selectedDeviceId, selectedOutputDeviceId, listeningMode, recordedSampleRate]
  );

  return <AudioHardwareCtx.Provider value={value}>{children}</AudioHardwareCtx.Provider>;
};

export function useAudioHardware(): AudioHardwareContextValue {
  const ctx = useContext(AudioHardwareCtx);
  if (!ctx) throw new Error('useAudioHardware must be used within an AudioHardwareProvider');
  return ctx;
}
