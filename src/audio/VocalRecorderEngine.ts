/**
 * VocalRecorderEngine.ts
 * Moteur de capture audio PCM synchrone calé sur l'horloge Web Audio à T0.
 * Zéro monitoring logiciel (aucun retour micro) & libération matérielle stricte.
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

  /**
   * Étape 1 : Initialise le micro et les nœuds en mémoire AVANT de lancer l'horloge.
   */
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

    // Buffer de 4096 échantillons (~92ms à 44.1kHz) pour capture continue
    this.processorNode = ctx.createScriptProcessor(4096, 1, 1);

    // Gain silencieux à 0 pour maintenir l'arbre Web Audio actif sans aucun monitoring (zéro larsen)
    this.muteGain = ctx.createGain();
    this.muteGain.gain.setValueAtTime(0, ctx.currentTime);

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.muteGain);
    this.muteGain.connect(ctx.destination);

    this.chunks = [];
    this.totalSamplesRecorded = 0;

    return this.sampleRate;
  }

  /**
   * Étape 2 : Démarre la capture de façon 100% synchrone sur le timestamp T0 de l'horloge.
   */
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
      // Attendre exactement l'instant T0 (start de la mesure d'élan)
      if (currentTime < this.syncStartTime) {
        return;
      }

      // Si la durée totale est atteinte (punch-out), cesser d'accumuler
      if (currentTime >= this.syncStartTime + this.totalDurationSec + 0.05) {
        return;
      }

      const input = e.inputBuffer.getChannelData(0);
      const copy = new Float32Array(input.length);
      copy.set(input);
      this.chunks.push(copy);
      this.totalSamplesRecorded += copy.length;
    };
  }

  /**
   * Étape 3 : Arrêt immédiat, libération de la carte son et retour du buffer consolidé.
   */
  public stop(): Float32Array {
    this.isCapturing = false;

    // Déconnexion et arrêt immédiat de toutes les pistes micro (libération carte son)
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

    // Consolidation des blocs en un seul Float32Array calibré
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
