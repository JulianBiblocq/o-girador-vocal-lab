/**
 * HarmonyPlayerEngine.ts
 * Moteur Web Audio haute précision pour l'accompagnement harmonique MIDI (< 135 lignes).
 * Respecte l'alignement strict du Temps 1 avec anacrouse et la transposition en demi-tons.
 */
import type { HarmonyProfileId, PatternHarmonyGrid } from '../../types/harmony.types';
import { parseChordSymbol } from '../../utils/chordParser';
import { scheduleHarmonyProfileMeasure } from './harmonyProfiles';
import type { ScheduledVoiceNode } from './harmonySynthVoice';

export interface HarmonyPlaybackOptions {
  grid: PatternHarmonyGrid;
  bpm: number;
  beatsPerMeasure: number;
  measuresCount: number;
  startTime: number;
  totalDurationSec: number;
  hasAnacrusis?: boolean;
  pitchShiftSemitones?: number;
  profile?: HarmonyProfileId;
  volume?: number;
  muteBass?: boolean;
  seekStartSec?: number;
}

export class HarmonyPlayerEngine {
  private activeNodes: ScheduledVoiceNode[] = [];
  private gainNode: GainNode | null = null;
  private isRunning = false;

  public schedule(ctx: AudioContext, destination: AudioNode, options: HarmonyPlaybackOptions): void {
    this.stop();
    if (!options.grid || !options.grid.measures || options.grid.measures.length === 0) return;

    this.gainNode = ctx.createGain();
    const vol = options.volume !== undefined ? options.volume : 0.65;
    this.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1.5, vol)), ctx.currentTime);
    this.gainNode.connect(destination);

    this.isRunning = true;
    const { bpm, beatsPerMeasure, measuresCount, startTime, hasAnacrusis = true, pitchShiftSemitones = 0, profile = 'maracatu', muteBass = false } = options;
    const beatDurationSec = 60 / bpm;
    const measureDurationSec = beatsPerMeasure * beatDurationSec;
    const t1OffsetSec = hasAnacrusis ? measureDurationSec : 0;
    const seek = options.seekStartSec || 0;

    // 1. Accompagnement pendant l'Élan M-1 (si anacrouse présente et départ avant T1)
    if (hasAnacrusis && seek < t1OffsetSec) {
      const firstChordSymbol = options.grid.measures[0]?.chordsByBeat?.[0] || 'C';
      const firstChord = parseChordSymbol(firstChordSymbol, pitchShiftSemitones);
      if (firstChord) {
        const mStart = startTime - seek;
        if (mStart + measureDurationSec > ctx.currentTime) {
          scheduleHarmonyProfileMeasure(profile, {
            ctx, dest: this.gainNode, chord: firstChord, measureStartTime: mStart,
            measureDurationSec, beatsPerMeasure, beatDurationSec, volume: vol * 0.7,
            muteBass, nodesList: this.activeNodes,
          });
        }
      }
    }

    // 2. Mesures normales de chant (M1..MN)
    for (let m = 0; m < measuresCount; m++) {
      const mRelSec = t1OffsetSec + m * measureDurationSec;
      if (mRelSec + measureDurationSec <= seek) continue;

      const mStart = startTime + (mRelSec - seek);
      if (mStart + measureDurationSec <= ctx.currentTime) continue;

      const measureData = options.grid.measures[m] || options.grid.measures[0];
      const chordSymbol = measureData?.chordsByBeat?.[0] || options.grid.measures[0]?.chordsByBeat?.[0] || 'C';
      const chordDef = parseChordSymbol(chordSymbol, pitchShiftSemitones);
      if (!chordDef) continue;

      scheduleHarmonyProfileMeasure(profile, {
        ctx, dest: this.gainNode, chord: chordDef, measureStartTime: mStart,
        measureDurationSec, beatsPerMeasure, beatDurationSec, volume: vol,
        muteBass, nodesList: this.activeNodes,
      });
    }
  }

  public setVolume(volume: number, ctx?: AudioContext): void {
    if (this.gainNode && ctx) {
      this.gainNode.gain.setValueAtTime(Math.max(0, Math.min(1.5, volume)), ctx.currentTime);
    }
  }

  public stop(): void {
    for (const node of this.activeNodes) {
      try { node.stop(); node.disconnect(); } catch {}
    }
    this.activeNodes = [];
    if (this.gainNode) {
      try { this.gainNode.disconnect(); } catch {}
      this.gainNode = null;
    }
    this.isRunning = false;
  }

  public getIsPlaying(): boolean {
    return this.isRunning;
  }
}
