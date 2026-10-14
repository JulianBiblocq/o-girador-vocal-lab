/**
 * VocalRecorderEngine.ts
 * Moteur de capture audio PCM synchrone cale sur l horloge Web Audio a T0.
 * Utilise un AudioWorkletNode dedie (blocs de 128 samples, zero buzz, zero blocage UI).
 * Auto-calage materiel aller-retour (DAC/ADC) & micro-fade in de 15 ms.
 */
import { VOCAL_CAPTURE_WORKLET_CODE } from './vocalCaptureWorkletCode';
import { computeHardwareLagSec } from './hardwareLatencyHelper';

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

  public async prepare(ctx: AudioContext, deviceId?: string): Promise<number> {
    this.cleanup();
    this.ctx = ctx;
    this.sampleRate = ctx.sampleRate;

    if (!VocalRecorderEngine.registeredContexts.has(ctx)) {
      const blob = new Blob([VOCAL_CAPTURE_WORKLET_CODE], { type: 'application/javascript; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      VocalRecorderEngine.registeredContexts.add(ctx);
    }

    const constraints: MediaStreamConstraints = {
      audio: {
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    };

    this.stream = await navigator.mediaDevices.getUserMedia(constraints);
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

  public start(syncStartTime: number, totalDurationSec: number): void {
    this.totalDurationSec = totalDurationSec;
    this.chunks = [];
    const lagSec = computeHardwareLagSec(this.ctx, this.stream);
    const captureStartTime = syncStartTime + lagSec;

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
}
