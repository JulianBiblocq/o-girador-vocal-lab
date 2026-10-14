/**
 * MetronomeEngine.ts
 * Moteur d'horloge Web Audio temps réel haute précision (60 FPS sync).
 * Respect strict de la Règle 6.C (nettoyage des nœuds, pas de fuite mémoire).
 */

export type ListeningMode = 'headphones' | 'speakers';

export interface MetronomeConfig {
  bpm: number;
  measuresCount: number; // N mesures de chant (1..4)
  referencePitch: string; // Ex: 'C4', 'A3', 'G4'
  listeningMode: ListeningMode;
}

export interface CycleStatus {
  phase: 'idle' | 'anacrusis' | 'singing' | 'completed';
  currentMeasure: number; // -1 pour anacrouse, 0..(N-1) pour chant
  currentBeat: number; // 0..3 (dans la mesure)
  beatIndexInCycle: number; // 0..(totalBeats - 1)
  beatProgress: number; // 0..1 dans le temps courant
  elapsedSec: number;
  totalDurationSec: number;
}

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1,
  D: 2, 'D#': 3, Eb: 3,
  E: 4,
  F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8,
  A: 9, 'A#': 10, Bb: 10,
  B: 11
};

export function noteToFrequency(note: string): number {
  const match = note.trim().match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) return 440; // Fallback standard A4
  const noteName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const octave = parseInt(match[2], 10);
  const semitone = NOTE_TO_SEMITONE[noteName] ?? 9;
  const midi = (octave + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class MetronomeEngine {
  private ctx: AudioContext | null = null;
  private isRunning = false;
  private startTime = 0;
  private totalDurationSec = 0;
  private beatDurationSec = 0;
  private totalBeats = 0;
  private measuresCount = 1;
  private activeNodes: AudioNode[] = [];
  private completionTimerId: number | null = null;
  private onCompleteCallback: (() => void) | null = null;

  public async initContext(): Promise<AudioContext> {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state !== 'running') {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  public getContext(): AudioContext | null {
    return this.ctx;
  }

  /**
   * Lance un cycle complet calibré : 1 mesure d'élan (M-1) + N mesures de chant.
   */
  public async startCycle(
    config: MetronomeConfig,
    onComplete?: () => void
  ): Promise<void> {
    this.stop(); // Stoppe et nettoie tout cycle précédent

    const ctx = await this.initContext();
    this.onCompleteCallback = onComplete ?? null;
    this.isRunning = true;
    this.measuresCount = Math.max(1, Math.min(4, config.measuresCount));
    this.beatDurationSec = 60 / config.bpm;
    
    // Mesure d'élan (4 temps) + N mesures de chant (4 temps par mesure)
    const anacrusisBeats = 4;
    const singingBeats = this.measuresCount * 4;
    this.totalBeats = anacrusisBeats + singingBeats;
    this.totalDurationSec = this.totalBeats * this.beatDurationSec;

    // Décalage de 50ms pour laisser le temps de programmer les nœuds Web Audio de façon déterministe
    const leadTime = 0.05;
    this.startTime = ctx.currentTime + leadTime;

    // Si nous sommes en mode casque, programmer les sons audio
    if (config.listeningMode === 'headphones') {
      this.scheduleHeadphoneAudio(ctx, this.startTime, config);
    }

    // Programmer l'arrêt automatique (punch-out) à la fin du cycle
    const delayMs = (leadTime + this.totalDurationSec) * 1000;
    this.completionTimerId = window.setTimeout(() => {
      this.handleCycleCompletion();
    }, delayMs);
  }

  /**
   * Arrêt d'urgence ou interruption manuelle.
   */
  public stop(): void {
    if (this.completionTimerId !== null) {
      window.clearTimeout(this.completionTimerId);
      this.completionTimerId = null;
    }

    // Déconnexion et nettoyage strict de tous les nœuds audio en vol (Règle 6.C)
    for (const node of this.activeNodes) {
      try {
        if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
          (node as AudioScheduledSourceNode).stop();
        }
        node.disconnect();
      } catch {
        // Ignorer les erreurs si déjà arrêté
      }
    }
    this.activeNodes = [];
    this.isRunning = false;
  }

  /**
   * Permet d'écouter la note repère au repos (bouton "Écouter la note repère").
   */
  public async playReferencePitchPreview(noteName: string, durationSec = 1.5): Promise<void> {
    this.stop();
    const ctx = await this.initContext();
    const freq = noteToFrequency(noteName);

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);

    // Enveloppe d'amplitude douce (pas de pop)
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.05);
    gain.gain.setValueAtTime(0.35, now + durationSec - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    this.activeNodes.push(osc, filter, gain);

    osc.start(now);
    osc.stop(now + durationSec);

    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
      const idx = this.activeNodes.indexOf(osc);
      if (idx !== -1) this.activeNodes.splice(idx, 3);
    };
  }

  /**
   * Calcul précis et sans garbage collection de l'état du cycle pour le balancier 60 FPS.
   */
  public getCycleStatus(): CycleStatus {
    if (!this.isRunning || !this.ctx) {
      return {
        phase: 'idle',
        currentMeasure: -1,
        currentBeat: 0,
        beatIndexInCycle: 0,
        beatProgress: 0,
        elapsedSec: 0,
        totalDurationSec: this.totalDurationSec
      };
    }

    const elapsed = this.ctx.currentTime - this.startTime;

    if (elapsed < 0) {
      // Période de pré-roll (leadTime de 50ms)
      return {
        phase: 'anacrusis',
        currentMeasure: -1,
        currentBeat: 0,
        beatIndexInCycle: 0,
        beatProgress: 0,
        elapsedSec: 0,
        totalDurationSec: this.totalDurationSec
      };
    }

    if (elapsed >= this.totalDurationSec) {
      return {
        phase: 'completed',
        currentMeasure: this.measuresCount - 1,
        currentBeat: 3,
        beatIndexInCycle: this.totalBeats - 1,
        beatProgress: 1,
        elapsedSec: this.totalDurationSec,
        totalDurationSec: this.totalDurationSec
      };
    }

    const totalBeatFraction = elapsed / this.beatDurationSec;
    const beatIndexInCycle = Math.floor(totalBeatFraction);
    const beatProgress = totalBeatFraction - beatIndexInCycle;

    // 4 temps dans l'anacrouse (M-1)
    const isAnacrusis = beatIndexInCycle < 4;
    const phase = isAnacrusis ? 'anacrusis' : 'singing';
    const currentMeasure = isAnacrusis ? -1 : Math.floor((beatIndexInCycle - 4) / 4);
    const currentBeat = isAnacrusis ? beatIndexInCycle : (beatIndexInCycle - 4) % 4;

    return {
      phase,
      currentMeasure,
      currentBeat,
      beatIndexInCycle,
      beatProgress,
      elapsedSec: elapsed,
      totalDurationSec: this.totalDurationSec
    };
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getBeatDurationSec(): number {
    return this.beatDurationSec;
  }

  /**
   * Ordonnance les clics et le diapason pour le mode casque via l'horloge Web Audio.
   */
  private scheduleHeadphoneAudio(
    ctx: AudioContext,
    start: number,
    config: MetronomeConfig
  ): void {
    // 1. Clics boisés sur chaque temps du cycle (Élan + Chant)
    for (let b = 0; b < this.totalBeats; b++) {
      const beatTime = start + b * this.beatDurationSec;
      const isMajorBeat = b === 0 || (b >= 4 && (b - 4) % 4 === 0);
      this.scheduleWoodClick(ctx, beatTime, isMajorBeat);
    }

    // 2. Note repère / Diapason (Élan M-1 uniquement)
    // Joue sur les 4 temps de l'élan et s'arrête net au Temps 1 de la mesure de chant M.
    const pitchDurationSec = 4 * this.beatDurationSec;
    this.scheduleReferencePitch(ctx, start, config.referencePitch, pitchDurationSec);
  }

  /**
   * Synthèse d'un clic boisé sec et court (percussion acoustique type clave/bloc).
   */
  private scheduleWoodClick(ctx: AudioContext, time: number, isMajor: boolean): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const startFreq = isMajor ? 1400 : 900;
    const endFreq = isMajor ? 260 : 180;
    const duration = 0.025; // 25ms court et précis

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + duration);

    gain.gain.setValueAtTime(isMajor ? 0.6 : 0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    this.activeNodes.push(osc, gain);

    osc.start(time);
    osc.stop(time + duration);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      const i1 = this.activeNodes.indexOf(osc);
      if (i1 !== -1) this.activeNodes.splice(i1, 1);
      const i2 = this.activeNodes.indexOf(gain);
      if (i2 !== -1) this.activeNodes.splice(i2, 1);
    };
  }

  /**
   * Synthèse de la note de référence pendant l'élan M-1.
   */
  private scheduleReferencePitch(
    ctx: AudioContext,
    startTime: number,
    noteName: string,
    durationSec: number
  ): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    const freq = noteToFrequency(noteName);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, startTime);

    // Enveloppe douce pour éviter tout bruit parasite
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.28, startTime + 0.04);
    // Tenue jusqu'à 30ms avant la fin, puis fondu rapide pour couper au Temps 1 de chant
    gain.gain.setValueAtTime(0.28, startTime + durationSec - 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    this.activeNodes.push(osc, filter, gain);

    osc.start(startTime);
    osc.stop(startTime + durationSec);

    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
      const idx = this.activeNodes.indexOf(osc);
      if (idx !== -1) this.activeNodes.splice(idx, 3);
    };
  }

  private handleCycleCompletion(): void {
    this.stop();
    if (this.onCompleteCallback) {
      this.onCompleteCallback();
    }
  }
}
