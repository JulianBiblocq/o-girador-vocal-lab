/**
 * useVocalTransportStore.ts
 * Centralisation de l'état de transport studio, raccourcis DAW et permissions rôle (< 120 lignes).
 * Implémenté via un micro-store pub/sub et useSyncExternalStore (0 dépendance externe).
 */
import { useSyncExternalStore } from 'react';
import { getInitialRoleMode } from '../utils/vocalPermissions';

export type LivretType = 'prise' | 'melodia' | 'treino';
export type ViewRoleMode = 'studio' | 'eleve';

export interface LivretTransportHandlers {
  togglePlay?: () => void;
  stop?: () => void;
  toggleRecord?: () => void;
  seekRelative?: (deltaSec: number) => void;
  toggleLoop?: () => void;
  toggleMetronome?: () => void;
  undo?: () => void;
  redo?: () => void;
  deleteSelected?: () => void;
  onMidiNote?: (noteNumber: number, noteName: string, velocity: number) => void;
}

export interface VocalTransportState {
  activeLivret: LivretType;
  viewRoleMode: ViewRoleMode;
  isRecording: boolean;
  isPlaying: boolean;
  isMidiConnected: boolean;
  activeMidiDeviceName: string | null;
  handlers: LivretTransportHandlers;
  setActiveLivret: (livret: LivretType) => void;
  setViewRoleMode: (mode: ViewRoleMode) => void;
  setIsRecording: (rec: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  setMidiConnection: (connected: boolean, deviceName?: string | null) => void;
  registerHandlers: (newHandlers: Partial<LivretTransportHandlers>) => () => void;
  triggerPlayPause: () => void;
  triggerStop: () => void;
  triggerRecord: () => void;
  triggerSeek: (deltaSec: number) => void;
  triggerLoop: () => void;
  triggerUndo: () => void;
  triggerRedo: () => void;
  triggerDeleteSelected: () => void;
  triggerMetronome: () => void;
  triggerMidiNote: (noteNumber: number, noteName: string, velocity: number) => void;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

const initialMode = getInitialRoleMode();

let state: VocalTransportState = {
  activeLivret: initialMode === 'eleve' ? 'treino' : 'prise',
  viewRoleMode: initialMode,
  isRecording: false,
  isPlaying: false,
  isMidiConnected: false,
  activeMidiDeviceName: null,
  handlers: {},

  setActiveLivret: (livret: LivretType) => {
    if (state.viewRoleMode === 'eleve' && livret !== 'treino') return;
    state = { ...state, activeLivret: livret };
    notify();
  },
  setViewRoleMode: (mode: ViewRoleMode) => {
    state = {
      ...state,
      viewRoleMode: mode,
      activeLivret: mode === 'eleve' ? 'treino' : state.activeLivret,
    };
    notify();
  },
  setIsRecording: (rec: boolean) => { state = { ...state, isRecording: rec }; notify(); },
  setIsPlaying: (playing: boolean) => { state = { ...state, isPlaying: playing }; notify(); },
  setMidiConnection: (connected: boolean, deviceName: string | null = null) => {
    state = { ...state, isMidiConnected: connected, activeMidiDeviceName: deviceName };
    notify();
  },

  registerHandlers: (newHandlers: Partial<LivretTransportHandlers>) => {
    state = { ...state, handlers: { ...state.handlers, ...newHandlers } };
    notify();
    return () => {
      const next = { ...state.handlers };
      for (const k of Object.keys(newHandlers) as (keyof LivretTransportHandlers)[]) {
        if (next[k] === newHandlers[k]) delete next[k];
      }
      state = { ...state, handlers: next };
      notify();
    };
  },

  triggerPlayPause: () => {
    if (state.isRecording) state.handlers.toggleRecord?.();
    else state.handlers.togglePlay?.();
  },
  triggerStop: () => state.handlers.stop?.(),
  triggerRecord: () => {
    if (state.activeLivret !== 'prise') state.setActiveLivret('prise');
    setTimeout(() => state.handlers.toggleRecord?.(), state.activeLivret !== 'prise' ? 50 : 0);
  },
  triggerSeek: (deltaSec: number) => state.handlers.seekRelative?.(deltaSec),
  triggerLoop: () => state.handlers.toggleLoop?.(),
  triggerUndo: () => state.handlers.undo?.(),
  triggerRedo: () => state.handlers.redo?.(),
  triggerDeleteSelected: () => state.handlers.deleteSelected?.(),
  triggerMetronome: () => state.handlers.toggleMetronome?.(),
  triggerMidiNote: (num: number, name: string, vel: number) => state.handlers.onMidiNote?.(num, name, vel),
};

export function useVocalTransportStore<T = VocalTransportState>(selector?: (s: VocalTransportState) => T): T {
  const cur = useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => state
  );
  return selector ? selector(cur) : (cur as unknown as T);
}

useVocalTransportStore.getState = () => state;
