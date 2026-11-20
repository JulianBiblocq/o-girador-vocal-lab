/**
 * toadaSyncService.ts
 * Service de re-synchronisation unifiée non destructive depuis Firestore Organizador & Sequenciador `/toada_packs` (< 140 lignes).
 * Apparie par cardIndex (puis clé normalisée), recalcule l'alignement syllabique et synchronise transpositionSemitones / troupeKey.
 */
import { type ToadaProject, DEFAULT_TOADA_BPM } from '../types/toadaProject.types';
import { fetchOrganizadorToadas, fetchOrganizadorToadaById, fetchToadaPackById, type ToadaDocument } from '../services/firebaseClient';
import { normalizeSongTitle } from './varalSongFilter';
import { parseToadaDocument } from './toadaSheetParser';
import { generateToadaFromSheet } from './toadaConductorGenerator';
import { getBeatsPerMeasure } from './musicalMath';
import { getDefaultBeatResolutions } from './alignmentMath';
import { extractPatternMelodicData } from '../audio/melodicExtractionHelper';
import { parseStoredScaleString } from '../audio/projectScaleAnalyzer';
import { applyDualScaleToProject, computeSemitoneDistance, resolveProjectDualScale } from './scaleTranspositionHelper';
import { buildSyncedPatternMatchMap, mergeCloudOnlyMatchedPattern } from './patternTakeMatcher';
import { resolveCanonicalToadaPackId } from './toadaPackIdResolver';

export function applySequenciadorPackTranspositionToProject(
  project: ToadaProject,
  packData: { transpositionSemitones?: number; troupeKey?: string; sungKey?: string; sungScaleRoot?: string; sungScaleMode?: string; troupeScaleRoot?: string }
): ToadaProject {
  const currentDual = resolveProjectDualScale(project, 'fr');
  const parsedSung = parseStoredScaleString(packData.sungKey);
  const parsedTroupe = parseStoredScaleString(packData.troupeKey);
  const sungRoot = packData.sungScaleRoot || parsedSung?.tonic || currentDual.sungScaleRoot;
  const sungMode = (packData.sungScaleMode || parsedSung?.scaleType || parsedTroupe?.scaleType || currentDual.sungScaleMode) as any;

  let nextSt = packData.transpositionSemitones;
  if (nextSt === undefined && (packData.troupeScaleRoot || parsedTroupe?.tonic)) {
    nextSt = computeSemitoneDistance(sungRoot, (packData.troupeScaleRoot || parsedTroupe?.tonic)!);
  }
  return applyDualScaleToProject(project, sungRoot, sungMode, nextSt ?? currentDual.transpositionSemitones, currentDual.sungReferencePitch, 'fr');
}

