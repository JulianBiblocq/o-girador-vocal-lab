/**
 * harmonyProfiles.ts
 * Motifs rythmiques et voicings pour les 4 univers d'accompagnement (< 135 lignes).
 */
import type { ChordDefinition, HarmonyProfileId } from '../../types/harmony.types';
import {
  playBassNote,
  playPolyphonicChordNote,
  playBerimbauHit,
  type ScheduledVoiceNode,
} from './harmonySynthVoice';

export interface ScheduleMeasureOptions {
  ctx: AudioContext;
  dest: AudioNode;
  chord: ChordDefinition;
  measureStartTime: number;
  measureDurationSec: number;
  beatsPerMeasure: number;
  beatDurationSec: number;
  volume: number;
  muteBass?: boolean;
  nodesList: ScheduledVoiceNode[];
}

export function scheduleMaracatuBourdon(opts: ScheduleMeasureOptions): void {
  const { ctx, dest, chord, measureStartTime, measureDurationSec, volume, muteBass, nodesList } = opts;
  const dur = measureDurationSec * 0.98;
  if (!muteBass) {
    playBassNote(ctx, dest, chord.bassMidi, measureStartTime, dur, volume * 0.85, nodesList);
  }
  // Fondamentale et quinte feutrée en tenue continue
  playPolyphonicChordNote(ctx, dest, chord.rootMidi, measureStartTime, dur, volume * 0.5, nodesList);
  playPolyphonicChordNote(ctx, dest, chord.rootMidi + 7, measureStartTime, dur, volume * 0.35, nodesList);
}

export function scheduleCapoeiraBerimbau(opts: ScheduleMeasureOptions): void {
  const { ctx, dest, chord, measureStartTime, beatsPerMeasure, beatDurationSec, volume, nodesList } = opts;
  const berimbauRoot = chord.bassMidi + 12; // Octave médium chantante
  const subDur = beatDurationSec / 2;

  for (let b = 0; b < beatsPerMeasure; b++) {
    const t = measureStartTime + b * beatDurationSec;
    // Toque classique : frappé étouffé / ouvert / fermé
    if (b % 2 === 0) {
      playBerimbauHit(ctx, dest, berimbauRoot, false, t, subDur * 0.4, volume * 0.7, nodesList);
      playBerimbauHit(ctx, dest, berimbauRoot, true, t + subDur, subDur * 1.2, volume * 0.9, nodesList);
    } else {
      playBerimbauHit(ctx, dest, berimbauRoot, false, t, subDur * 0.8, volume * 0.8, nodesList);
      playBerimbauHit(ctx, dest, berimbauRoot, true, t + subDur * 0.75, subDur * 1.1, volume * 0.85, nodesList);
    }
  }
}

export function scheduleSambaLevada(opts: ScheduleMeasureOptions): void {
  const { ctx, dest, chord, measureStartTime, beatsPerMeasure, beatDurationSec, volume, muteBass, nodesList } = opts;
  const sub = beatDurationSec / 2;
  const playVoicing = (time: number, dur: number, volRatio = 1.0) => {
    chord.voicingMidi.forEach((m) => playPolyphonicChordNote(ctx, dest, m, time, dur, volume * 0.32 * volRatio, nodesList));
  };

  for (let b = 0; b < beatsPerMeasure; b++) {
    const t = measureStartTime + b * beatDurationSec;
    // Basse sur temps forts (Temps 1 et 3)
    if (!muteBass && b % 2 === 0) {
      playBassNote(ctx, dest, chord.bassMidi, t, beatDurationSec * 0.85, volume * 0.8, nodesList);
    }
    // Levada syncopée de Violão / Cavaquinho
    playVoicing(t, sub * 0.7, 0.75);
    playVoicing(t + sub * 0.65, sub * 0.6, 0.9);
    if (b % 2 === 1) {
      playVoicing(t + sub * 1.3, sub * 0.5, 0.65);
    }
  }
}

export function scheduleForroSanfona(opts: ScheduleMeasureOptions): void {
  const { ctx, dest, chord, measureStartTime, beatsPerMeasure, beatDurationSec, volume, muteBass, nodesList } = opts;
  const sub = beatDurationSec / 2;

  for (let b = 0; b < beatsPerMeasure; b++) {
    const t = measureStartTime + b * beatDurationSec;
    // Basse alternée : Temps 1 = Fondamentale, Temps 2 = Quinte
    if (!muteBass) {
      const bassMidi = b % 2 === 0 ? chord.bassMidi : chord.bassMidi + 7;
      playBassNote(ctx, dest, bassMidi, t, beatDurationSec * 0.45, volume * 0.9, nodesList);
    }
    // Sanfona staccato sur le contretemps
    chord.voicingMidi.forEach((m) => {
      playPolyphonicChordNote(ctx, dest, m, t + sub, sub * 0.55, volume * 0.42, nodesList);
    });
  }
}

export function scheduleHarmonyProfileMeasure(profile: HarmonyProfileId, opts: ScheduleMeasureOptions): void {
  switch (profile) {
    case 'maracatu':
      scheduleMaracatuBourdon(opts);
      break;
    case 'capoeira':
      scheduleCapoeiraBerimbau(opts);
      break;
    case 'samba':
      scheduleSambaLevada(opts);
      break;
    case 'forro':
      scheduleForroSanfona(opts);
      break;
    default:
      scheduleMaracatuBourdon(opts);
      break;
  }
}
