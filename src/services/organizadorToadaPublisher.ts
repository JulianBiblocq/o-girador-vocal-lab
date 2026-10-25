/**
 * organizadorToadaPublisher.ts
 * Publication et synchronisation bidirectionnelle vers Firestore /documents (< 100 lignes).
 * Stocke rawTxtCode, paroles, métadonnées culturelles, notesLexique et questionsQcm pour les quiz.
 */
import { doc, collection, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ToadaProject } from '../types/toadaProject.types';
import { reconstituteToadaTxt } from '../utils/toadaTxtReconstitutor';
import { detectToadaLexicon } from '../utils/toadaLexiconDetector';
import { generateQuizFromLexicon } from '../utils/toadaQuizGenerator';

export async function publishToadaToOrganizador(
  project: ToadaProject,
  groupId: string = 'samambaia'
): Promise<{ success: boolean; documentId: string }> {
  const { rawTxtCode, cleanHtml } = reconstituteToadaTxt(project);
  const targetGroupId = (groupId || 'samambaia').trim().toLowerCase();

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

  const payload: any = {
    titre: project.title,
    type: 'song',
    categoryId: 'Toadas',
    categorie: 'Toadas',
    groupId: targetGroupId,
    rawTxtCode,
    parolesOriginales: cleanHtml,
    parolesPhonetiques,
    signature: project.timeSignature || '4/4',
    timeSignature: project.timeSignature || '4/4',
    bpmDefaut: project.bpm || 55,
    tonaliteDefaut: project.toadaMeta?.tonaliteDefaut || (project as any).referencePitch || 'D',
    cantadorToadaId: project.id,
    traduction: project.toadaMeta?.traduction || '',
    anecdote: project.toadaMeta?.anecdote || '',
    notesLexique,
    questionsQcm,
    quizCount: questionsQcm.length,
    lexiqueCount: notesLexique.length,
    annee: new Date().getFullYear(),
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

  // Création d'un nouveau document dans /documents
  const newDocRef = await addDoc(collection(db, 'documents'), payload);

  // Synchronisation optionnelle du morceau de répertoire lié
  const repId = project.toadaMeta?.repertoireId;
  if (repId) {
    try {
      await updateDoc(doc(db, 'associations', targetGroupId, 'repertoire', repId), {
        cantadorToadaId: project.id,
        toadaDocId: newDocRef.id,
      });
    } catch {}
  }

  return { success: true, documentId: newDocRef.id };
}
