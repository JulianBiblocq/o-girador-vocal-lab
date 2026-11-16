/**
 * useVocalTransportStore.ts
 * Centralisation de l'état de transport studio, raccourcis DAW et permissions rôle (< 130 lignes).
 */
import { useSyncExternalStore } from 'react';
import { canAccessVocalStudio, getInitialRoleMode, type VocalUserPermissions } from '../utils/vocalPermissions';
import { stopAllActiveAudioEngines } from '../audio/sharedAudioContext';

export type LivretType = 'structure' | 'prise' | 'calage' | 'melodia' | 'treino' | 'reglages';
export type ViewRoleMode = 'studio' | 'eleve';
export type TreinoSubTab = 'fiche_paroles' | 'chanter_toada' | 'posture_diction' | 'ambitus' | 'warmup';

export interface LivretTransportHandlers {
  togglePlay?: () => void; stop?: () => void; toggleRecord?: () => void;
  seekRelative?: (deltaSec: number) => void; toggleLoop?: () => void; toggleMetronome?: () => void;
  undo?: () => void; redo?: () => void; deleteSelected?: () => void;
  onMidiNote?: (noteNumber: number, noteName: string, velocity: number) => void;
}

export interface VocalTransportState {
  activeLivret: LivretType; viewRoleMode: ViewRoleMode; userPermissions: VocalUserPermissions | null;
  treinoSubTab: TreinoSubTab; isRecording: boolean; isPlaying: boolean;
  isMidiConnected: boolean; activeMidiDeviceName: string | null; handlers: LivretTransportHandlers;
  setActiveLivret: (livret: LivretType) => void; setViewRoleMode: (mode: ViewRoleMode) => void;
  setUserPermissions: (perms: VocalUserPermissions | null) => void; setTreinoSubTab: (tab: TreinoSubTab) => void;
  setIsRecording: (rec: boolean) => void; setIsPlaying: (playing: boolean) => void;
  setMidiConnection: (connected: boolean, deviceName?: string | null) => void;
  registerHandlers: (newHandlers: Partial<LivretTransportHandlers>) => () => void;
  triggerPlayPause: () => void; triggerStop: () => void; triggerRecord: () => void;
  triggerSeek: (deltaSec: number) => void; triggerLoop: () => void; triggerUndo: () => void;
  triggerRedo: () => void; triggerDeleteSelected: () => void; triggerMetronome: () => void;
  triggerMidiNote: (noteNumber: number, noteName: string, velocity: number) => void;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());
const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
const initialMode = getInitialRoleMode();

let state: VocalTransportState = {
  activeLivret: initialMode === 'eleve' ? 'treino' : 'structure',
  viewRoleMode: initialMode, userPermissions: null, treinoSubTab: 'fiche_paroles',
  isRecording: false, isPlaying: false, isMidiConnected: false, activeMidiDeviceName: null, handlers: {},

  setTreinoSubTab: (tab) => { if (state.treinoSubTab !== tab) { state = { ...state, treinoSubTab: tab }; notify(); } },
  setActiveLivret: (livret) => {
    if (state.activeLivret === livret) return;
    if (state.viewRoleMode === 'eleve' && livret !== 'treino' && livret !== 'reglages') return;
    stopAllActiveAudioEngines();
    state = { ...state, activeLivret: livret, isPlaying: false, isRecording: false }; notify();
  },
  setViewRoleMode: (mode) => {
    if (mode === 'studio' && !canAccessVocalStudio(state.userPermissions)) return;
    const nextLivret: LivretType = mode === 'eleve' ? 'treino' : (state.activeLivret === 'treino' ? 'structure' : state.activeLivret);
    if (state.viewRoleMode === mode && state.activeLivret === nextLivret) return;
    const livretChanged = state.activeLivret !== nextLivret;
    if (livretChanged) stopAllActiveAudioEngines();
    state = {
      ...state, viewRoleMode: mode, activeLivret: nextLivret,
      ...(mode === 'eleve' ? { treinoSubTab: 'fiche_paroles' as TreinoSubTab } : {}),
      isPlaying: livretChanged ? false : state.isPlaying, isRecording: livretChanged ? false : state.isRecording,
    };
    notify();
  },
  setUserPermissions: (perms) => {
    const nextRole: ViewRoleMode = !canAccessVocalStudio(perms) ? 'eleve' : getInitialRoleMode(perms);
    const forceTreino = nextRole === 'eleve' && state.activeLivret !== 'treino' && state.activeLivret !== 'reglages';
    if (forceTreino) stopAllActiveAudioEngines();
    state = {
      ...state, userPermissions: perms, viewRoleMode: nextRole,
      activeLivret: forceTreino ? 'treino' : state.activeLivret,
      ...(forceTreino ? { isPlaying: false, isRecording: false, treinoSubTab: 'fiche_paroles' as TreinoSubTab } : {}),
    };
    notify();
  },
  setIsRecording: (rec) => { if (state.isRecording !== rec) { state = { ...state, isRecording: rec }; notify(); } },
  setIsPlaying: (p) => { if (state.isPlaying !== p) { state = { ...state, isPlaying: p }; notify(); } },
  setMidiConnection: (connected, deviceName = null) => {
    if (state.isMidiConnected === connected && state.activeMidiDeviceName === deviceName) return;
    state = { ...state, isMidiConnected: connected, activeMidiDeviceName: deviceName }; notify();
  },
  registerHandlers: (newHandlers) => {
    state.handlers = { ...state.handlers, ...newHandlers };
    return () => {
      const next = { ...state.handlers };
      for (const k of Object.keys(newHandlers) as (keyof LivretTransportHandlers)[]) if (next[k] === newHandlers[k]) delete next[k];
      state.handlers = next;
    };
  },
  triggerPlayPause: () => { if (state.isRecording) state.handlers.toggleRecord?.(); else state.handlers.togglePlay?.(); },
  triggerStop: () => { stopAllActiveAudioEngines(); state.handlers.stop?.(); },
  triggerRecord: () => {
    if (state.viewRoleMode === 'eleve') return;
    const needsSwitch = state.activeLivret !== 'prise';
    if (needsSwitch) state.setActiveLivret('prise');
    setTimeout(() => state.handlers.toggleRecord?.(), needsSwitch ? 60 : 0);
  },
  triggerSeek: (deltaSec) => state.handlers.seekRelative?.(deltaSec),
  triggerLoop: () => state.handlers.toggleLoop?.(),
  triggerUndo: () => state.handlers.undo?.(),
  triggerRedo: () => state.handlers.redo?.(),
  triggerDeleteSelected: () => state.handlers.deleteSelected?.(),
  triggerMetronome: () => state.handlers.toggleMetronome?.(),
  triggerMidiNote: (num, name, vel) => state.handlers.onMidiNote?.(num, name, vel),
};

export function useVocalTransportStore<T = VocalTransportState>(selector?: (s: VocalTransportState) => T): T {
  return useSyncExternalStore(subscribe, () => (selector ? selector(state) : (state as unknown as T)));
}
useVocalTransportStore.getState = () => state;
