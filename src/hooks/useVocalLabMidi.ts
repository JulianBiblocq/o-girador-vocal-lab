/**
 * useVocalLabMidi.ts
 * Integration Web MIDI API, MCU Transport DAW (Play, Stop, Rec, Rewind, FastFwd, Undo)
 * et pre-ecoute / saisie melodique au clavier maitre (< 130 lignes).
 */
import { useEffect } from 'react';
import { useVocalTransportStore } from '../stores/useVocalTransportStore';
import { midiToNoteName } from '../utils/noteUtils';
import { playSingleSynthNote } from '../audio/synthVoiceHelper';

let sharedAudioCtx: AudioContext | null = null;
function getSharedAudioCtx(): AudioContext | null {
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx?.state === 'suspended') sharedAudioCtx.resume().catch(() => {});
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export function useVocalLabMidi(): void {
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.requestMIDIAccess) return;

    let midiAccess: MIDIAccess | null = null;
    const activeInputs = new Set<MIDIInput>();

    const onMIDIMessage = (event: MIDIMessageEvent) => {
      const data = event.data;
      if (!data || data.length < 2) return;
      const [status, note, velocity = 0] = [data[0], data[1], data[2] ?? 0];
      const isNoteOn = (status & 0xf0) === 0x90 && velocity > 0;
      if (!isNoteOn) return;

      const store = useVocalTransportStore.getState();

      // Interception Transport MCU (Notes 80 a 95 sur canal DAW / canal 1)
      if (note >= 80 && note <= 95) {
        if (note === 94) store.triggerPlayPause();
        else if (note === 93) store.triggerStop();
        else if (note === 95) store.triggerRecord();
        else if (note === 91) store.triggerSeek(-1);
        else if (note === 92) store.triggerSeek(1);
        else if (note === 86) store.triggerLoop();
        else if (note === 81) store.triggerUndo();
        else if (note === 89) store.triggerMetronome();
        return;
      }

      // Notes musicales clavier maitre
      const ctx = getSharedAudioCtx();
      if (ctx) {
        playSingleSynthNote(ctx, ctx.destination, note, ctx.currentTime, 0.35);
      }
      store.triggerMidiNote(note, midiToNoteName(note), velocity);
    };

    const setupInputs = (access: MIDIAccess) => {
      activeInputs.forEach((inp) => { try { inp.onmidimessage = null; } catch {} });
      activeInputs.clear();
      let hasDevice = false;
      let firstDeviceName: string | null = null;

      access.inputs.forEach((input) => {
        input.onmidimessage = onMIDIMessage;
        activeInputs.add(input);
        hasDevice = true;
        if (!firstDeviceName) firstDeviceName = input.name || 'MIDI Device';
      });

      useVocalTransportStore.getState().setMidiConnection(hasDevice, firstDeviceName);
    };

    navigator.requestMIDIAccess({ sysex: false }).then(
      (access) => {
        midiAccess = access;
        setupInputs(access);
        access.onstatechange = () => setupInputs(access);
      },
      (err) => console.warn('[useVocalLabMidi] Web MIDI non disponible :', err)
    );

    const handleSimulatedMidi = (e: Event) => {
      const evt = e as CustomEvent<{ data: number[] | Uint8Array }>;
      if (evt.detail?.data) onMIDIMessage({ data: new Uint8Array(evt.detail.data) } as any);
    };
    window.addEventListener('o-girador-simulate-midi', handleSimulatedMidi);

    return () => {
      window.removeEventListener('o-girador-simulate-midi', handleSimulatedMidi);
      if (midiAccess) midiAccess.onstatechange = null;
      activeInputs.forEach((inp) => { try { inp.onmidimessage = null; } catch {} });
      activeInputs.clear();
    };
  }, []);
}
