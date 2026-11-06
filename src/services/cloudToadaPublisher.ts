/**
 * cloudToadaPublisher.ts
 * Téléversement des WAV découpés (rendus avec formantPreservingPitchShifter dans la Tonalité de la Troupe)
 * dans Storage et publication du pack Toada complet dans Firestore `/toada_packs` pour Sequenciador (< 140 lignes).
 */
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { storage } from './firebaseClient';
import { type ToadaProject, DEFAULT_TOADA_BPM } from '../types/toadaProject.types';
import { getSequenciadorToadaUrl } from '../utils/ecosystemUrls';
import { getBeatsPerMeasure } from '../utils/musicalMath';
import { getPatternT1OffsetSec } from '../utils/anacrusisTimingHelper';
import { resolveProjectDualScale } from '../utils/scaleTranspositionHelper';
import { getOrComputeTroupeTransposedPCM } from '../audio/formantPreservingPitchShifter';
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

export function buildSequencerToadaPackDocument(
  project: ToadaProject,
  processedPatterns?: Record<string, any>[]
): Record<string, any> {
  const toadaId = project.id;
  const projectBpm = Number(project.bpm || project.toadaMeta?.bpmDefaut || DEFAULT_TOADA_BPM);
  const dualScale = resolveProjectDualScale(project, 'fr');
  const shiftSt = dualScale.transpositionSemitones;

  const patterns = processedPatterns ?? project.patterns.map((p) =>
    sanitizePatternForFirestore(p, (p as any).audioUrl, p.trimEndSec, p.t1OffsetSec, undefined, shiftSt)
  );

  return {
    id: toadaId, title: project.title, bpm: projectBpm, timeSignature: project.timeSignature,
    sungKey: dualScale.sungScaleLabel, troupeKey: dualScale.troupeScaleLabel,
    sungScaleRoot: dualScale.sungScaleRoot, sungScaleMode: dualScale.sungScaleMode,
    troupeScaleRoot: dualScale.troupeScaleRoot, transpositionSemitones: shiftSt,
    project: {
      id: project.id, title: project.title, bpm: projectBpm, timeSignature: project.timeSignature,
      sungKey: dualScale.sungScaleLabel, troupeKey: dualScale.troupeScaleLabel, transpositionSemitones: shiftSt,
      measuresCount: (project as any).measuresCount || 2, harmonyConfig: project.harmonyConfig ?? null, updatedAt: Date.now(),
    },
    metadata: {
      title: project.title, toada: project.title, bpm: projectBpm, timeSignature: project.timeSignature,
      sungKey: dualScale.sungScaleLabel, troupeKey: dualScale.troupeScaleLabel, transpositionSemitones: shiftSt, publishedAt: Date.now(),
    },
    toadaMeta: {
      ...(project.toadaMeta || {}), tonaliteDefaut: dualScale.troupeScaleLabel,
      tonaliteChanteeOrigine: dualScale.sungScaleLabel, transpositionSemitones: shiftSt,
    },
    patterns, arrangementSlots: project.slots || [], slots: project.slots || [],
    harmonyConfig: project.harmonyConfig ?? null, globalHarmonyGrid: project.globalHarmonyGrid ?? null,
    createdAt: (project as any).createdAt || Date.now(), updatedAt: Date.now(),
  };
}

export async function publishToadaToSequencer(
  project: ToadaProject,
  onProgress?: (stepText: string) => void
): Promise<{ success: boolean; toadaId: string; sequenciadorUrl: string }> {
  const toadaId = project.id;
  const processedPatterns: Record<string, any>[] = [];
  const projectBpm = Number(project.bpm || project.toadaMeta?.bpmDefaut || DEFAULT_TOADA_BPM);
  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const dualScale = resolveProjectDualScale(project, 'fr');
  const shiftSt = dualScale.transpositionSemitones;

  for (let i = 0; i < project.patterns.length; i++) {
    const p = project.patterns[i];
    onProgress?.(`Téléversement audio (${i + 1}/${project.patterns.length})...`);
    let audioUrl: string | undefined;

    const patBpm = Number(p.baseBpm || p.bpm || projectBpm);
    const measureDurationSec = beatsPerMeasure * (60 / patBpm);
    const variant = p.variants?.[p.activeVariantKey] || Object.values(p.variants || {})[0];
    const rec = variant?.recordingResult ?? p.recordingResult;
    const sampleRate = rec?.sampleRate || p.pack?.audio?.sampleRate || 44100;

    const useCorr = Boolean(p.correctedAudioSamples && p.correctedAudioSamples.length > 0);
    const fullPcm = useCorr ? p.correctedAudioSamples : (rec?.pcm ?? p.rawAudioSamples);
    const explicitT1 = p.t1OffsetSec ?? variant?.t1OffsetSec ?? rec?.t1OffsetSec;
    const rawT1 = useCorr ? getPatternT1OffsetSec(p.hasAnacrusis, measureDurationSec) : getPatternT1OffsetSec(p.hasAnacrusis, measureDurationSec, explicitT1);
    const trimStart = useCorr ? (p.pack?.audio?.trim?.startSec ?? 0) : (variant?.trimStartSec ?? p.trimStartSec ?? 0);
    const rawEnd = useCorr ? (p.pack?.audio?.trim?.endSec ?? 0) : (variant?.trimEndSec || p.trimEndSec || 0);
    const trimEnd = rawEnd > 0 ? rawEnd : (fullPcm ? fullPcm.length / sampleRate : 0);

    let slicedDurationSec: number | undefined, exportedT1OffsetSec: number | undefined, startOffsetSec: number | undefined;
    if (fullPcm && fullPcm.length > 0) {
      try {
        const sliced = slicePatternPcm(fullPcm, sampleRate, rawT1, trimStart, trimEnd);
        slicedDurationSec = sliced.slicedDurationSec;
        exportedT1OffsetSec = sliced.exportedT1OffsetSec;
        startOffsetSec = sliced.startOffsetSec;
        const troupePcm = shiftSt !== 0 ? getOrComputeTroupeTransposedPCM(sliced.slicedPcm, sampleRate, shiftSt) : sliced.slicedPcm;
        const wavBlob = pcmToWavBlob(troupePcm, sampleRate);
        const storageRef = ref(storage, `vocalRecordings/${toadaId}_${p.id}.wav`);
        await uploadBytes(storageRef, wavBlob, { contentType: 'audio/wav' });
        audioUrl = await getDownloadURL(storageRef);
      } catch (err) {
        console.warn(`[cloudToadaPublisher] Échec upload audio ${p.id} :`, err);
      }
    }

    processedPatterns.push(sanitizePatternForFirestore(p, audioUrl, slicedDurationSec, exportedT1OffsetSec, startOffsetSec, shiftSt));
  }

  onProgress?.('Enregistrement du pack dans Firestore...');
  const cleanDoc = removeUndefinedFields(buildSequencerToadaPackDocument(project, processedPatterns));
  await setDoc(doc(db, 'toada_packs', toadaId), cleanDoc);
  return { success: true, toadaId, sequenciadorUrl: getSequenciadorUrl(toadaId) };
}
