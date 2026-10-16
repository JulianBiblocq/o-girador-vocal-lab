/**
 * toadaLibraryStorage.ts
 * Gestionnaire de persistance multi-Toadas dans IndexedDB (< 105 lignes).
 * Permet de sauvegarder, lister, charger et supprimer plusieurs projets Toada locaux.
 */
import type { ToadaProject } from '../types/toadaProject.types';

const DB_NAME = 'atelier_vocal_toadas_v1';
const DB_VERSION = 1;
const STORE_NAME = 'toada_library';

export interface SavedToadaSummary {
  id: string;
  title: string;
  bpm: number;
  timeSignature: string;
  updatedAt: number;
  patternsCount: number;
}

function openLibraryDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB indisponible'));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listSavedToadas(): Promise<SavedToadaSummary[]> {
  try {
    const db = await openLibraryDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as Array<ToadaProject & { updatedAt?: number }>;
        const summaries: SavedToadaSummary[] = list.map((p) => ({
          id: p.id,
          title: p.title || 'Toada',
          bpm: p.bpm || 55,
          timeSignature: p.timeSignature || '4/4',
          updatedAt: p.updatedAt || Date.now(),
          patternsCount: p.patterns?.length || 0,
        })).sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(summaries);
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('[toadaLibraryStorage] Erreur lecture catalogue :', err);
    return [];
  }
}

export async function saveToadaToLibrary(project: ToadaProject): Promise<void> {
  try {
    const db = await openLibraryDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = { ...project, updatedAt: Date.now() };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('[toadaLibraryStorage] Erreur sauvegarde toada :', err);
  }
}

export async function loadToadaFromLibrary(id: string): Promise<ToadaProject | null> {
  try {
    const db = await openLibraryDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => resolve((req.result as ToadaProject) ?? null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('[toadaLibraryStorage] Erreur chargement toada :', err);
    return null;
  }
}

export async function deleteToadaFromLibrary(id: string): Promise<void> {
  try {
    const db = await openLibraryDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('[toadaLibraryStorage] Erreur suppression toada :', err);
  }
}
