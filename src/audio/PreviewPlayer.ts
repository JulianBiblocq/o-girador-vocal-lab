/**
 * PreviewPlayer.ts
 * Lecteur de pré-écoute locale avec micro-fondus (10ms/30ms), clic témoin calé et kill-switch.
 */
import { applyTrimWithFades } from '../utils/wavEncoder';

export interface PreviewOptions {
  trimStartSec: number;
  trimEndSec: number;
  bpm: number;
  beatsPerMeasure: number;
  totalDurationSec: number;
  clickEnabled: boolean;
  onEnded?: () => void;
}

export class PreviewPlayer {
  private ctx: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private activeNodes: AudioNode[] = [];
  private isPlaying = false;
  private playheadStartCycleTime = 0;
  private playbackContextStartTime = 0;
  private playDuration = 0;
  private stopTimerId: number | null = null;

  public async play(
    rawPCM: Float32Array,
    sampleRate: number,
    options: PreviewOptions
  ): Promise<void> {
    this.stop(); // Kill-switch préventif

    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioCtxClass();
    if (this.ctx.state !== 'running') {
      await this.ctx.resume();
    }

    const { trimStartSec, trimEndSec, bpm, beatsPerMeasure, clickEnabled, onEnded } = options;
    const cleanPCM = applyTrimWithFades(rawPCM, sampleRate, trimStartSec, trimEndSec);
    this.playDuration = Math.max(0.05, trimEndSec - trimStartSec);
    this.playheadStartCycleTime = trimStartSec;

    // Création de l'AudioBuffer pour la portion rognée
    const audioBuffer = this.ctx.createBuffer(1, cleanPCM.length, sampleRate);
    audioBuffer.getChannelData(0).set(cleanPCM);

    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = audioBuffer;
    this.sourceNode.connect(this.ctx.destination);
    this.activeNodes.push(this.sourceNode);

    const now = this.ctx.currentTime + 0.02; // Décalage de 20ms pour programmation fluide
    this.playbackContextStartTime = now;
    this.isPlaying = true;

    // 1. Démarrage de la voix
    this.sourceNode.start(now);

    // 2. Clic témoin parfaitement aligné sur la grille absolue du cycle
    if (clickEnabled) {
      const beatDuration = 60 / bpm;
      const totalBeats = Math.ceil(options.totalDurationSec / beatDuration);

      for (let b = 0; b < totalBeats; b++) {
        const beatCycleTime = b * beatDuration;
        // On programme uniquement les clics situés dans l'intervalle d'écoute [trimStartSec, trimEndSec]
        if (beatCycleTime >= trimStartSec - 0.001 && beatCycleTime <= trimEndSec + 0.001) {
          const delayFromStart = beatCycleTime - trimStartSec;
          const clickTime = now + delayFromStart;
          const isMajor = b % beatsPerMeasure === 0;
          this.scheduleClick(this.ctx, clickTime, isMajor);
        }
      }
    }

    // Arrêt programmé
    this.stopTimerId = window.setTimeout(() => {
      this.stop();
      if (onEnded) onEnded();
    }, (this.playDuration + 0.05) * 1000);
  }

  public stop(): void {
    if (this.stopTimerId !== null) {
      window.clearTimeout(this.stopTimerId);
      this.stopTimerId = null;
    }

    for (const node of this.activeNodes) {
      try {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          (node as AudioScheduledSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // Ignorer si déjà arrêté
      }
    }
    this.activeNodes = [];
    this.sourceNode = null;
    this.isPlaying = false;
  }

  public getCurrentPlayheadSec(): number {
    if (!this.isPlaying || !this.ctx) return this.playheadStartCycleTime;
    const elapsed = this.ctx.currentTime - this.playbackContextStartTime;
    if (elapsed < 0) return this.playheadStartCycleTime;
    return Math.min(this.playheadStartCycleTime + this.playDuration, this.playheadStartCycleTime + elapsed);
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  private scheduleClick(ctx: AudioContext, time: number, isMajor: boolean): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isMajor ? 1400 : 900, time);
    osc.frequency.exponentialRampToValueAtTime(isMajor ? 260 : 180, time + 0.02);

    gain.gain.setValueAtTime(isMajor ? 0.45 : 0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);

    osc.connect(gain);
    gain.connect(ctx.destination);
    this.activeNodes.push(osc, gain);

    osc.start(time);
    osc.stop(time + 0.02);
  }
}