export function mergeSyncedToadaDocIntoProject(
  project: ToadaProject,
  doc: ToadaDocument
): { updatedProject: ToadaProject; toastMessage: string } {
  const parsed = parseToadaDocument(doc, 'puxador');
  const targetBpm = Number(doc.bpmDefaut || (doc as any).bpm || (doc as any).tempo || parsed.docMeta?.bpmDefaut || project.bpm || DEFAULT_TOADA_BPM);
  const freshProject = generateToadaFromSheet(project, parsed, { bpm: targetBpm });
  freshProject.bpm = targetBpm;

  const beatsPerMeasure = getBeatsPerMeasure(freshProject.timeSignature);
  const defaultResolutions = getDefaultBeatResolutions(freshProject.timeSignature);
  const matchMap = buildSyncedPatternMatchMap(freshProject.patterns, project.patterns);

  freshProject.patterns = freshProject.patterns.map((newPat) => {
    const matched = matchMap.get(newPat.id);

    if (matched && matched.recordingResult && matched.recordingResult.pcm?.length > 0) {
      const rec = matched.recordingResult;
      const hasAnacrusis = newPat.hasAnacrusis !== false;
      const beatResolutions = matched.pack?.metadata.beatResolutions || defaultResolutions;
      const melodic = extractPatternMelodicData({
        rawPCM: rec.pcm, sampleRate: rec.sampleRate, bpm: targetBpm,
        timeSignature: freshProject.timeSignature, measuresCount: newPat.measuresCount,
        beatsPerMeasure, beatResolutions, hasAnacrusis,
        trimStartSec: matched.trimStartSec, trimEndSec: matched.trimEndSec,
        referencePitch: matched.referencePitch || 'C4', tessitura: matched.tessitura,
        assignedLyricsText: newPat.assignedLyricsText, timeAnchors: newPat.timeAnchors,
        lowCutEnabled: matched.lowCutEnabled !== false, enableTonePolish: matched.enableTonePolish !== false,
        t1OffsetSec: matched.t1OffsetSec ?? rec.t1OffsetSec,
      });

      return {
        ...newPat, baseBpm: targetBpm, bpm: targetBpm,
        referencePitch: matched.referencePitch || newPat.referencePitch, tessitura: matched.tessitura,
        variants: matched.variants, activeVariantKey: matched.activeVariantKey,
        recordingResult: matched.recordingResult, rawAudioSamples: melodic.cleanPCM,
        correctedAudioSamples: matched.correctedAudioSamples, melodyneRegions: matched.melodyneRegions,
        trimStartSec: matched.trimStartSec, trimEndSec: matched.trimEndSec,
        t1OffsetSec: matched.t1OffsetSec ?? rec.t1OffsetSec,
        lowCutEnabled: matched.lowCutEnabled, enableTonePolish: matched.enableTonePolish,
        pack: melodic.pack, rawPitchCurve: melodic.pitchCurve, pitchCurve: melodic.pitchCurve,
        anacrusisSteps: melodic.anacrusisSteps, mainSteps: melodic.mainSteps,
        isMidiInitialized: true, midiLocked: true,
      };
    }
    if (matched) return mergeCloudOnlyMatchedPattern(newPat, matched, targetBpm);
    return { ...newPat, baseBpm: targetBpm, bpm: targetBpm };
  });

  freshProject.toadaMeta = { ...(project.toadaMeta || {}), ...doc, bpmDefaut: targetBpm };
  const withDual = applySequenciadorPackTranspositionToProject(freshProject, {
    transpositionSemitones: doc.transpositionSemitones ?? project.transpositionSemitones,
    troupeKey: doc.tonaliteDefaut || project.toadaMeta?.tonaliteDefaut,
    sungKey: doc.tonaliteChanteeOrigine || project.toadaMeta?.tonaliteChanteeOrigine,
    sungScaleRoot: doc.sungScaleRoot || project.sungScaleRoot,
    sungScaleMode: doc.sungScaleMode || project.sungScaleMode,
    troupeScaleRoot: doc.troupeScaleRoot || project.troupeScaleRoot,
  });
  const toastMessage = `Toada « ${doc.titre} » synchronisée (${withDual.patterns.length} blocs • Troupe : ${withDual.toadaMeta?.tonaliteDefaut || 'Auto'}) !`;
  return { updatedProject: withDual, toastMessage };
}

export async function syncProjectWithOrganizador(
  project: ToadaProject,
  groupId?: string | null
): Promise<{ updatedProject: ToadaProject; toastMessage: string } | null> {
  const targetId = project.toadaMeta?.id || project.id;
  const projectTitle = project.title || project.toadaMeta?.titre;
  const effectiveGroupId = groupId || project.toadaMeta?.groupId;
  let doc: ToadaDocument | null = null;

  try {
    if (targetId) doc = await fetchOrganizadorToadaById(targetId, effectiveGroupId, projectTitle);
    if (!doc && projectTitle) {
      const all = await fetchOrganizadorToadas(effectiveGroupId);
      const cleanTitle = normalizeSongTitle(projectTitle);
      doc = all.find((d) => normalizeSongTitle(d.titre) === cleanTitle) ?? null;
    }
    const canonicalPackId = resolveCanonicalToadaPackId(project, doc || undefined);
    const cloudPack = (await fetchToadaPackById(canonicalPackId).catch(() => null))
      || (canonicalPackId !== project.id ? await fetchToadaPackById(project.id).catch(() => null) : null);
    if (cloudPack && doc) {
      if (cloudPack.transpositionSemitones !== undefined) doc.transpositionSemitones = cloudPack.transpositionSemitones;
      if (cloudPack.toadaMeta?.tonaliteDefaut) doc.tonaliteDefaut = cloudPack.toadaMeta.tonaliteDefaut;
      if (cloudPack.toadaMeta?.tonaliteChanteeOrigine) doc.tonaliteChanteeOrigine = cloudPack.toadaMeta.tonaliteChanteeOrigine;
    }
  } catch (err) {
    console.warn('[toadaSyncService] Échec récupération Organizador :', err);
  }

  return doc ? mergeSyncedToadaDocIntoProject(project, doc) : null;
}
