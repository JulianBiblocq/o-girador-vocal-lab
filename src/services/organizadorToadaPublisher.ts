/**
 * organizadorToadaPublisher.ts
 * Publication et synchronisation bidirectionnelle vers Firestore /documents (< 105 lignes).
 * Préserve intégralement rawTxtCode (1 ligne = 1 carte), parolesOriginales, BPM, lexique, QCM et métadonnées.
 */
import { doc, collection, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { type ToadaProject, DEFAULT_TOADA_BPM } from '../types/toadaProject.types';
import { reconstituteToadaTxt } from '../utils/toadaTxtReconstitutor';
import { detectToadaLexicon } from '../utils/toadaLexiconDetector';
import { generateQuizFromLexicon } from '../utils/toadaQuizGenerator';

export async function publishToadaToOrganizador(
  project: ToadaProject,
  groupId: string = 'samambaia'
): Promise<{ success: boolean; documentId: string }> {
  const { rawTxtCode, cleanHtml } = reconstituteToadaTxt(project);
  const rawGroupId = project.toadaMeta?.groupId || groupId || 'samambaia';
  const targetGroupId = rawGroupId.trim().toLowerCase();

  // 1. Détection ou consolidation du lexique bilingue & diction
  const existingLexicon = project.toadaMeta?.notesLexique || [];
  const notesLexique = existingLexicon.length > 0 ? existingLexicon : detectToadaLexicon(project);

  // 2. Génération automatique du vivier de Quiz PT-FR pour Organizador
  const existingQuiz = project.toadaMeta?.questionsQcm || [];
  const questionsQcm = existingQuiz.length > 0 ? existingQuiz : generateQuizFromLexicon(notesLexique);

  // 3. Paroles phonétiques combinées
  const phoneticsList = project.patterns
    .map((p) => p.assignedPhoneticText?.trim())
    .filter(Boolean);
  const parolesPhonetiques = phoneticsList.length > 0
    ? phoneticsList.join('\n')
    : (project.toadaMeta?.parolesPhonetiques || '');

  const resolvedBpm = Number(project.bpm || project.toadaMeta?.bpmDefaut || DEFAULT_TOADA_BPM);
  const resolvedHarmony = project.globalHarmonyGrid || project.toadaMeta?.harmonyGrid || project.patterns[0]?.harmonyGrid || null;

  const payload: any = {
    titre: project.title,
    type: 'song',
    categoryId: project.toadaMeta?.categoryId || 'Toadas',
    categorie: project.toadaMeta?.categorie || 'Toadas',
    groupId: targetGroupId,
    nacao: project.toadaMeta?.nacao || '',
    rythme: project.toadaMeta?.rythme || '',
    rawTxtCode,
    parolesOriginales: project.toadaMeta?.parolesOriginales || cleanHtml,
    parolesPhonetiques,
    signature: project.timeSignature || '4/4',
    timeSignature: project.timeSignature || '4/4',
    bpmDefaut: resolvedBpm,
    tonaliteDefaut: project.toadaMeta?.tonaliteDefaut || (project as any).referencePitch || 'D',
    cantadorToadaId: project.id,
    traduction: project.toadaMeta?.traduction || '',
    anecdote: project.toadaMeta?.anecdote || '',
    notesLexique,
    questionsQcm,
    harmonyGrid: resolvedHarmony,
    globalHarmonyGrid: resolvedHarmony,
    quizCount: questionsQcm.length,
    lexiqueCount: notesLexique.length,
    annee: project.toadaMeta?.annee || new Date().getFullYear(),
    dateMaj: new Date().toISOString(),
  };

  const existingDocId = project.toadaMeta?.id;
  if (existingDocId) {
    try {
      const updatePayload = { ...payload };
      if (project.toadaMeta?.parolesOriginales) {
        delete updatePayload.parolesOriginales;
      }
      await updateDoc(doc(db, 'documents', existingDocId), updatePayload);
      return { success: true, documentId: existingDocId };
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
      });
    } catch {}
  }

  return { success: true, documentId: newDocRef.id };
}
