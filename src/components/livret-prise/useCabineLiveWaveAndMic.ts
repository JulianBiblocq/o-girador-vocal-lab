/**
 * useCabineLiveWaveAndMic.ts
 * Sonde 60 FPS Zéro-State de Cabine : buffer d'onde REC en direct, jauge micro DOM au 1er plan
 * (arrêt strict track.stop() au repos / changement d'onglet) et bouton [Réécouter] (< 130 lignes).
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import type { VocalPatternItem } from '../../types/toadaProject.types';
import type { VocalRecorderEngine } from '../../audio/VocalRecorderEngine';
import { resolvePatternAudioSource } from '../../utils/patternStatusHelper';
import { getSharedAudioContext, registerAudioKillSwitch, stopAllActiveAudioEngines } from '../../audio/sharedAudioContext';
import { openRawMicStream, stopMicStream } from '../../audio/rawMicStream';
import type { MicLevel } from '../common/MicLevelMeter';

interface Params {
  recorder: VocalRecorderEngine;
  selectedDeviceId: string;
  isRecordingAny: boolean;
  activePattern: VocalPatternItem;
  recordedSampleRate: number;
}

export function useCabineLiveWaveAndMic({ recorder, selectedDeviceId, isRecordingAny, activePattern, recordedSampleRate }: Params) {
  const livePeakBinsRef = useRef<Float32Array>(new Float32Array(768));
  const micLevelRef = useRef<MicLevel>({ rms: 0, peak: 0 });
  const [isReplaying, setIsReplaying] = useState(false);
  const [isMicProbeActive, setIsMicProbeActive] = useState(false);

  const replaySrcRef = useRef<AudioBufferSourceNode | null>(null);
  const idleStreamRef = useRef<MediaStream | null>(null);
  const idleSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timeBufRef = useRef<Float32Array<ArrayBuffer>>(new Float32Array(new ArrayBuffer(256 * 4)));
  const probeRafRef = useRef<number | null>(null);

  const stopReplay = useCallback(() => {
    if (replaySrcRef.current) {
      try { replaySrcRef.current.stop(); } catch {}
      try { replaySrcRef.current.disconnect(); } catch {}
      replaySrcRef.current = null;
    }
    setIsReplaying(false);
  }, []);

  const stopIdleProbe = useCallback(() => {
    if (probeRafRef.current !== null) { cancelAnimationFrame(probeRafRef.current); probeRafRef.current = null; }
    if (idleSourceRef.current) { try { idleSourceRef.current.disconnect(); } catch {} idleSourceRef.current = null; }
    if (analyserRef.current) { try { analyserRef.current.disconnect(); } catch {} analyserRef.current = null; }
    stopMicStream(idleStreamRef.current); idleStreamRef.current = null;
    micLevelRef.current.rms = 0; micLevelRef.current.peak = 0;
    setIsMicProbeActive(false);
  }, []);

  const sampleAnalyserPeak = useCallback((): number => {
    const an = analyserRef.current;
    if (!an) return 0;
    an.getFloatTimeDomainData(timeBufRef.current);
    let pk = 0, sumSq = 0;
    for (let i = 0; i < timeBufRef.current.length; i++) { const a = Math.abs(timeBufRef.current[i]); sumSq += a * a; if (a > pk) pk = a; }
    const rms = Math.sqrt(sumSq / timeBufRef.current.length), lvl = micLevelRef.current;
    lvl.rms = rms > lvl.rms ? rms : lvl.rms * 0.92 + rms * 0.08; lvl.peak = pk;
    return pk;
  }, []);

  const startIdleProbe = useCallback(async () => {
    if (isRecordingAny || idleStreamRef.current) return;
    try {
      const ctx = await getSharedAudioContext();
      const stream = await openRawMicStream(selectedDeviceId);
      idleStreamRef.current = stream;
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser(); an.fftSize = 256;
      src.connect(an); idleSourceRef.current = src; analyserRef.current = an;
      setIsMicProbeActive(true);
      const loop = () => { sampleAnalyserPeak(); probeRafRef.current = requestAnimationFrame(loop); };
      probeRafRef.current = requestAnimationFrame(loop);
    } catch {}
  }, [isRecordingAny, selectedDeviceId, sampleAnalyserPeak]);

  useEffect(() => {
    if (isRecordingAny) {
      stopReplay();
      if (idleStreamRef.current) stopIdleProbe();
      livePeakBinsRef.current.fill(0);
      const srcNode = recorder.getSourceNode();
      if (srcNode) {
        const an = srcNode.context.createAnalyser(); an.fftSize = 256;
        srcNode.connect(an); analyserRef.current = an;
      }
      return () => { if (analyserRef.current) { try { analyserRef.current.disconnect(); } catch {} analyserRef.current = null; } };
    }
    micLevelRef.current.rms = 0; micLevelRef.current.peak = 0;
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((res) => { if (res.state === 'granted') startIdleProbe(); }).catch(() => {});
    }
  }, [isRecordingAny, recorder, stopReplay, stopIdleProbe, startIdleProbe]);

  useEffect(() => {
    const unreg = registerAudioKillSwitch('cabine-live-monitor', () => { stopReplay(); stopIdleProbe(); });
    return () => { unreg(); stopReplay(); stopIdleProbe(); };
  }, [stopReplay, stopIdleProbe]);

  const toggleReplay = useCallback(async () => {
    if (isReplaying) { stopReplay(); return; }
    stopAllActiveAudioEngines('cabine-live-monitor');
    const { pcm, sampleRate } = resolvePatternAudioSource(activePattern, recordedSampleRate);
    if (!pcm?.length) return;
    const s0 = Math.max(0, Math.floor((activePattern.trimStartSec || 0) * sampleRate));
    const s1 = activePattern.trimEndSec && activePattern.trimEndSec > (activePattern.trimStartSec || 0) ? Math.min(pcm.length, Math.floor(activePattern.trimEndSec * sampleRate)) : pcm.length;
    const sliced = pcm.subarray(s0, Math.max(s0 + 1, s1));
    const ctx = await getSharedAudioContext(), buf = ctx.createBuffer(1, sliced.length, sampleRate);
    buf.getChannelData(0).set(sliced);
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination);
    src.onended = () => { replaySrcRef.current = null; setIsReplaying(false); };
    replaySrcRef.current = src; setIsReplaying(true); src.start(0);
  }, [isReplaying, stopReplay, activePattern, recordedSampleRate]);

  return { livePeakBinsRef, sampleAnalyserPeak, micLevelRef, isMicProbeActive, startIdleProbe, stopIdleProbe, isReplaying, toggleReplay, stopReplay };
}
