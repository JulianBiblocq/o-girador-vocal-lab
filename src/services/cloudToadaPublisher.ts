/**
 * cloudToadaPublisher.ts
 * Téléversement d'un unique fichier .wav maître 16-bit Mono par pattern actif (usageCount > 0),
 * zéro speedVariants (75%/88%), zéro double-trim, et publication dans Firestore `/toada_packs` (< 130 lignes).
 */
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { storage } from './firebaseClient';
import { type ToadaProject, type VocalPatternItem, DEFAULT_TOADA_BPM } from '../types/toadaProject.types';
import { getSequenciadorToadaUrl } from '../utils/ecosystemUrls';
import { getBeatsPerMeasure } from '../utils/musicalMath';
import { getPatternT1OffsetSec } from '../utils/anacrusisTimingHelper';
import { resolveProjectDualScale } from '../utils/scaleTranspositionHelper';
import { getOrComputeTroupeTransposedPCM } from '../audio/formantPreservingPitchShifter';
import { pcmToWavBlob, slicePatternPcm, sanitizePatternForFirestore } from './toadaPublishHelpers';
import { getPatternUsageCount, getUnusedPatternsSummary, deleteOrphanPatternWavsFromStorage } from '../utils/unusedPatternsPurger';

export function removeUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as unknown as T;
  if (Array.isArray(obj)) return obj.map((item) => removeUndefinedFields(item)) as unknown as T;
  if (typeof obj === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) if (value !== undefined) clean[key] = removeUndefinedFields(value);
    return clean as T;
  }
  return obj;
}

export function getSequenciadorUrl(toadaId: string): string {
  return getSequenciadorToadaUrl(toadaId);
}

export function getActiveTimelinePatterns(project: ToadaProject): VocalPatternItem[] {
  const used = (project.patterns || []).filter((p) => getPatternUsageCount(project, p.id) > 0);
  return used.length > 0 ? used : (project.patterns || []);
}

export function buildSequencerToadaPackDocument(
  project: ToadaProject, processedPatterns?: Record<string, any>[], targetSequenciadorBpm?: number
): Record<string, any> {
  const toadaId = project.id;
  const projectBpm = Number(targetSequenciadorBpm || project.bpm || project.toadaMeta?.bpmDefaut || DEFAULT_TOADA_BPM);
  const dualScale = resolveProjectDualScale(project, 'fr'), shiftSt = dualScale.transpositionSemitones;
  const sequenciadorExportMode = project.sequenciadorExportMode ?? 'rhythm_only', ignoreMelodyPitch = sequenciadorExportMode === 'rhythm_only';
  const sourcePatterns = getActiveTimelinePatterns(project);
  const patterns = (processedPatterns ?? sourcePatterns.map((p) => {
    const recBpm = Number((p as any).recordedBpm || p.recordingResult?.recordedBpm || p.baseBpm || p.bpm || projectBpm);
    return sanitizePatternForFirestore(p, (p as any).audioUrl, undefined, p.t1OffsetSec, undefined, shiftSt, {
      sungKey: dualScale.sungScaleLabel, troupeKey: dualScale.troupeScaleLabel, ignoreMelodyPitch, recordedBpm: recBpm,
    });
  })).map((pat) => ({ ...pat, sungKey: pat.sungKey ?? dualScale.sungScaleLabel, troupeKey: pat.troupeKey ?? dualScale.troupeScaleLabel, transpositionSemitones: pat.transpositionSemitones ?? shiftSt, ignoreMelodyPitch }));

  return {
    id: toadaId, title: project.title, bpm: projectBpm, timeSignature: project.timeSignature, sequenciadorExportMode, ignoreMelodyPitch,
    sungKey: dualScale.sungScaleLabel, troupeKey: dualScale.troupeScaleLabel,
    sungScaleRoot: dualScale.sungScaleRoot, sungScaleMode: dualScale.sungScaleMode, troupeScaleRoot: dualScale.troupeScaleRoot, transpositionSemitones: shiftSt,
    project: {
      id: project.id, title: project.title, bpm: projectBpm, timeSignature: project.timeSignature, sequenciadorExportMode, ignoreMelodyPitch,
      sungKey: dualScale.sungScaleLabel, troupeKey: dualScale.troupeScaleLabel, transpositionSemitones: shiftSt,
      measuresCount: (project as any).measuresCount || 2, harmonyConfig: project.harmonyConfig ?? null, updatedAt: Date.now(),
    },
    metadata: {
      title: project.title, toada: project.title, bpm: projectBpm, timeSignature: project.timeSignature, sequenciadorExportMode, ignoreMelodyPitch,
      sungKey: dualScale.sungScaleLabel, troupeKey: dualScale.troupeScaleLabel, transpositionSemitones: shiftSt, publishedAt: Date.now(),
    },
    toadaMeta: { ...(project.toadaMeta || {}), bpmDefaut: projectBpm, tonaliteDefaut: dualScale.troupeScaleLabel, tonaliteChanteeOrigine: dualScale.sungScaleLabel, transpositionSemitones: shiftSt },
    patterns, arrangementSlots: project.slots || [], slots: project.slots || [],
    harmonyConfig: project.harmonyConfig ?? null, globalHarmonyGrid: project.globalHarmonyGrid ?? null,
    createdAt: (project as any).createdAt || Date.now(), updatedAt: Date.now(),
  };
}

