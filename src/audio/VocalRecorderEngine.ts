/**
 * VocalRecorderEngine.ts
 * Moteur de capture audio PCM synchrone calé sur l'horloge Web Audio à T0 (< 142 lignes).
 * Utilise un AudioWorkletNode dédié (blocs de 128 samples, zéro buzz, latence 0 et fallback périphérique).
 */
import { VOCAL_CAPTURE_WORKLET_CODE } from './vocalCaptureWorkletCode';

export class VocalRecorderEngine {
  private static registeredContexts = new WeakSet<AudioContext>();

  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private muteGain: GainNode | null = null;

  private totalDurationSec = 0;
  private sampleRate = 44100;
  private chunks: Float32Array[] = [];

  private buildAudioConstraints(deviceId?: string): MediaStreamConstraints {
    return {
      audio: {
        ...(deviceId && deviceId !== 'default' ? { deviceId: { exact: deviceId } } : {}),
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
        sampleRate: 48000,
        // @ts-expect-error Web Audio low-latency & Chromium raw capture hints
        latency: 0,
        googEchoCancellation: false,
        googAutoGainControl: false,
        googNoiseSuppression: false,
        googHighpassFilter: false,
        googAudioMirroring: false,
      },
    };
  }

  public async prepare(ctx: AudioContext, deviceId?: string): Promise<number> {
    this.cleanup();
    this.ctx = ctx;
    if (this.ctx.state !== 'running') {
      await this.ctx.resume();
    }
    this.sampleRate = ctx.sampleRate;

    if (!VocalRecorderEngine.registeredContexts.has(ctx)) {
      const blob = new Blob([VOCAL_CAPTURE_WORKLET_CODE], { type: 'application/javascript; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      VocalRecorderEngine.registeredContexts.add(ctx);
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(this.buildAudioConstraints(deviceId));
    } catch {
      this.stream = await navigator.mediaDevices.getUserMedia(this.buildAudioConstraints(undefined));
    }

    this.sourceNode = ctx.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(ctx, 'vocal-capture-processor');

    this.muteGain = ctx.createGain();
    this.muteGain.gain.setValueAtTime(0, ctx.currentTime);

    this.sourceNode.connect(this.workletNode);
    this.workletNode.connect(this.muteGain);
    this.muteGain.connect(ctx.destination);

    this.chunks = [];
    this.workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
      if (e.data && e.data.length > 0) {
        this.chunks.push(e.data);
      }
    };

    return this.sampleRate;
  }

  public start(captureStartTime: number, totalDurationSec: number): void {
    this.totalDurationSec = totalDurationSec;
    this.chunks = [];

    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'start',
        captureStartTime,
        totalDurationSec,
      });
    }
  }

  public stop(): Float32Array {
    if (this.workletNode) {
      this.workletNode.port.postMessage({ type: 'stop' });
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.muteGain) {
      this.muteGain.disconnect();
      this.muteGain = null;
    }

    const targetLength = Math.max(1, Math.floor(this.totalDurationSec * this.sampleRate));
    const merged = new Float32Array(targetLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      if (offset >= targetLength) break;
      const toCopy = Math.min(chunk.length, targetLength - offset);
      merged.set(chunk.subarray(0, toCopy), offset);
      offset += toCopy;
    }
    this.chunks = [];

    const fadeSamples = Math.min(merged.length, Math.floor(this.sampleRate * 0.015));
    for (let i = 0; i < fadeSamples; i++) {
      merged[i] *= (i / fadeSamples);
    }

    return merged;
  }

  public cleanup(): void {
    this.stop();
  }

  public getActiveTrackLabel(): string {
    return this.stream?.getAudioTracks()[0]?.label || '';
  }

  public getSampleRate(): number {
    return this.sampleRate;
  }
}
