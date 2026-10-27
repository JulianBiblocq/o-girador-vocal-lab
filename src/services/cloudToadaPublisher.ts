/**
 * cloudToadaPublisher.ts
 * Téléversement des WAV découpés dans Storage et publication du pack Toada (< 50 Ko)
 * dans Firestore pour Sequenciador (< 120 lignes, Rule 6.A).
 */
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { storage } from './firebaseClient';
import type { ToadaProject } from '../types/toadaProject.types';
import { getSequenciadorToadaUrl } from '../utils/ecosystemUrls';
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

  for (let i = 0; i < project.patterns.length; i++) {
    const p = project.patterns[i];
    onProgress?.(`Téléversement audio (${i + 1}/${project.patterns.length})...`);
    let audioUrl: string | undefined;

    const variant = p.variants?.[p.activeVariantKey] || Object.values(p.variants || {})[0];
    const fullPcm = p.correctedAudioSamples || p.rawAudioSamples || variant?.recordingResult?.pcm;
    const sampleRate = variant?.recordingResult?.sampleRate || 44100;
    const rawT1 = p.t1OffsetSec ?? variant?.t1OffsetSec ?? 0;
    const trimStart = variant?.trimStartSec ?? p.trimStartSec ?? 0;
    const trimEnd = variant?.trimEndSec ?? p.trimEndSec ?? (fullPcm ? fullPcm.length / sampleRate : 0);

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
    project: {
      id: project.id,
      title: project.title,
      bpm: project.bpm,
      timeSignature: project.timeSignature,
      measuresCount: (project as any).measuresCount || 2,
      harmonyConfig: project.harmonyConfig ?? null,
      updatedAt: Date.now(),
    },
    metadata: {
      title: project.title,
      toada: project.title,
      bpm: project.bpm,
      timeSignature: project.timeSignature,
      harmonyConfig: project.harmonyConfig ?? null,
      toadaMeta: project.toadaMeta ?? null,
      notesLexique: project.toadaMeta?.notesLexique || [],
      questionsQcm: project.toadaMeta?.questionsQcm || [],
      publishedAt: Date.now(),
    },
    toadaMeta: project.toadaMeta ?? null,
    notesLexique: project.toadaMeta?.notesLexique || [],
    questionsQcm: project.toadaMeta?.questionsQcm || [],
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
