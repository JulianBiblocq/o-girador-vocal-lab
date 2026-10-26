/**
 * cueAudioHelper.ts
 * Pré-écoute contextuelle du pattern d'appel précédent (M-2 / M-1).
 * Routage direct vers le casque sans aucune contamination du microphone.
 */
import type { VocalPatternItem } from '../types/toadaProject.types';
import { getPatternT1OffsetSec } from '../utils/anacrusisTimingHelper';

export interface CuePlaybackHandle {
  source: AudioBufferSourceNode;
  stop: () => void;
}

export function scheduleCuePatternAudio(
  ctx: AudioContext,
  cuePattern: VocalPatternItem,
  cycleStartTime: number,
  beatsPerMeasure = 4,
  beatDurationSec = 0.5
): CuePlaybackHandle | null {
  const variant = cuePattern.variants?.[cuePattern.activeVariantKey];
  const rec = cuePattern.recordingResult ?? variant?.recordingResult;
  if (!rec || !rec.pcm || rec.pcm.length === 0) return null;

  const { pcm, sampleRate } = rec;
  const measureDurationSec = beatsPerMeasure * beatDurationSec;
  const explicitT1 = variant?.t1OffsetSec ?? cuePattern.t1OffsetSec ?? rec?.t1OffsetSec;
  const cueT1OffsetSec = getPatternT1OffsetSec(cuePattern.hasAnacrusis !== false, measureDurationSec, explicitT1);
  const trimStartSec = cuePattern.trimStartSec || variant?.trimStartSec || 0;
  const trimEndSec = (cuePattern.trimEndSec || variant?.trimEndSec || 0) > 0
    ? (cuePattern.trimEndSec || variant?.trimEndSec || 0)
    : pcm.length / sampleRate;

  // Calage métrique : la Mesure 1 du Cue démarre à cycleStartTime.
  // L'éventuelle anacrouse en amont (trimStartSec < cueT1OffsetSec) est coupée pour caler M1 au début.
  const effectiveStartSec = Math.max(cueT1OffsetSec, trimStartSec);
  const effectiveEndSec = Math.max(effectiveStartSec, trimEndSec);
  const startOffset = Math.max(0, Math.floor(effectiveStartSec * sampleRate));
  const endOffset = Math.min(pcm.length, Math.floor(effectiveEndSec * sampleRate));

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

  // La fin de la mesure M_cue tombe pile sur le T1 du nouveau pattern (seul l'overdub +T1 déborde)
  const whenToStartCue = cycleStartTime + Math.max(0, effectiveStartSec - cueT1OffsetSec);

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
