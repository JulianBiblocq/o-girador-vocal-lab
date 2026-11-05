/**
 * toadaSyncService.ts
 * Service de re-synchronisation unifiée non destructive depuis Firestore Organizador (< 130 lignes).
 * Apparie par cardIndex (puis clé normalisée) et recalcule l'alignement syllabique sur l'audio existant.
 */
import { type ToadaProject, type VocalPatternItem, DEFAULT_TOADA_BPM } from '../types/toadaProject.types';
import { fetchOrganizadorToadas, fetchOrganizadorToadaById, type ToadaDocument } from '../services/firebaseClient';
import { normalizeSongTitle } from './varalSongFilter';
import { parseToadaDocument } from './toadaSheetParser';
import { generateToadaFromSheet } from './toadaConductorGenerator';
import { buildNormalizedPatternKey } from './timeAnchorParser';
import { getBeatsPerMeasure } from './musicalMath';
import { getDefaultBeatResolutions } from './alignmentMath';
import { extractPatternMelodicData } from '../audio/melodicExtractionHelper';

function findMatchingExistingPattern(
  newPat: VocalPatternItem,
  newIdx: number,
  existingPatterns: VocalPatternItem[],
  usedIds: Set<string>
): VocalPatternItem | undefined {
  const targetCardIdx = newPat.cardIndex ?? newIdx;

  // 1. Priorité absolue : même cardIndex et même rôle
  const byCardAndRole = existingPatterns.find(
    (p, idx) => !usedIds.has(p.id) && (p.cardIndex ?? idx) === targetCardIdx && p.role === newPat.role
  );
  if (byCardAndRole) return byCardAndRole;

  // 2. Repli : même clé normalisée (texte + ancres)
  const targetKey = buildNormalizedPatternKey(newPat.role, newPat.assignedLyricsText || '', newPat.timeAnchors);
  const byNormKey = existingPatterns.find(
    (p) => !usedIds.has(p.id) && buildNormalizedPatternKey(p.role, p.assignedLyricsText || '', p.timeAnchors) === targetKey
  );
  if (byNormKey) return byNormKey;

  // 3. Repli : même rôle et même nom (1er mot)
  const byRoleAndName = existingPatterns.find(
    (p) => !usedIds.has(p.id) && p.role === newPat.role && p.name === newPat.name
  );
  if (byRoleAndName) return byRoleAndName;

  // 4. Repli : même cardIndex même si le rôle a basculé
  return existingPatterns.find((p, idx) => !usedIds.has(p.id) && (p.cardIndex ?? idx) === targetCardIdx);
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
  const usedIds = new Set<string>();

  freshProject.patterns = freshProject.patterns.map((newPat, idx) => {
    const matched = findMatchingExistingPattern(newPat, idx, project.patterns, usedIds);
    if (matched) usedIds.add(matched.id);

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
    return { ...newPat, baseBpm: targetBpm, bpm: targetBpm };
  });

  freshProject.toadaMeta = { ...(project.toadaMeta || {}), ...doc, bpmDefaut: targetBpm };
  const toastMessage = `Toada « ${doc.titre} » synchronisée avec Organizador (${freshProject.patterns.length} blocs) !`;
  return { updatedProject: freshProject, toastMessage };
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
  } catch (err) {
    console.warn('[toadaSyncService] Échec récupération Organizador :', err);
  }

  return doc ? mergeSyncedToadaDocIntoProject(project, doc) : null;
}
