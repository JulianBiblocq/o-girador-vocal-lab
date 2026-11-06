/**
 * useWebMidiInput.ts
 * Hook d'écoute Web MIDI (clavier maître : NoteOn/NoteOff) + Barre Espace + Bouton TAP tactile (< 110 lignes).
 */
import { useState, useEffect, useRef, useCallback } from 'react';

export interface RhythmTapEvent {
  onsetSec: number;
  releaseSec: number;
  midiNote?: number;
}

export interface UseWebMidiInputOptions {
  isCapturing?: boolean;
  getCurrentTimeSec?: () => number;
  onMidiNoteOn?: (midiNote: number) => void;
  onTapRecorded?: (tap: RhythmTapEvent) => void;
}

export function useWebMidiInput(options: UseWebMidiInputOptions = {}) {
  const { isCapturing = false, getCurrentTimeSec, onMidiNoteOn, onTapRecorded } = options;
  const [midiConnected, setMidiConnected] = useState(false);
  const [midiDeviceName, setMidiDeviceName] = useState<string | null>(null);
  const [lastMidiNote, setLastMidiNote] = useState<number | null>(null);
  const [taps, setTaps] = useState<RhythmTapEvent[]>([]);

  const activeTapsRef = useRef<Map<string, { onsetSec: number; midiNote?: number }>>(new Map());
  const tapsListRef = useRef<RhythmTapEvent[]>([]);
  const callbacksRef = useRef({ isCapturing, getCurrentTimeSec, onMidiNoteOn, onTapRecorded });
  callbacksRef.current = { isCapturing, getCurrentTimeSec, onMidiNoteOn, onTapRecorded };

  const nowSec = useCallback(() => {
    if (callbacksRef.current.getCurrentTimeSec) return Math.max(0, callbacksRef.current.getCurrentTimeSec());
    return performance.now() / 1000;
  }, []);

  const handleNoteStart = useCallback((key: string, midiNote?: number) => {
    if (midiNote !== undefined) {
      setLastMidiNote(midiNote);
      callbacksRef.current.onMidiNoteOn?.(midiNote);
    }
    if (!callbacksRef.current.isCapturing) return;
    if (activeTapsRef.current.has(key)) return;
    activeTapsRef.current.set(key, { onsetSec: nowSec(), midiNote });
  }, [nowSec]);

  const handleNoteEnd = useCallback((key: string) => {
    const active = activeTapsRef.current.get(key);
    if (!active) return;
    activeTapsRef.current.delete(key);
    const releaseSec = Math.max(active.onsetSec + 0.04, nowSec());
    const tap: RhythmTapEvent = { onsetSec: active.onsetSec, releaseSec, midiNote: active.midiNote };
    tapsListRef.current = [...tapsListRef.current, tap];
    setTaps(tapsListRef.current);
    callbacksRef.current.onTapRecorded?.(tap);
  }, [nowSec]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof (navigator as any).requestMIDIAccess !== 'function') return;
    let midiAccess: any = null;
    let cancelled = false;

    const bindInputs = (access: any) => {
      if (cancelled) return;
      const inputs = Array.from(access.inputs?.values?.() || []) as any[];
      setMidiConnected(inputs.length > 0);
      setMidiDeviceName(inputs[0]?.name || null);
      inputs.forEach((input) => {
        input.onmidimessage = (evt: any) => {
          const data: Uint8Array = evt.data;
          if (!data || data.length < 2) return;
          const cmd = data[0] & 0xf0, note = data[1], vel = data.length > 2 ? data[2] : 0;
          if (cmd === 0x90 && vel > 0) handleNoteStart(`midi_${note}`, note);
          else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) handleNoteEnd(`midi_${note}`);
        };
      });
    };

    (navigator as any).requestMIDIAccess().then((access: any) => {
      if (cancelled) return;
      midiAccess = access;
      bindInputs(access);
      access.onstatechange = () => bindInputs(access);
    }).catch(() => {});

    return () => {
      cancelled = true;
      if (midiAccess?.inputs) {
        for (const input of midiAccess.inputs.values()) input.onmidimessage = null;
      }
    };
  }, [handleNoteStart, handleNoteEnd]);

  useEffect(() => {
    if (!isCapturing) {
      activeTapsRef.current.forEach((_, key) => handleNoteEnd(key));
      activeTapsRef.current.clear();
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); handleNoteStart('space'); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); handleNoteEnd('space'); }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, [isCapturing, handleNoteStart, handleNoteEnd]);

  const clearTaps = useCallback(() => { activeTapsRef.current.clear(); tapsListRef.current = []; setTaps([]); }, []);
  const triggerManualTapDown = useCallback((midiNote?: number) => handleNoteStart('manual', midiNote), [handleNoteStart]);
  const triggerManualTapUp = useCallback(() => handleNoteEnd('manual'), [handleNoteEnd]);

  return { midiConnected, midiDeviceName, lastMidiNote, taps, getTapsSnapshot: () => tapsListRef.current, clearTaps, triggerManualTapDown, triggerManualTapUp };
}

