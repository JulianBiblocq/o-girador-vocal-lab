/**
 * cloudToadaPublisher.ts
 * Téléversement des WAV découpés dans Storage et publication du pack Toada (< 50 Ko)
 * dans Firestore pour Sequenciador (< 125 lignes, Rule 6.A).
 */
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { storage } from './firebaseClient';
import { type ToadaProject, DEFAULT_TOADA_BPM } from '../types/toadaProject.types';
import { getSequenciadorToadaUrl } from '../utils/ecosystemUrls';
import { getBeatsPerMeasure } from '../utils/musicalMath';
import { getPatternT1OffsetSec } from '../utils/anacrusisTimingHelper';
import { pcmToWavBlob, slicePatternPcm, sanitizePatternForFirestore } from './toadaPublishHelpers';

export function removeUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as unknown as T;
  if (Array.isArray(obj)) return obj.map((item) => removeUndefinedFields(item)) as unknown as T;
  if (typeof obj === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) clean[key] = removeUndefinedFields(value);
    }
    return clean as T;
  }
  return obj;
}

export function getSequenciadorUrl(toadaId: string): string {
  return getSequenciadorToadaUrl(toadaId);
}

export async function publishToadaToSequencer(
  project: ToadaProject,
  onProgress?: (stepText: string) => void
): Promise<{ success: boolean; toadaId: string; sequenciadorUrl: string }> {
  const toadaId = project.id;
  const processedPatterns = [];
  const projectBpm = Number(project.bpm || project.toadaMeta?.bpmDefaut || DEFAULT_TOADA_BPM);
  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);

  for (let i = 0; i < project.patterns.length; i++) {
    const p = project.patterns[i];
    onProgress?.(`Téléversement audio (${i + 1}/${project.patterns.length})...`);
    let audioUrl: string | undefined;

    const patBpm = Number(p.baseBpm || p.bpm || projectBpm);
    const measureDurationSec = beatsPerMeasure * (60 / patBpm);
    const variant = p.variants?.[p.activeVariantKey] || Object.values(p.variants || {})[0];
    const rec = variant?.recordingResult ?? p.recordingResult;
    const sampleRate = rec?.sampleRate || p.pack?.audio?.sampleRate || 44100;

    let fullPcm: Float32Array | null | undefined;
    let rawT1: number;
    let trimStart: number;
    let trimEnd: number;

    if (p.correctedAudioSamples && p.correctedAudioSamples.length > 0) {
      // Référentiel cleanPCM (retouche Melodyne active)
      fullPcm = p.correctedAudioSamples;
      rawT1 = getPatternT1OffsetSec(p.hasAnacrusis, measureDurationSec);
      trimStart = p.pack?.audio?.trim?.startSec ?? 0;
      trimEnd = p.pack?.audio?.trim?.endSec ?? (fullPcm.length / sampleRate);
    } else {
      // Référentiel recordingResult.pcm (prise directe ou tranche Slicer)
      fullPcm = rec?.pcm ?? p.rawAudioSamples;
      const explicitT1 = p.t1OffsetSec ?? variant?.t1OffsetSec ?? rec?.t1OffsetSec;
      rawT1 = getPatternT1OffsetSec(p.hasAnacrusis, measureDurationSec, explicitT1);
      trimStart = variant?.trimStartSec ?? p.trimStartSec ?? 0;
      const rawEnd = variant?.trimEndSec || p.trimEndSec || 0;
      trimEnd = rawEnd > 0 ? rawEnd : (fullPcm ? fullPcm.length / sampleRate : 0);
    }

    let slicedDurationSec: number | undefined;
    let exportedT1OffsetSec: number | undefined;
    let startOffsetSec: number | undefined;

    if (fullPcm && fullPcm.length > 0) {
      try {
        const sliced = slicePatternPcm(fullPcm, sampleRate, rawT1, trimStart, trimEnd);
        slicedDurationSec = sliced.slicedDurationSec;
        exportedT1OffsetSec = sliced.exportedT1OffsetSec;
        startOffsetSec = sliced.startOffsetSec;

        const wavBlob = pcmToWavBlob(sliced.slicedPcm, sampleRate);
        const storageRef = ref(storage, `vocalRecordings/${toadaId}_${p.id}.wav`);
        await uploadBytes(storageRef, wavBlob, { contentType: 'audio/wav' });
        audioUrl = await getDownloadURL(storageRef);
      } catch (err) {
        console.warn(`[cloudToadaPublisher] Échec upload audio ${p.id} :`, err);
      }
    }

    const cleanPat = sanitizePatternForFirestore(p, audioUrl, slicedDurationSec, exportedT1OffsetSec, startOffsetSec);
    processedPatterns.push(cleanPat);
  }

  onProgress?.('Enregistrement du pack dans Firestore...');
  const packDoc = {
    id: toadaId,
    title: project.title,
    bpm: projectBpm,
    timeSignature: project.timeSignature,
    project: {
      id: project.id,
      title: project.title,
      bpm: projectBpm,
      timeSignature: project.timeSignature,
      measuresCount: (project as any).measuresCount || 2,
      harmonyConfig: project.harmonyConfig ?? null,
      updatedAt: Date.now(),
    },
    metadata: {
      title: project.title,
      toada: project.title,
      bpm: projectBpm,
      timeSignature: project.timeSignature,
      publishedAt: Date.now(),
    },
    toadaMeta: project.toadaMeta ?? null,
    patterns: processedPatterns,
    arrangementSlots: project.slots || [],
    slots: project.slots || [],
    harmonyConfig: project.harmonyConfig ?? null,
    globalHarmonyGrid: project.globalHarmonyGrid ?? null,
    createdAt: (project as any).createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  const cleanDoc = removeUndefinedFields(packDoc);
  await setDoc(doc(db, 'toada_packs', toadaId), cleanDoc);
  const sequenciadorUrl = getSequenciadorUrl(toadaId);
  return { success: true, toadaId, sequenciadorUrl };
}
