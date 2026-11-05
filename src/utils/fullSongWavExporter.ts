/**
 * fullSongWavExporter.ts
 * Export WAV 16-bit PCM du chant complet (enchaînement des blocs du Conducteur)
 * via OfflineAudioContext avec Varispeed, tuilage d'anacrouse et harmonie (< 130 lignes).
 */
import type { ToadaProject, VocalPatternItem } from '../types/toadaProject.types';
import { getBeatsPerMeasure } from './musicalMath';
import { getPatternT1OffsetSec } from './anacrusisTimingHelper';
import { selectBestAudioVariant } from './variantMatcher';
import { scheduleMelodySteps } from '../audio/synthVoiceHelper';
import { computeSlotsMeasureLayout } from '../components/conductor/toadaTimingScheduler';
import { HarmonyPlayerEngine } from '../audio/harmony/HarmonyPlayerEngine';

function encodeWavBlob(pcm: Float32Array, sampleRate: number): Blob {
  const dataSize = pcm.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function schedulePatternAudio(ctx: BaseAudioContext, pat: VocalPatternItem, slotT1Sec: number, measureDurationSec: number, projectBpm: number) {
  const match = selectBestAudioVariant(pat.variants, 1.0, 0, pat.baseBpm ?? pat.bpm ?? projectBpm);
  const variant = match?.variant ?? pat.variants?.[pat.activeVariantKey];
  const rec = variant?.recordingResult ?? pat.recordingResult;
  const isMainVar = !variant || (variant.speedRatio === 1 && variant.pitchShiftSemitones === 0);
  const useCorrected = Boolean(isMainVar && pat.correctedAudioSamples && pat.correctedAudioSamples.length > 0);

  if (useCorrected || (rec && rec.pcm && rec.pcm.length > 0)) {
    const pcm = useCorrected ? pat.correctedAudioSamples! : rec!.pcm;
    const sampleRate = useCorrected ? (pat.pack?.audio?.sampleRate ?? rec?.sampleRate ?? 44100) : rec!.sampleRate;
    const recordedBpm = useCorrected ? (pat.pack?.metadata?.bpm || pat.bpm || pat.baseBpm || projectBpm) : (rec?.recordedBpm || pat.bpm || pat.baseBpm || projectBpm);
    const origMeasureDur = measureDurationSec * (projectBpm / recordedBpm);
    const explicitT1 = useCorrected
      ? (pat.hasAnacrusis !== false ? origMeasureDur : 0.15)
      : (variant?.t1OffsetSec ?? pat.t1OffsetSec ?? rec?.t1OffsetSec);
    const t1OffsetSec = getPatternT1OffsetSec(pat.hasAnacrusis !== false, origMeasureDur, explicitT1);
    const trimStartSec = useCorrected ? (pat.pack?.audio?.trim?.startSec ?? 0) : (variant?.trimStartSec || pat.trimStartSec || 0);
    const rawTrimEnd = useCorrected ? (pat.pack?.audio?.trim?.endSec ?? 0) : (variant?.trimEndSec || pat.trimEndSec || 0);
    const trimEndSec = rawTrimEnd > trimStartSec ? rawTrimEnd : pcm.length / sampleRate;
    const sStart = Math.max(0, Math.floor(trimStartSec * sampleRate));
    const sEnd = Math.min(pcm.length, Math.floor(trimEndSec * sampleRate));
    const len = Math.max(0, sEnd - sStart);
    if (len === 0) return;

    const audioBuf = ctx.createBuffer(1, len, sampleRate);
    audioBuf.getChannelData(0).set(pcm.subarray(sStart, sEnd));
    const source = ctx.createBufferSource();
    source.buffer = audioBuf;
    source.connect(ctx.destination);

    const speedRatio = Math.max(0.25, Math.min(4.0, projectBpm / recordedBpm));
    source.playbackRate.value = speedRatio;

    const when = slotT1Sec + (trimStartSec - t1OffsetSec) / speedRatio;
    if (match && match.residualSemitones !== 0) {
      try { source.detune.setValueAtTime(match.residualSemitones * 100, Math.max(0, when)); } catch {}
    }
    if (when >= 0) {
      source.start(when);
    } else {
      const elapsedBuf = -when * speedRatio;
      if (elapsedBuf < len / sampleRate) source.start(0, elapsedBuf);
    }
  } else if (pat.mainSteps && pat.mainSteps.length > 0) {
    const t1OffsetSec = getPatternT1OffsetSec(pat.hasAnacrusis, measureDurationSec, pat.t1OffsetSec);
    const stepDur = measureDurationSec / 16;
    if (pat.hasAnacrusis && pat.anacrusisSteps?.length > 0) {
      scheduleMelodySteps(ctx as any, ctx.destination, pat.anacrusisSteps, stepDur, Math.max(0, slotT1Sec - t1OffsetSec));
    }
    scheduleMelodySteps(ctx as any, ctx.destination, pat.mainSteps, stepDur, slotT1Sec);
  }
}

export async function exportFullSongWav(project: ToadaProject): Promise<void> {
  const bpm = project.bpm || 88;
  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const measureDurationSec = beatsPerMeasure * (60 / bpm);
  const layouts = computeSlotsMeasureLayout(project.slots, project.patterns);
  const lastLayout = layouts[layouts.length - 1];
  const totalMeasures = lastLayout ? lastLayout.startMeasure + lastLayout.advanceMeasures : 2;

  const totalDurationSec = (totalMeasures + 1) * measureDurationSec + 1.0;
  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(totalDurationSec * sampleRate), sampleRate);
  const harmonyEngine = new HarmonyPlayerEngine();

  layouts.forEach((layout) => {
    const slot = project.slots[layout.slotIndex];
    const puxPat = project.patterns.find((p) => p.id === slot.puxadorPatternId);
    const coroPat = project.patterns.find((p) => p.id === slot.coroPatternId);
    const slotT1Sec = layout.startMeasure * measureDurationSec;

    if (puxPat) schedulePatternAudio(offlineCtx, puxPat, slotT1Sec, measureDurationSec, bpm);
    if (coroPat) schedulePatternAudio(offlineCtx, coroPat, slotT1Sec, measureDurationSec, bpm);

    const patHarmony = puxPat?.harmonyGrid || coroPat?.harmonyGrid || project.globalHarmonyGrid;
    if (project.harmonyConfig?.enabled && patHarmony) {
      harmonyEngine.schedule(offlineCtx as unknown as AudioContext, offlineCtx.destination, {
        grid: patHarmony, bpm, beatsPerMeasure, measuresCount: layout.measuresInSlot,
        startTime: slotT1Sec, totalDurationSec: layout.measuresInSlot * measureDurationSec,
        hasAnacrusis: false, t1OffsetSec: 0, append: true,
        profile: project.harmonyConfig.profile, volume: project.harmonyConfig.volume, muteBass: project.harmonyConfig.muteBass,
      });
    }
  });

  const rendered = await offlineCtx.startRendering();
  const blob = encodeWavBlob(rendered.getChannelData(0), sampleRate);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(project.title || 'toada').toLowerCase().replace(/\s+/g, '_')}_complet.wav`;
  a.click();
  URL.revokeObjectURL(url);
}
