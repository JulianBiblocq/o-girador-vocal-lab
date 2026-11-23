/**
 * useVocalLabMidi.ts
 * Intégration Web MIDI API, MCU Transport DAW et pré-écoute au clavier maître sur sharedAudioContext (< 95 lignes).
 */
import { useEffect, useRef } from 'react';
import { useVocalTransportStore } from '../stores/useVocalTransportStore';
import { useToadaProject } from '../context/ToadaProjectContext';
import { midiToNoteName } from '../utils/noteUtils';
import { playSingleSynthNote } from '../audio/synthVoiceHelper';
import { getSharedAudioContext } from '../audio/sharedAudioContext';

export function useVocalLabMidi(overridePitchHz?: number): void {
  const { project } = useToadaProject();
  const pitchHzRef = useRef<number | undefined>(overridePitchHz ?? project.referencePitchHz ?? project.toadaMeta?.referencePitchHz);
  pitchHzRef.current = overridePitchHz ?? project.referencePitchHz ?? project.toadaMeta?.referencePitchHz;

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

      getSharedAudioContext()
        .then((ctx) => playSingleSynthNote(ctx, ctx.destination, note, ctx.currentTime, 0.35, pitchHzRef.current))
        .catch(() => {});
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
      () => {}
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
