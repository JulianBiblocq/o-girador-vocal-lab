/**
 * firebaseClient.ts
 * Initialisation Firebase SSO, Google Auth, Firestore & Storage partagé (< 130 lignes).
 */
import { signInWithCustomToken, GoogleAuthProvider, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, limit } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import app, { auth, db } from '../firebase/config';
import type { ToadaDocument } from '../types/toadaDocument.types';
import type { ToadaProject } from '../types/toadaProject.types';
import { isVaralSong, normalizeToadaDoc, mergeAndDeduplicateToadas } from '../utils/varalSongFilter';
import { mergeWithLocalSamambaiaToadas, resolveLocalSamambaiaToada, findDocByIdOrNormalizedTitle } from '../utils/samambaiaToadaResolver';
import { normalizeHarmonyGrid, normalizeLexiconList, normalizeQuizList } from '../utils/toadaDocNormalizer';

export type { ToadaDocument };
export const storage = getStorage(app);

export async function handleSsoUrlToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('ssoToken') || params.get('token');
    if (!token) return false;
    await signInWithCustomToken(auth, token);
    const url = new URL(window.location.href);
    url.searchParams.delete('ssoToken');
    url.searchParams.delete('token');
    window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : '') + url.hash);
    return true;
  } catch (err) {
    console.warn('[firebaseClient] Échec authentification SSO :', err);
    return false;
  }
}

export const signInWithGoogle = async (): Promise<User | null> => (await signInWithPopup(auth, new GoogleAuthProvider())).user;
export const logoutUser = (): Promise<void> => signOut(auth);

export async function getUserGroupId(uid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) return snap.data().groupId || null;
  } catch {}
  return null;
}

export async function fetchOrganizadorToadas(groupId?: string | null): Promise<ToadaDocument[]> {
  const primaryDocs: ToadaDocument[] = [];
  try {
    const snap = await getDocs(query(collection(db, 'documents'), limit(150)));
    snap.forEach((d) => { if (isVaralSong(d.data())) primaryDocs.push(normalizeToadaDoc(d.id, d.data())); });
  } catch (err) {
    console.warn('[firebaseClient] Erreur documents :', err);
  }

  const repertoireDocs: { id: string; data: any }[] = [];
  const groupCandidates = Array.from(new Set([groupId, groupId?.toLowerCase(), 'Samambaia', 'samambaia'].filter(Boolean) as string[]));
  for (const gId of groupCandidates) {
    try {
      const repSnap = await getDocs(query(collection(db, 'associations', gId, 'repertoire'), limit(100)));
      repSnap.forEach((d) => repertoireDocs.push({ id: d.id, data: d.data() }));
    } catch {}
  }
  return mergeWithLocalSamambaiaToadas(mergeAndDeduplicateToadas(primaryDocs, repertoireDocs));
}

export async function fetchOrganizadorToadaById(songId: string, groupId?: string | null, songTitle?: string | null): Promise<ToadaDocument | null> {
  const local = resolveLocalSamambaiaToada(songId);
  try {
    const docSnap = await getDoc(doc(db, 'documents', songId));
    if (docSnap.exists() && isVaralSong(docSnap.data())) {
      return normalizeToadaDoc(docSnap.id, docSnap.data());
    }
  } catch {}

  const targetTitle = songTitle || (local ? local.titre : songId);
  try {
    const all = await fetchOrganizadorToadas(groupId);
    const matched = findDocByIdOrNormalizedTitle(all, songId) || findDocByIdOrNormalizedTitle(all, targetTitle);
    if (matched) return matched;
  } catch {}

  const groupCandidates = Array.from(new Set([groupId, groupId?.toLowerCase(), 'Samambaia', 'samambaia'].filter(Boolean) as string[]));
  for (const gId of groupCandidates) {
    try {
      const pSnap = await getDoc(doc(db, 'associations', gId, 'repertoire', songId));
      if (pSnap.exists()) {
        const pData = pSnap.data();
        const toadaDocId = pData.toadaDocId || pData.toadaId;
        if (toadaDocId) {
          const linked = await fetchOrganizadorToadaById(toadaDocId, groupId, songTitle);
          if (linked) { linked.repertoireId = pSnap.id; return linked; }
        }
        if (isVaralSong(pData)) return normalizeToadaDoc(pSnap.id, pData, pSnap.id);
      }
    } catch {}
  }
  return local || null;
}

export async function fetchToadaPackById(toadaId: string): Promise<ToadaProject | null> {
  try {
    const snap = await getDoc(doc(db, 'toada_packs', toadaId));
    if (!snap.exists()) return null;
    const d = snap.data();
    const globalHarmonyGrid = normalizeHarmonyGrid(d.globalHarmonyGrid || d.harmonyGrid || d.metadata?.globalHarmonyGrid);
    const toadaMeta = d.toadaMeta || {
      id: d.id || snap.id, titre: d.title || d.metadata?.title || 'Toada Cloud', bpmDefaut: d.bpm || d.metadata?.bpm || 88,
      notesLexique: normalizeLexiconList(d.notesLexique || d.metadata?.notesLexique),
      questionsQcm: normalizeQuizList(d.questionsQcm || d.metadata?.questionsQcm),
    };
    if (!toadaMeta.notesLexique?.length && (d.notesLexique || d.metadata?.notesLexique)) {
      toadaMeta.notesLexique = normalizeLexiconList(d.notesLexique || d.metadata?.notesLexique);
    }
    if (!toadaMeta.questionsQcm?.length && (d.questionsQcm || d.metadata?.questionsQcm)) {
      toadaMeta.questionsQcm = normalizeQuizList(d.questionsQcm || d.metadata?.questionsQcm);
    }
    if (globalHarmonyGrid && !toadaMeta.harmonyGrid) toadaMeta.harmonyGrid = globalHarmonyGrid;

    return {
      id: d.id || snap.id,
      title: d.title || d.metadata?.title || 'Toada Cloud',
      bpm: d.bpm || d.metadata?.bpm || d.project?.bpm || 88,
      timeSignature: d.timeSignature || d.metadata?.timeSignature || d.project?.timeSignature || '4/4',
      patterns: d.patterns || [],
      slots: d.slots || d.arrangementSlots || [],
      activePatternId: (d.patterns && d.patterns[0]?.id) || 'pattern_puxador_1',
      toadaMeta, globalHarmonyGrid, harmonyConfig: d.harmonyConfig,
    };
  } catch (err) {
    console.error(`[firebaseClient] Erreur toada pack ${toadaId} :`, err);
    return null;
  }
}
