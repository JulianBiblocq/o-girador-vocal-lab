/**
 * cueAudioHelper.ts
 * Pré-écoute contextuelle du pattern d'appel précédent (M-2 / M-1).
 * Routage direct vers le casque sans aucune contamination du microphone.
 */
import type { VocalPatternItem } from '../types/toadaProject.types';

export interface CuePlaybackHandle {
  source: AudioBufferSourceNode;
  stop: () => void;
}

export function scheduleCuePatternAudio(
  ctx: AudioContext,
  cuePattern: VocalPatternItem,
  cycleStartTime: number,
  beatsPerMeasure: number,
  beatDurationSec: number
): CuePlaybackHandle | null {
  if (!cuePattern.recordingResult || !cuePattern.recordingResult.pcm) {
    return null;
  }

  const { pcm, sampleRate } = cuePattern.recordingResult;
  const startOffset = Math.max(0, Math.floor((cuePattern.trimStartSec || 0) * sampleRate));
  const endOffset = cuePattern.trimEndSec > 0
    ? Math.min(pcm.length, Math.floor(cuePattern.trimEndSec * sampleRate))
    : pcm.length;

  const usefulLength = Math.max(0, endOffset - startOffset);
  if (usefulLength === 0) return null;

  // Création du buffer audio natif
  const buffer = ctx.createBuffer(1, usefulLength, sampleRate);
  buffer.getChannelData(0).set(pcm.subarray(startOffset, endOffset));

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const gain = ctx.createGain();
  gain.gain.value = 0.85;

  source.connect(gain);
  gain.connect(ctx.destination);

  // M-2 démarre à cycleStartTime, M-1 démarre à cycleStartTime + beatsPerMeasure * beatDurationSec
  const cueStartTime = cuePattern.measuresCount >= 2
    ? cycleStartTime
    : cycleStartTime + beatsPerMeasure * beatDurationSec;

  try {
    source.start(cueStartTime);
  } catch (err) {
    console.warn('Erreur au lancement du cue audio:', err);
    return null;
  }

  return {
    source,
    stop: () => {
      try {
        source.stop();
        source.disconnect();
        gain.disconnect();
      } catch {}
    },
  };
}
