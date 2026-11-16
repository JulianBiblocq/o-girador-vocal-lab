/**
 * useCabineLiveWaveAndMic.ts
 * Sonde 60 FPS Zéro-State de Cabine : buffer d'onde REC en direct, jauge micro DOM au 1er plan
 * (arrêt strict track.stop() au repos / changement d'onglet) et bouton [Réécouter] (< 130 lignes).
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import type { VocalPatternItem } from '../../types/toadaProject.types';
import type { VocalRecorderEngine } from '../../audio/VocalRecorderEngine';
import { resolvePatternAudioSource } from '../common/PatternCompassBar';
import { getSharedAudioContext, registerAudioKillSwitch, stopAllActiveAudioEngines } from '../../audio/sharedAudioContext';

interface Params {
  recorder: VocalRecorderEngine;
  selectedDeviceId: string;
  isRecordingAny: boolean;
  activePattern: VocalPatternItem;
  recordedSampleRate: number;
}

export function useCabineLiveWaveAndMic({ recorder, selectedDeviceId, isRecordingAny, activePattern, recordedSampleRate }: Params) {
  const livePeakBinsRef = useRef<Float32Array>(new Float32Array(768));
  const micBarFillRef = useRef<HTMLDivElement | null>(null);
  const micClipDotRef = useRef<HTMLSpanElement | null>(null);
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
    if (idleStreamRef.current) { idleStreamRef.current.getTracks().forEach((t) => t.stop()); idleStreamRef.current = null; }
    if (micBarFillRef.current) micBarFillRef.current.style.transform = 'scaleX(0)';
    setIsMicProbeActive(false);
  }, []);

  const sampleAnalyserPeak = useCallback((): number => {
    const an = analyserRef.current;
    if (!an) return 0;
    an.getFloatTimeDomainData(timeBufRef.current);
    let pk = 0;
    for (let i = 0; i < timeBufRef.current.length; i++) { const a = Math.abs(timeBufRef.current[i]); if (a > pk) pk = a; }
    const ratio = Math.min(1, Math.pow(pk, 0.55) * 1.15);
    if (micBarFillRef.current) {
      micBarFillRef.current.style.transform = `scaleX(${ratio.toFixed(3)})`;
      micBarFillRef.current.style.backgroundColor = pk >= 0.94 ? '#dc2626' : pk >= 0.65 ? '#f59e0b' : '#10b981';
    }
    if (pk >= 0.94 && micClipDotRef.current) micClipDotRef.current.style.display = 'inline-flex';
    return pk;
  }, []);

  const startIdleProbe = useCallback(async () => {
    if (isRecordingAny || idleStreamRef.current) return;
    try {
      const ctx = await getSharedAudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: selectedDeviceId && selectedDeviceId !== 'default' ? { deviceId: { exact: selectedDeviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } : { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
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
    if (micBarFillRef.current) micBarFillRef.current.style.transform = 'scaleX(0)';
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

  const resetClipBadge = useCallback(() => { if (micClipDotRef.current) micClipDotRef.current.style.display = 'none'; }, []);

  return { livePeakBinsRef, sampleAnalyserPeak, micBarFillRef, micClipDotRef, isMicProbeActive, startIdleProbe, stopIdleProbe, resetClipBadge, isReplaying, toggleReplay, stopReplay };
}
