/**
 * directAudioImporter.ts
 * Utilitaire de decodage de fichiers audio externes (.wav, .mp3, .ogg, .flac, .m4a) (< 60 lignes).
 */
import { getSharedAudioContext } from '../audio/sharedAudioContext';

export interface DecodedAudioResult {
  pcm: Float32Array;
  sampleRate: number;
  durationSec: number;
  fileName: string;
}

export async function decodeAudioFile(file: File): Promise<DecodedAudioResult> {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = await getSharedAudioContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;
  const durationSec = audioBuffer.duration;

  let monoPcm: Float32Array;
  if (numChannels === 1) {
    monoPcm = new Float32Array(audioBuffer.getChannelData(0));
  } else {
    monoPcm = new Float32Array(length);
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.getChannelData(1);
    for (let i = 0; i < length; i++) {
      monoPcm[i] = (ch0[i] + ch1[i]) * 0.5;
    }
  }

  return {
    pcm: monoPcm,
    sampleRate,
    durationSec,
    fileName: file.name,
  };
}
