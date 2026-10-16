/**
 * firebaseClient.ts
 * Initialisation Firebase SSO, Firestore & Storage partagé pour Cantador (< 90 lignes).
 */
import { signInWithCustomToken } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import app, { auth, db } from '../firebase/config';
import type { ToadaDocument } from '../types/toadaDocument.types';
export type { ToadaDocument };

export const storage = getStorage(app);

export async function handleSsoUrlToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('ssoToken');
    if (!token) return false;

    await signInWithCustomToken(auth, token);
    const url = new URL(window.location.href);
    url.searchParams.delete('ssoToken');
    window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : '') + url.hash);
    return true;
  } catch (err) {
    console.warn('[firebaseClient] Échec authentification SSO :', err);
    return false;
  }
}

export function getUrlSongId(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('songId') || params.get('loadToadaId');
}

export async function fetchOrganizadorToadas(): Promise<ToadaDocument[]> {
  try {
    const collRef = collection(db, 'documents');
    let snap;
    try {
      snap = await getDocs(query(collRef, where('type', '==', 'song'), limit(60)));
    } catch {
      snap = await getDocs(query(collRef, limit(60)));
    }

    const docs: ToadaDocument[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (!data.titre && !data.title) return;
      docs.push({
        id: d.id,
        titre: data.titre || data.title || 'Sans titre',
        type: 'song',
        nacao: data.nacao || data.nação,
        rythme: data.rythme || data.ritmo,
        parolesOriginales: data.parolesOriginales || data.paroles || data.lyrics || '',
        parolesPhonetiques: data.parolesPhonetiques || data.phonetics || '',
        tonaliteDefaut: data.tonaliteDefaut,
        bpmDefaut: data.bpmDefaut || data.bpm,
        lienSequenceurId: data.lienSequenceurId,
        audioUrl: data.audioUrl,
      });
    });

    return docs.sort((a, b) => a.titre.localeCompare(b.titre));
  } catch (err) {
    console.error('[firebaseClient] Erreur lecture fiches organizador :', err);
    return [];
  }
}

export async function fetchOrganizadorToadaById(songId: string): Promise<ToadaDocument | null> {
  try {
    const docRef = doc(db, 'documents', songId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      id: snap.id,
      titre: data.titre || data.title || 'Sans titre',
      type: 'song',
      nacao: data.nacao,
      rythme: data.rythme,
      parolesOriginales: data.parolesOriginales || data.paroles || data.lyrics || '',
      parolesPhonetiques: data.parolesPhonetiques,
      tonaliteDefaut: data.tonaliteDefaut,
      bpmDefaut: data.bpmDefaut,
      lienSequenceurId: data.lienSequenceurId,
      audioUrl: data.audioUrl,
    };
  } catch (err) {
    console.error(`[firebaseClient] Erreur lecture fiche ${songId} :`, err);
    return null;
  }
}
