/**
 * organizadorToadaPublisher.ts
 * Publication et synchronisation bidirectionnelle Cantador ➔ Organizador vers Firestore /documents (< 138 lignes).
 * Envoie tonaliteDefaut (Troupe), tonaliteChanteeOrigine (Prise), transpositionSemitones, bpmDefaut, rawTxtCode et parolesOriginales (<u>).
 */
import { doc, collection, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { type ToadaProject, DEFAULT_TOADA_BPM } from '../types/toadaProject.types';
import { reconstituteToadaTxt } from '../utils/toadaTxtReconstitutor';
import { detectToadaLexicon } from '../utils/toadaLexiconDetector';
import { generateQuizFromLexicon } from '../utils/toadaQuizGenerator';
import { analyzeFullProjectScale } from '../audio/projectScaleAnalyzer';
import { resolveProjectDualScale } from '../utils/scaleTranspositionHelper';

export interface OrganizadorPublishPayloadResult {
  payload: Record<string, any>;
  rawTxtCode: string;
  parolesOriginales: string;
  resolvedBpm: number;
  formattedScaleLabel: string;
  tonaliteChanteeOrigine: string;
  transpositionSemitones: number;
  scaleRoot: string;
  scaleMode: string;
  targetGroupId: string;
}

export function buildOrganizadorDocumentPayload(
  project: ToadaProject,
  groupId: string = 'samambaia'
): OrganizadorPublishPayloadResult {
  const { rawTxtCode, cleanHtml } = reconstituteToadaTxt(project);
  const rawGroupId = project.toadaMeta?.groupId || groupId || 'samambaia';
  const targetGroupId = rawGroupId.trim().toLowerCase();

  const existingLexicon = project.toadaMeta?.notesLexique || [];
  const notesLexique = existingLexicon.length > 0 ? existingLexicon : detectToadaLexicon(project);
  const existingQuiz = project.toadaMeta?.questionsQcm || [];
  const questionsQcm = existingQuiz.length > 0 ? existingQuiz : generateQuizFromLexicon(notesLexique);

  const phoneticsList = project.patterns.map((p) => p.assignedPhoneticText?.trim()).filter(Boolean);
  const parolesPhonetiques = phoneticsList.length > 0 ? phoneticsList.join('\n') : (project.toadaMeta?.parolesPhonetiques || '');
  const resolvedBpm = Number(project.bpm || project.toadaMeta?.bpmDefaut || DEFAULT_TOADA_BPM);
  const resolvedHarmony = project.globalHarmonyGrid || project.toadaMeta?.harmonyGrid || project.patterns[0]?.harmonyGrid || null;

  const detected = (project as any).detectedScale || analyzeFullProjectScale(project.patterns || [], 'fr');
  const dualScale = resolveProjectDualScale(project, 'fr', detected);
  const formattedScaleLabel = dualScale.troupeScaleLabel;
  const tonaliteChanteeOrigine = dualScale.sungScaleLabel;
  const transpositionSemitones = dualScale.transpositionSemitones;
  const scaleRoot = dualScale.troupeScaleRoot;
  const scaleMode = dualScale.troupeScaleMode;

  const meta: any = project.toadaMeta || {};
  const payload: Record<string, any> = {
    titre: project.title, type: 'song', categoryId: meta.categoryId || 'Toadas', categorie: meta.categorie || 'Toadas',
    groupId: targetGroupId, nacao: meta.nacao || '', rythme: meta.rythme || '', rawTxtCode,
    parolesOriginales: cleanHtml || meta.parolesOriginales || '', parolesPhonetiques,
    signature: project.timeSignature || '4/4', timeSignature: project.timeSignature || '4/4',
    bpmDefaut: resolvedBpm, bpm: resolvedBpm, tonaliteDefaut: formattedScaleLabel,
    tonaliteChanteeOrigine, transpositionSemitones,
    sungScaleRoot: dualScale.sungScaleRoot, sungScaleMode: dualScale.sungScaleMode, troupeScaleRoot: dualScale.troupeScaleRoot,
    scaleRoot, scaleMode, cantadorToadaId: project.id, cantadorValidated: true,
    traduction: meta.traduction || '', anecdote: meta.anecdote || '', notesLexique, questionsQcm,
    harmonyGrid: resolvedHarmony, globalHarmonyGrid: resolvedHarmony,
    quizCount: questionsQcm.length, lexiqueCount: notesLexique.length,
    annee: meta.annee || new Date().getFullYear(), dateMaj: new Date().toISOString(),
  };

  if (meta.audioUrl !== undefined) payload.audioUrl = meta.audioUrl;
  if (meta.youtubeUrl !== undefined) payload.youtubeUrl = meta.youtubeUrl;
  if (meta.videoUrl !== undefined) payload.videoUrl = meta.videoUrl;

  return {
    payload, rawTxtCode, parolesOriginales: payload.parolesOriginales,
    resolvedBpm, formattedScaleLabel, tonaliteChanteeOrigine, transpositionSemitones,
    scaleRoot, scaleMode, targetGroupId,
  };
}

export async function syncTonaliteToOrganizadorFirestore(project: ToadaProject): Promise<boolean> {
  const docId = project.toadaMeta?.id;
  const repId = project.toadaMeta?.repertoireId;
  if (!docId && !repId) return false;
  try {
    const dual = resolveProjectDualScale(project, 'fr');
    const fields = {
      tonaliteDefaut: dual.troupeScaleLabel,
      tonaliteChanteeOrigine: dual.sungScaleLabel,
      transpositionSemitones: dual.transpositionSemitones,
      sungScaleRoot: dual.sungScaleRoot,
      sungScaleMode: dual.sungScaleMode,
      troupeScaleRoot: dual.troupeScaleRoot,
      scaleRoot: dual.troupeScaleRoot,
      scaleMode: dual.troupeScaleMode,
      dateMaj: new Date().toISOString(),
    };
    if (docId) await updateDoc(doc(db, 'documents', docId), fields).catch(() => {});
    if (repId) {
      const gId = (project.toadaMeta?.groupId || 'samambaia').trim().toLowerCase();
      await updateDoc(doc(db, 'associations', gId, 'repertoire', repId), fields).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

export async function publishToadaToOrganizador(
  project: ToadaProject,
  groupId: string = 'samambaia'
): Promise<{ success: boolean; documentId: string; bpm: number; scaleLabel: string }> {
  const { payload, resolvedBpm, formattedScaleLabel, tonaliteChanteeOrigine, transpositionSemitones, targetGroupId } = buildOrganizadorDocumentPayload(project, groupId);

  const existingDocId = project.toadaMeta?.id;
  if (existingDocId) {
    try {
      await updateDoc(doc(db, 'documents', existingDocId), payload);
      return { success: true, documentId: existingDocId, bpm: resolvedBpm, scaleLabel: formattedScaleLabel };
    } catch {}
  }

  const newDocRef = await addDoc(collection(db, 'documents'), payload);
  const repId = project.toadaMeta?.repertoireId;
  if (repId) {
    try {
      await updateDoc(doc(db, 'associations', targetGroupId, 'repertoire', repId), {
        cantadorToadaId: project.id, toadaDocId: newDocRef.id, bpmDefaut: resolvedBpm,
        tonaliteDefaut: formattedScaleLabel, tonaliteChanteeOrigine, transpositionSemitones,
      });
    } catch {}
  }
  return { success: true, documentId: newDocRef.id, bpm: resolvedBpm, scaleLabel: formattedScaleLabel };
}

export const publishProjectToOrganizador = publishToadaToOrganizador;
