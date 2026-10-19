/**
 * organizadorToadaPublisher.ts
 * Publication et synchronisation bidirectionnelle vers Firestore /documents (< 115 lignes).
 * Stocke rawTxtCode, structuredMeasures et parolesOriginales propres sans symboles techniques.
 */
import { doc, collection, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { ToadaProject } from '../types/toadaProject.types';
import { reconstituteToadaTxt } from '../utils/toadaTxtReconstitutor';

export async function publishToadaToOrganizador(
  project: ToadaProject,
  groupId: string = 'samambaia'
): Promise<{ success: boolean; documentId: string }> {
  const { rawTxtCode, cleanHtml } = reconstituteToadaTxt(project);
  const targetGroupId = (groupId || 'samambaia').trim().toLowerCase();

  const payload: any = {
    titre: project.title,
    type: 'song',
    categoryId: 'Toadas',
    categorie: 'Toadas',
    groupId: targetGroupId,
    rawTxtCode,
    parolesOriginales: cleanHtml,
    signature: project.timeSignature || '4/4',
    timeSignature: project.timeSignature || '4/4',
    bpmDefaut: project.bpm || 55,
    tonaliteDefaut: project.toadaMeta?.tonaliteDefaut || (project as any).referencePitch || 'D',
    cantadorToadaId: project.id,
    annee: new Date().getFullYear(),
    dateMaj: new Date().toISOString()
  };

  const existingDocId = project.toadaMeta?.id;
  if (existingDocId) {
    try {
      await updateDoc(doc(db, 'documents', existingDocId), payload);
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
        toadaDocId: newDocRef.id
      });
    } catch {}
  }

  return { success: true, documentId: newDocRef.id };
}
