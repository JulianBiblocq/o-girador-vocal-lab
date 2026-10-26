/**
 * toadaSyncService.ts
 * Service de re-synchronisation unifiée depuis Firestore Organizador (< 95 lignes).
 */
import type { ToadaProject } from '../types/toadaProject.types';
import { fetchOrganizadorToadas, fetchOrganizadorToadaById, type ToadaDocument } from '../services/firebaseClient';
import { parseToadaDocument } from './toadaSheetParser';
import { generateToadaFromSheet } from './toadaConductorGenerator';

export async function syncProjectWithOrganizador(
  project: ToadaProject,
  groupId?: string | null
): Promise<{ updatedProject: ToadaProject; toastMessage: string } | null> {
  const targetId = project.toadaMeta?.id || project.id;
  let doc: ToadaDocument | null = null;

  try {
    if (targetId) {
      doc = await fetchOrganizadorToadaById(targetId, groupId);
    }
    if (!doc && project.title) {
      const all = await fetchOrganizadorToadas(groupId);
      const cleanTitle = project.title.trim().toLowerCase();
      doc = all.find((d) => d.titre.trim().toLowerCase() === cleanTitle) ?? null;
    }
  } catch (err) {
    console.warn('[toadaSyncService] Échec récupération Organizador :', err);
  }

  if (!doc) return null;

  const parsed = parseToadaDocument(doc, 'puxador');
  const freshProject = generateToadaFromSheet(project, parsed, {
    bpm: doc.bpmDefaut || project.bpm || 55,
  });

  // Préservation des audios enregistrés si les motifs correspondent
  const existingMap = new Map(project.patterns.map((p) => [`${p.role}_${p.name}`, p]));
  freshProject.patterns = freshProject.patterns.map((newPat) => {
    const matched = existingMap.get(`${newPat.role}_${newPat.name}`);
    if (matched && matched.recordingResult) {
      return {
        ...newPat,
        recordingResult: matched.recordingResult,
        rawAudioSamples: matched.rawAudioSamples,
        trimStartSec: matched.trimStartSec,
        trimEndSec: matched.trimEndSec,
        pack: matched.pack,
        pitchCurve: matched.pitchCurve,
        anacrusisSteps: matched.anacrusisSteps,
        mainSteps: matched.mainSteps,
        isMidiInitialized: matched.isMidiInitialized,
        midiLocked: matched.midiLocked,
      };
    }
    return newPat;
  });

  freshProject.toadaMeta = { ...(project.toadaMeta || {}), ...doc };
  const toastMessage = `Toada « ${doc.titre} » synchronisée avec Organizador (${freshProject.patterns.length} blocs) !`;

  return { updatedProject: freshProject, toastMessage };
}
