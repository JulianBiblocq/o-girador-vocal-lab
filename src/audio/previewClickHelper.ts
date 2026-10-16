/**
 * previewClickHelper.ts
 * Generation et ordonnancement du clic metronome temoin pour PreviewPlayer (< 35 lignes).
 */
import { getSavedClickVolume } from '../utils/clickVolumeStorage';

export function schedulePreviewClick(
  ctx: AudioContext,
  time: number,
  isMajor: boolean,
  targetNode: AudioNode,
  activeNodes: AudioNode[]
): void {
  const vol = getSavedClickVolume();
  if (vol <= 0.01) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(isMajor ? 1600 : 1000, time);
  osc.frequency.exponentialRampToValueAtTime(isMajor ? 280 : 190, time + 0.02);

  const baseGain = isMajor ? 0.65 : 0.4;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(Math.min(1.5, baseGain * vol), time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);

  osc.connect(gain);
  gain.connect(targetNode);
  activeNodes.push(osc, gain);
  osc.start(time);
  osc.stop(time + 0.02);
}