export async function publishToadaToSequencer(
  project: ToadaProject, onProgress?: (stepText: string) => void, targetSequenciadorBpm?: number
): Promise<{ success: boolean; toadaId: string; sequenciadorUrl: string; exportedPatternsCount: number; savedMegabytes: string; publishedPack: Record<string, any> }> {
  const toadaId = project.id, processedPatterns: Record<string, any>[] = [];
  const projectBpm = Number(project.bpm || project.toadaMeta?.bpmDefaut || DEFAULT_TOADA_BPM);
  const beatsPerMeasure = getBeatsPerMeasure(project.timeSignature);
  const dualScale = resolveProjectDualScale(project, 'fr'), shiftSt = dualScale.transpositionSemitones;
  const ignoreMelodyPitch = (project.sequenciadorExportMode ?? 'rhythm_only') === 'rhythm_only';
  const activePatterns = getActiveTimelinePatterns(project), unusedSummary = getUnusedPatternsSummary(project);

  if (unusedSummary.count > 0 && activePatterns.length < project.patterns.length) {
    deleteOrphanPatternWavsFromStorage(toadaId, unusedSummary.unusedPatternIds);
  }

  for (let i = 0; i < activePatterns.length; i++) {
    const p = activePatterns[i];
    onProgress?.(`Téléversement audio maître (${i + 1}/${activePatterns.length})...`);
    let audioUrl: string | undefined, slicedDurationSec: number | undefined, exportedT1OffsetSec: number | undefined, startOffsetSec: number | undefined;
    const masterVar = p.variants?.norm_norm || p.variants?.[p.activeVariantKey], rec = p.recordingResult ?? masterVar?.recordingResult;
    const recordedBpm = Number((p as any).recordedBpm || rec?.recordedBpm || p.baseBpm || p.bpm || projectBpm);
    const measureDurationSec = beatsPerMeasure * (60 / recordedBpm), sampleRate = rec?.sampleRate || p.pack?.audio?.sampleRate || 44100;
    const useCorr = Boolean(p.correctedAudioSamples && p.correctedAudioSamples.length > 0), fullPcm = useCorr ? p.correctedAudioSamples : (rec?.pcm ?? p.rawAudioSamples);
    const explicitT1 = p.t1OffsetSec ?? masterVar?.t1OffsetSec ?? rec?.t1OffsetSec;
    const rawT1 = useCorr ? getPatternT1OffsetSec(p.hasAnacrusis, measureDurationSec) : getPatternT1OffsetSec(p.hasAnacrusis, measureDurationSec, explicitT1);
    const rawTrimStart = useCorr ? (p.pack?.audio?.trim?.startSec ?? 0) : (p.trimStartSec ?? masterVar?.trimStartSec ?? 0);
    const rawEnd = useCorr ? (p.pack?.audio?.trim?.endSec ?? 0) : (p.trimEndSec || masterVar?.trimEndSec || 0);
    const rawTrimEnd = rawEnd > 0 ? rawEnd : (fullPcm ? fullPcm.length / sampleRate : 0);

    if (fullPcm && fullPcm.length > 0) {
      try {
        const sliced = slicePatternPcm(fullPcm, sampleRate, rawT1, rawTrimStart, rawTrimEnd);
        slicedDurationSec = sliced.slicedDurationSec; exportedT1OffsetSec = sliced.exportedT1OffsetSec; startOffsetSec = sliced.startOffsetSec;
        const troupePcm = shiftSt !== 0 ? getOrComputeTroupeTransposedPCM(sliced.slicedPcm, sampleRate, shiftSt) : sliced.slicedPcm;
        const storageRef = ref(storage, `vocalRecordings/${toadaId}_${p.id}.wav`);
        await uploadBytes(storageRef, pcmToWavBlob(troupePcm, sampleRate), { contentType: 'audio/wav' });
        audioUrl = await getDownloadURL(storageRef);
      } catch (err) {
        console.warn(`[cloudToadaPublisher] Échec upload audio maître ${p.id} :`, err);
      }
    }
    processedPatterns.push(sanitizePatternForFirestore(p, audioUrl, slicedDurationSec, exportedT1OffsetSec, startOffsetSec, shiftSt, {
      sungKey: dualScale.sungScaleLabel, troupeKey: dualScale.troupeScaleLabel, ignoreMelodyPitch, recordedBpm,
    }));
  }

  onProgress?.('Enregistrement du pack dans Firestore...');
  const publishedPack = removeUndefinedFields(buildSequencerToadaPackDocument(project, processedPatterns, targetSequenciadorBpm));
  await setDoc(doc(db, 'toada_packs', toadaId), publishedPack);
  return { success: true, toadaId, sequenciadorUrl: getSequenciadorUrl(toadaId), exportedPatternsCount: activePatterns.length, savedMegabytes: unusedSummary.formattedMegabytes, publishedPack };
}
