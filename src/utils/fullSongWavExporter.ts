/**
 * fullSongWavExporter.ts
 * Export WAV 16-bit PCM du chant complet (enchaînement des blocs du Conducteur)
 * via OfflineAudioContext avec gestion du tuilage d'anacrouse (< 110 lignes).
 */
import type { ToadaProject, VocalPatternItem } from '../types/toadaProject.types';
import { getBeatsPerMeasure } from './musicalMath';
import { getPatternT1OffsetSec } from './anacrusisTimingHelper';
import { scheduleMelodySteps } from '../audio/synthVoiceHelper';

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

function schedulePatternAudio(ctx: BaseAudioContext, pat: VocalPatternItem, slotT1Sec: number, measureDurationSec: number) {
  const variant = pat.variants?.[pat.activeVariantKey];
  const rec = variant?.recordingResult ?? pat.recordingResult;
  const explicitT1 = variant?.t1OffsetSec ?? pat.t1OffsetSec ?? rec?.t1OffsetSec;
  const t1OffsetSec = getPatternT1OffsetSec(pat.hasAnacrusis, measureDurationSec, explicitT1);

  if (rec && rec.pcm && rec.pcm.length > 0) {
    const { pcm, sampleRate } = rec;
    const trimStartSec = variant?.trimStartSec || pat.trimStartSec || 0;
    const trimEndSec = (variant?.trimEndSec || pat.trimEndSec || 0) > 0 ? (variant?.trimEndSec || pat.trimEndSec || 0) : pcm.length / sampleRate;
    const sStart = Math.max(0, Math.floor(trimStartSec * sampleRate));
    const sEnd = Math.min(pcm.length, Math.floor(trimEndSec * sampleRate));
    const len = Math.max(0, sEnd - sStart);
    if (len === 0) return;

    const audioBuf = ctx.createBuffer(1, len, sampleRate);
    audioBuf.getChannelData(0).set(pcm.subarray(sStart, sEnd));
    const source = ctx.createBufferSource();
    source.buffer = audioBuf;
    source.connect(ctx.destination);
    const when = slotT1Sec + (trimStartSec - t1OffsetSec);
    if (when >= 0) {
      source.start(when);
    } else {
      const elapsed = -when;
      if (elapsed < len / sampleRate) source.start(0, elapsed);
    }
  } else if (pat.mainSteps && pat.mainSteps.length > 0) {
    const stepDur = measureDurationSec / 16;
    if (pat.hasAnacrusis && pat.anacrusisSteps?.length > 0) {
      scheduleMelodySteps(ctx as any, ctx.destination, pat.anacrusisSteps, stepDur, Math.max(0, slotT1Sec - t1OffsetSec));
    }
    scheduleMelodySteps(ctx as any, ctx.destination, pat.mainSteps, stepDur, slotT1Sec);
  }
}

export async function exportFullSongWav(project: ToadaProject): Promise<void> {
  const bpm = project.bpm || 100;
  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const measureDurationSec = beatsPerMeasure * (60 / bpm);

  let totalMeasures = 1;
  project.slots.forEach((s) => {
    const pPat = project.patterns.find((p) => p.id === s.puxadorPatternId);
    const cPat = project.patterns.find((p) => p.id === s.coroPatternId);
    totalMeasures += Math.max(pPat?.measuresCount ?? 2, cPat?.measuresCount ?? 2, 2);
  });

  const totalDurationSec = (totalMeasures + 1) * measureDurationSec + 1.0;
  const sampleRate = 44100;
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(totalDurationSec * sampleRate), sampleRate);

  let currentMeasure = 1;
  project.slots.forEach((slot) => {
    const puxPat = project.patterns.find((p) => p.id === slot.puxadorPatternId);
    const coroPat = project.patterns.find((p) => p.id === slot.coroPatternId);
    const measuresInSlot = Math.max(puxPat?.measuresCount ?? 2, coroPat?.measuresCount ?? 2, 2);
    const slotT1Sec = currentMeasure * measureDurationSec;

    if (puxPat) schedulePatternAudio(offlineCtx, puxPat, slotT1Sec, measureDurationSec);
    if (coroPat) schedulePatternAudio(offlineCtx, coroPat, slotT1Sec, measureDurationSec);
    currentMeasure += measuresInSlot;
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
