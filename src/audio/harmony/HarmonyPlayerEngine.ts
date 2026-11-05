/**
 * HarmonyPlayerEngine.ts
 * Moteur Web Audio haute précision pour l'accompagnement harmonique MIDI (< 115 lignes).
 * Supporte le chaînage lookahead sans coupure prématurée (append: true).
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
  t1OffsetSec?: number;
  pitchShiftSemitones?: number;
  profile?: HarmonyProfileId;
  volume?: number;
  muteBass?: boolean;
  seekStartSec?: number;
  append?: boolean;
}

export class HarmonyPlayerEngine {
  private activeNodes: ScheduledVoiceNode[] = [];
  private gainNodes: GainNode[] = [];
  private isRunning = false;

  public schedule(ctx: AudioContext, destination: AudioNode, options: HarmonyPlaybackOptions): void {
    if (!options.append) {
      this.stop();
    }
    if (!options.grid || !options.grid.measures || options.grid.measures.length === 0) return;

    const slotGain = ctx.createGain();
    const vol = options.volume !== undefined ? options.volume : 0.65;
    slotGain.gain.setValueAtTime(Math.max(0, Math.min(1.5, vol)), ctx.currentTime);
    slotGain.connect(destination);
    this.gainNodes.push(slotGain);

    this.isRunning = true;
    const {
      bpm, beatsPerMeasure, measuresCount, startTime,
      hasAnacrusis = true, pitchShiftSemitones = 0, profile = 'maracatu', muteBass = false,
    } = options;
    const beatDurationSec = 60 / bpm;
    const measureDurationSec = beatsPerMeasure * beatDurationSec;
    const t1OffsetSec = options.t1OffsetSec ?? (hasAnacrusis ? measureDurationSec : 0);
    const seek = options.seekStartSec || 0;

    if (hasAnacrusis && seek < t1OffsetSec) {
      const firstChordSymbol = options.grid.measures[0]?.chordsByBeat?.[0] || 'C';
      const firstChord = parseChordSymbol(firstChordSymbol, pitchShiftSemitones);
      if (firstChord) {
        const mStart = startTime + (t1OffsetSec - measureDurationSec) - seek;
        if (mStart + measureDurationSec > ctx.currentTime) {
          scheduleHarmonyProfileMeasure(profile, {
            ctx, dest: slotGain, chord: firstChord, measureStartTime: mStart,
            measureDurationSec, beatsPerMeasure, beatDurationSec, volume: vol * 0.7,
            muteBass, nodesList: this.activeNodes,
          });
        }
      }
    }

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
        ctx, dest: slotGain, chord: chordDef, measureStartTime: mStart,
        measureDurationSec, beatsPerMeasure, beatDurationSec, volume: vol,
        muteBass, nodesList: this.activeNodes,
      });
    }
  }

  public setVolume(volume: number, ctx?: AudioContext): void {
    if (!ctx) return;
    const clamped = Math.max(0, Math.min(1.5, volume));
    this.gainNodes.forEach((g) => g.gain.setValueAtTime(clamped, ctx.currentTime));
  }

  public stop(): void {
    for (const node of this.activeNodes) {
      try { node.stop(); node.disconnect(); } catch { /* ignore */ }
    }
    this.activeNodes = [];
    for (const g of this.gainNodes) {
      try { g.disconnect(); } catch { /* ignore */ }
    }
    this.gainNodes = [];
    this.isRunning = false;
  }

  public getIsPlaying(): boolean {
    return this.isRunning;
  }
}
