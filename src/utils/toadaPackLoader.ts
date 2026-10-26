/**
 * toadaPackLoader.ts
 * Reouverture, decodage et restauration complete d'un Pack Toada JSON (< 120 lignes).
 * Decode les WAV Base64 synchronement en Float32Array PCM.
 */
import type { ToadaProject, VocalPatternItem, VocalAudioVariant } from '../types/toadaProject.types';
import { createDefaultToadaProject } from '../types/toadaProject.types';

export function decodeBase64Wav(rawB64: string): { pcm: Float32Array; sampleRate: number } | null {
  try {
    const cleanB64 = rawB64.includes(',') ? rawB64.split(',')[1] : rawB64;
    const binary = atob(cleanB64);
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const view = new DataView(buffer);
    const sampleRate = view.getUint32(24, true);
    const bitsPerSample = view.getUint16(34, true);
    let offset = 12;
    while (offset < binary.length - 8) {
      const chunkId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
      const chunkSize = view.getUint32(offset + 4, true);
      if (chunkId === 'data') {
        const dataOffset = offset + 8;
        const numSamples = Math.floor(chunkSize / (bitsPerSample / 8));
        const pcm = new Float32Array(numSamples);
        if (bitsPerSample === 16) {
          for (let s = 0; s < numSamples; s++) pcm[s] = view.getInt16(dataOffset + s * 2, true) / 32768.0;
        } else if (bitsPerSample === 32) {
          for (let s = 0; s < numSamples; s++) pcm[s] = view.getFloat32(dataOffset + s * 4, true);
        }
        return { pcm, sampleRate };
      }
      offset += 8 + chunkSize;
    }
  } catch (err) {
    console.warn('[toadaPackLoader] Erreur decodage WAV Base64 :', err);
  }
  return null;
}

export function parseToadaPack(jsonText: string): ToadaProject {
  const data = JSON.parse(jsonText);
  if (!data) throw new Error('Format JSON invalide');

  if (data.schemaVersion === '2.0' && data.patterns) {
    const patterns: VocalPatternItem[] = data.patterns.map((p: any) => {
      const variants: Record<string, VocalAudioVariant> = {};
      for (const [key, v] of Object.entries(p.variants || {})) {
        const ev = v as any;
        const decoded = ev.audioBase64 ? decodeBase64Wav(ev.audioBase64) : null;
        variants[key] = {
          variantKey: ev.variantKey, speedRatio: ev.speedRatio ?? 1.0, pitchShiftSemitones: ev.pitchShiftSemitones ?? 0,
          coverage: ev.coverage ?? { minBpmRatio: 0.87, maxBpmRatio: 1.15, minSemitones: -4, maxSemitones: 4 },
          recordingResult: decoded, trimStartSec: ev.trimStartSec ?? 0, trimEndSec: ev.trimEndSec ?? ev.durationSec ?? 0,
          lowCutEnabled: ev.lowCutEnabled ?? true, enableTonePolish: ev.enableTonePolish ?? true,
        };
      }
      const activeKey = p.activeVariantKey || Object.keys(variants)[0] || 'spd100_pit0';
      const activeV = variants[activeKey] ?? Object.values(variants)[0];
      return {
        id: p.id, name: p.name, role: p.role, measuresCount: p.measuresCount ?? 2,
        hasAnacrusis: p.hasAnacrusis ?? (p.anacrusisSteps && p.anacrusisSteps.length > 0 ? true : (p.anacrusisSteps !== undefined ? false : true)),
        baseBpm: p.baseBpm ?? data.project?.bpm ?? 88, bpm: p.bpm ?? p.baseBpm ?? data.project?.bpm ?? 88, referencePitch: p.referencePitch ?? 'C4',
        pitchCorrectionAmount: p.pitchCorrectionAmount ?? 0, linkedSourcePatternId: p.linkedSourcePatternId ?? null,
        activeVariantKey: activeKey, variants, recordingResult: activeV?.recordingResult ?? null,
        rawAudioSamples: activeV?.recordingResult?.pcm ?? null, correctedAudioSamples: null,
        trimStartSec: activeV?.trimStartSec ?? 0, trimEndSec: activeV?.trimEndSec ?? 0,
        lowCutEnabled: activeV?.lowCutEnabled ?? true, enableTonePolish: activeV?.enableTonePolish ?? true,
        anacrusisSteps: p.anacrusisSteps || [], mainSteps: p.mainSteps || [], pitchCurve: p.pitchCurve || [],
        melodyneRegions: p.melodyneRegions || [],
        assignedLyricsText: p.assignedLyricsText,
        assignedPhoneticText: p.assignedPhoneticText,
        harmonyGrid: p.harmonyGrid,
        pack: null, midiLocked: true, isMidiInitialized: (p.mainSteps && p.mainSteps.length > 0),
      };
    });

    return {
      id: data.project?.id || `toada-${Date.now().toString(36)}`,
      title: data.project?.title || 'Toada Restauree',
      bpm: data.project?.bpm || 55, timeSignature: data.project?.timeSignature || '4/4',
      patterns, slots: data.arrangementSlots || [], activePatternId: patterns[0]?.id || '',
      toadaMeta: data.project?.toadaMeta || data.toadaMeta,
      globalHarmonyGrid: data.globalHarmonyGrid || data.project?.globalHarmonyGrid,
      harmonyConfig: data.harmonyConfig || data.project?.harmonyConfig,
    };
  }

  if (data.schemaVersion === '1.0' && data.audio) {
    const proj = createDefaultToadaProject();
    proj.bpm = data.metadata?.bpm || 55; proj.timeSignature = data.metadata?.timeSignature || '4/4';
    const decoded = data.audio.audioBase64 ? decodeBase64Wav(data.audio.audioBase64) : null;
    if (proj.patterns[0]) {
      const pat = proj.patterns[0];
      pat.anacrusisSteps = data.alignment?.anacrusis?.steps || [];
      pat.mainSteps = data.grid?.steps || []; pat.pitchCurve = data.pitchCurve || [];
      pat.isMidiInitialized = true; pat.midiLocked = true; pat.recordingResult = decoded; pat.rawAudioSamples = decoded?.pcm ?? null;
      pat.trimStartSec = data.audio.trim?.startSec ?? 0; pat.trimEndSec = data.audio.trim?.endSec ?? 0;
      if (pat.variants[pat.activeVariantKey]) {
        pat.variants[pat.activeVariantKey].recordingResult = decoded;
        pat.variants[pat.activeVariantKey].trimStartSec = pat.trimStartSec;
        pat.variants[pat.activeVariantKey].trimEndSec = pat.trimEndSec;
      }
    }
    return proj;
  }
  throw new Error('Version de schema non supportee');
}
