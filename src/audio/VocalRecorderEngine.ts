/**
 * VocalRecorderEngine.ts
 * Moteur de capture audio PCM synchrone calé sur l'horloge Web Audio à T0.
 * Buffer réduit à 1024 samples pour diviser la latence d'entrée par 4 (~23ms).
 */

export class VocalRecorderEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private muteGain: GainNode | null = null;

  private isCapturing = false;
  private syncStartTime = 0;
  private totalDurationSec = 0;
  private sampleRate = 44100;
  private chunks: Float32Array[] = [];
  private totalSamplesRecorded = 0;

  public async prepare(ctx: AudioContext, deviceId?: string): Promise<number> {
    this.cleanup();
    this.ctx = ctx;
    this.sampleRate = ctx.sampleRate;

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

    // Buffer optimisé à 1024 échantillons (~23ms à 44.1kHz) pour une réactivité maximale
    this.processorNode = ctx.createScriptProcessor(1024, 1, 1);

    this.muteGain = ctx.createGain();
    this.muteGain.gain.setValueAtTime(0, ctx.currentTime);

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.muteGain);
    this.muteGain.connect(ctx.destination);

    this.chunks = [];
    this.totalSamplesRecorded = 0;
    return this.sampleRate;
  }

  public start(syncStartTime: number, totalDurationSec: number): void {
    this.syncStartTime = syncStartTime;
    this.totalDurationSec = totalDurationSec;
    this.isCapturing = true;
    this.chunks = [];
    this.totalSamplesRecorded = 0;

    if (!this.processorNode || !this.ctx) return;

    this.processorNode.onaudioprocess = (e) => {
      if (!this.isCapturing || !this.ctx) return;

      const currentTime = this.ctx.currentTime;
      if (currentTime < this.syncStartTime) return;
      if (currentTime >= this.syncStartTime + this.totalDurationSec + 0.05) return;

      const input = e.inputBuffer.getChannelData(0);
      const copy = new Float32Array(input.length);
      copy.set(input);
      this.chunks.push(copy);
      this.totalSamplesRecorded += copy.length;
    };
  }

  public stop(): Float32Array {
    this.isCapturing = false;

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      this.processorNode.disconnect();
      this.processorNode = null;
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
    return merged;
  }

  public cleanup(): void {
    this.stop();
  }
}
