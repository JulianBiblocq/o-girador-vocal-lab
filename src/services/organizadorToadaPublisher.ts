/**
 * organizadorToadaPublisher.ts
 * Publication et synchronisation bidirectionnelle Cantador ➔ Organizador vers Firestore /documents (< 125 lignes).
 * Met à jour rawTxtCode ([1]..[4], _), parolesOriginales (<u>L</u>), bpmDefaut, tonaliteDefaut (scaleRoot/scaleMode) et métadonnées.
 */
import { doc, collection, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { type ToadaProject, DEFAULT_TOADA_BPM } from '../types/toadaProject.types';
import { reconstituteToadaTxt } from '../utils/toadaTxtReconstitutor';
import { detectToadaLexicon } from '../utils/toadaLexiconDetector';
import { generateQuizFromLexicon } from '../utils/toadaQuizGenerator';
import { analyzeFullProjectScale, resolveProjectActiveScale } from '../audio/projectScaleAnalyzer';

export interface OrganizadorPublishPayloadResult {
  payload: Record<string, any>;
  rawTxtCode: string;
  parolesOriginales: string;
  resolvedBpm: number;
  formattedScaleLabel: string;
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
  const parolesPhonetiques = phoneticsList.length > 0
    ? phoneticsList.join('\n')
    : (project.toadaMeta?.parolesPhonetiques || '');

  const resolvedBpm = Number(project.bpm || project.toadaMeta?.bpmDefaut || DEFAULT_TOADA_BPM);
  const resolvedHarmony = project.globalHarmonyGrid || project.toadaMeta?.harmonyGrid || project.patterns[0]?.harmonyGrid || null;

  const detected = (project as any).detectedScale || analyzeFullProjectScale(project.patterns || [], 'fr');
  const resolvedScale = resolveProjectActiveScale(project, 'fr', detected);
  const formattedScaleLabel = project.toadaMeta?.tonaliteDefaut && !/^[A-G][#b]?\d?$/i.test(project.toadaMeta.tonaliteDefaut.trim())
    ? project.toadaMeta.tonaliteDefaut.trim()
    : resolvedScale.label;
  const scaleRoot = resolvedScale.tonic;
  const scaleMode = resolvedScale.scaleType;

  const meta: any = project.toadaMeta || {};
  const payload: Record<string, any> = {
    titre: project.title,
    type: 'song',
    categoryId: meta.categoryId || 'Toadas',
    categorie: meta.categorie || 'Toadas',
    groupId: targetGroupId,
    nacao: meta.nacao || '',
    rythme: meta.rythme || '',
    rawTxtCode,
    parolesOriginales: cleanHtml || meta.parolesOriginales || '',
    parolesPhonetiques,
    signature: project.timeSignature || '4/4',
    timeSignature: project.timeSignature || '4/4',
    bpmDefaut: resolvedBpm,
    bpm: resolvedBpm,
    tonaliteDefaut: formattedScaleLabel,
    scaleRoot,
    scaleMode,
    cantadorToadaId: project.id,
    traduction: meta.traduction || '',
    anecdote: meta.anecdote || '',
    notesLexique,
    questionsQcm,
    harmonyGrid: resolvedHarmony,
    globalHarmonyGrid: resolvedHarmony,
    quizCount: questionsQcm.length,
    lexiqueCount: notesLexique.length,
    annee: meta.annee || new Date().getFullYear(),
    dateMaj: new Date().toISOString(),
  };

  if (meta.audioUrl !== undefined) payload.audioUrl = meta.audioUrl;
  if (meta.youtubeUrl !== undefined) payload.youtubeUrl = meta.youtubeUrl;
  if (meta.videoUrl !== undefined) payload.videoUrl = meta.videoUrl;

  return {
    payload, rawTxtCode, parolesOriginales: payload.parolesOriginales,
    resolvedBpm, formattedScaleLabel, scaleRoot, scaleMode, targetGroupId,
  };
}

export async function publishToadaToOrganizador(
  project: ToadaProject,
  groupId: string = 'samambaia'
): Promise<{ success: boolean; documentId: string; bpm: number; scaleLabel: string }> {
  const { payload, resolvedBpm, formattedScaleLabel, targetGroupId } = buildOrganizadorDocumentPayload(project, groupId);

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
        cantadorToadaId: project.id,
        toadaDocId: newDocRef.id,
        bpmDefaut: resolvedBpm,
        tonaliteDefaut: formattedScaleLabel,
      });
    } catch {}
  }

  return { success: true, documentId: newDocRef.id, bpm: resolvedBpm, scaleLabel: formattedScaleLabel };
}

export const publishProjectToOrganizador = publishToadaToOrganizador;
