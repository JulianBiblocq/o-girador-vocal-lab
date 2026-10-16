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
  _beatsPerMeasure?: number,
  _beatDurationSec?: number
): CuePlaybackHandle | null {
  const variant = cuePattern.variants?.[cuePattern.activeVariantKey];
  const rec = cuePattern.recordingResult ?? variant?.recordingResult;
  if (!rec || !rec.pcm || rec.pcm.length === 0) return null;

  const { pcm, sampleRate } = rec;
  const trimStartSec = cuePattern.trimStartSec || variant?.trimStartSec || 0;
  const trimEndSec = (cuePattern.trimEndSec || variant?.trimEndSec || 0) > 0
    ? (cuePattern.trimEndSec || variant?.trimEndSec || 0)
    : pcm.length / sampleRate;

  const startOffset = Math.max(0, Math.floor(trimStartSec * sampleRate));
  const endOffset = Math.min(pcm.length, Math.floor(trimEndSec * sampleRate));

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

  // Temps 1 du cuePattern calé à cycleStartTime + 1 * measureDurationSec (fin de la mesure 0 de décompte)
  // whenToStartCue = (cycleStartTime + measureDurationSec) - (measureDurationSec - trimStartSec) = cycleStartTime + trimStartSec
  const whenToStartCue = cycleStartTime + trimStartSec;

  try {
    source.start(whenToStartCue);
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
