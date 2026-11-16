/**
 * studentComparativePlayer.ts
 * Lecture comparative Élève / Mestre / Mix (WSOLA à hauteur constante) extraite de StudentTrainerEngine (< 55 lignes).
 */
import { extractCanonicalMestreBuffer, timeStretchConstantPitch } from './wsolaTimeStretcher';
import type { VocalPatternItem } from '../types/toadaProject.types';

export type ComparativePlaybackMode = 'mix' | 'student' | 'mestre';

export function scheduleComparativePlaybackNodes(
  ctx: AudioContext,
  studentPCM: Float32Array,
  studentSampleRate: number,
  pattern: VocalPatternItem | undefined,
  baseBpm: number,
  speedRatio: number,
  mode: ComparativePlaybackMode
): { nodes: (AudioNode | AudioScheduledSourceNode)[]; maxDurSec: number } {
  const nodes: (AudioNode | AudioScheduledSourceNode)[] = [];
  const now = ctx.currentTime + 0.04;
  let maxDurSec = 0;

  if ((mode === 'mix' || mode === 'student') && studentPCM.length > 0) {
    const sBuf = ctx.createBuffer(1, studentPCM.length, studentSampleRate);
    sBuf.getChannelData(0).set(studentPCM);
    const sSrc = ctx.createBufferSource();
    sSrc.buffer = sBuf;
    sSrc.connect(ctx.destination);
    sSrc.start(now);
    nodes.push(sSrc);
    maxDurSec = Math.max(maxDurSec, sBuf.duration);
  }

  if ((mode === 'mix' || mode === 'mestre') && pattern) {
    const mestre = extractCanonicalMestreBuffer(pattern, baseBpm, 4, studentSampleRate);
    if (mestre?.pcm.length) {
      const stretched = timeStretchConstantPitch(mestre.pcm, mestre.sampleRate, speedRatio);
      const mBuf = ctx.createBuffer(1, stretched.length, mestre.sampleRate);
      mBuf.getChannelData(0).set(stretched);
      const mGain = ctx.createGain();
      mGain.gain.value = mode === 'mix' ? 0.75 : 1.0;
      const mSrc = ctx.createBufferSource();
      mSrc.buffer = mBuf;
      mSrc.connect(mGain);
      mGain.connect(ctx.destination);
      const offset = pattern.hasAnacrusis !== false ? 0 : 0.15 / speedRatio;
      mSrc.start(now, offset);
      nodes.push(mSrc, mGain);
      maxDurSec = Math.max(maxDurSec, mBuf.duration - offset);
    }
  }
  return { nodes, maxDurSec };
}
