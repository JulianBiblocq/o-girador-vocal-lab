/**
 * firebaseClient.ts
 * Initialisation Firebase SSO, Google Auth, Firestore & Storage partagé (< 140 lignes).
 */
import { signInWithCustomToken, GoogleAuthProvider, signInWithPopup, signOut, type User } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, limit } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import app, { auth, db } from '../firebase/config';
import type { ToadaDocument } from '../types/toadaDocument.types';
import type { ToadaProject } from '../types/toadaProject.types';

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

export async function signInWithGoogle(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  const res = await signInWithPopup(auth, provider);
  return res.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function getUserGroupId(uid: string): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) return snap.data().groupId || null;
  } catch {}
  return null;
}

function normalizeToadaDoc(id: string, data: any): ToadaDocument {
  const paroles = data.parolesOriginales || data.paroles || data.lyrics || data.texte || data.activeToada?.paroles || '';
  return {
    id,
    titre: data.titre || data.title || data.nom || 'Sans titre',
    type: 'song',
    nacao: data.nacao || data.nação || '',
    rythme: data.rythme || data.ritmo || '',
    parolesOriginales: paroles,
    parolesPhonetiques: data.parolesPhonetiques || data.phonetique || data.activeToada?.parolesPhonetiques || '',
    tonaliteDefaut: data.tonaliteDefaut,
    bpmDefaut: data.bpmDefaut || data.bpm,
    lienSequenceurId: data.sequenceurId || data.lienSequenceurId,
    audioUrl: data.activeAudioUrl || data.audioUrl,
  };
}

export async function fetchOrganizadorToadas(groupId?: string | null): Promise<ToadaDocument[]> {
  const docsMap = new Map<string, ToadaDocument>();
  try {
    const snap = await getDocs(query(collection(db, 'documents'), limit(150)));
    snap.forEach((d) => {
      const data = d.data();
      const p = data.parolesOriginales || data.paroles || data.lyrics || data.texte;
      if (data.type === 'song' || data.typeMorceau === 'song' || data.categoryId === 'Toadas' || Boolean(p)) {
        docsMap.set(d.id, normalizeToadaDoc(d.id, data));
      }
    });
  } catch (err) {
    console.warn('[firebaseClient] Erreur documents :', err);
  }

  const groupCandidates = Array.from(new Set([groupId, groupId?.toLowerCase(), 'Samambaia', 'samambaia'].filter(Boolean) as string[]));
  for (const gId of groupCandidates) {
    try {
      const repSnap = await getDocs(query(collection(db, 'associations', gId, 'repertoire'), limit(100)));
      repSnap.forEach((d) => {
        const data = d.data();
        const p = data.paroles || data.parolesOriginales || data.lyrics || data.activeToada?.paroles;
        if (data.type === 'song' || data.typeMorceau === 'song' || Boolean(p) || data.toadaDocId) {
          if (!docsMap.has(d.id)) docsMap.set(d.id, normalizeToadaDoc(d.id, data));
        }
      });
    } catch {}
  }
  return Array.from(docsMap.values()).sort((a, b) => a.titre.localeCompare(b.titre));
}

export async function fetchOrganizadorToadaById(songId: string, groupId?: string | null): Promise<ToadaDocument | null> {
  try {
    const docSnap = await getDoc(doc(db, 'documents', songId));
    if (docSnap.exists()) return normalizeToadaDoc(docSnap.id, docSnap.data());
  } catch {}

  const groupCandidates = Array.from(new Set([groupId, groupId?.toLowerCase(), 'Samambaia', 'samambaia'].filter(Boolean) as string[]));
  for (const gId of groupCandidates) {
    try {
      const pSnap = await getDoc(doc(db, 'associations', gId, 'repertoire', songId));
      if (pSnap.exists()) {
        const pData = pSnap.data();
        const toadaDocId = pData.toadaDocId || pData.toadaId;
        if (toadaDocId) {
          const linked = await fetchOrganizadorToadaById(toadaDocId, groupId);
          if (linked) return linked;
        }
        return normalizeToadaDoc(pSnap.id, pData);
      }
    } catch {}
  }
  return null;
}

export async function fetchToadaPackById(toadaId: string): Promise<ToadaProject | null> {
  try {
    const snap = await getDoc(doc(db, 'toada_packs', toadaId));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      id: d.id || snap.id,
      title: d.title || d.metadata?.title || 'Toada Cloud',
      bpm: d.bpm || d.metadata?.bpm || d.project?.bpm || 55,
      timeSignature: d.timeSignature || d.metadata?.timeSignature || d.project?.timeSignature || '4/4',
      patterns: d.patterns || [],
      slots: d.slots || d.arrangementSlots || [],
      activePatternId: (d.patterns && d.patterns[0]?.id) || 'pattern_puxador_1',
      toadaMeta: d.toadaMeta || { id: d.id, titre: d.title, bpmDefaut: d.bpm },
    };
  } catch (err) {
    console.error(`[firebaseClient] Erreur toada pack ${toadaId} :`, err);
    return null;
  }
}
