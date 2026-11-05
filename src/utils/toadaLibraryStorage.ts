/**
 * toadaLibraryStorage.ts
 * Gestionnaire de persistance multi-Toadas dans IndexedDB avec index léger des métadonnées (< 120 lignes).
 */
import { type ToadaProject, DEFAULT_TOADA_BPM } from '../types/toadaProject.types';

const DB_NAME = 'atelier_vocal_toadas_v1';
const DB_VERSION = 1;
const STORE_NAME = 'toada_library';
const SUMMARY_INDEX_KEY = 'atelier_vocal_toadas_index_v1';

export interface SavedToadaSummary {
  id: string;
  title: string;
  bpm: number;
  timeSignature: string;
  updatedAt: number;
  patternsCount: number;
}

function readCachedIndex(): SavedToadaSummary[] | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SUMMARY_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function writeCachedIndex(summaries: SavedToadaSummary[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const sorted = [...summaries].sort((a, b) => b.updatedAt - a.updatedAt);
    localStorage.setItem(SUMMARY_INDEX_KEY, JSON.stringify(sorted));
  } catch { /* ignore */ }
}

function buildSummary(p: ToadaProject, updatedAt = Date.now()): SavedToadaSummary {
  return {
    id: p.id, title: p.title || 'Toada', bpm: p.bpm || DEFAULT_TOADA_BPM,
    timeSignature: p.timeSignature || '4/4', updatedAt, patternsCount: p.patterns?.length || 0,
  };
}

function openLibraryDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponible'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listSavedToadas(): Promise<SavedToadaSummary[]> {
  const cached = readCachedIndex();
  if (cached) return cached;

  try {
    const db = await openLibraryDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const summaries: SavedToadaSummary[] = [];
      const cursorReq = tx.objectStore(STORE_NAME).openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          const p = cursor.value as ToadaProject & { updatedAt?: number };
          summaries.push(buildSummary(p, p.updatedAt || Date.now()));
          cursor.continue();
        } else {
          summaries.sort((a, b) => b.updatedAt - a.updatedAt);
          writeCachedIndex(summaries);
          resolve(summaries);
        }
      };
      cursorReq.onerror = () => reject(cursorReq.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('[toadaLibraryStorage] Erreur lecture catalogue :', err);
    return [];
  }
}

export async function saveToadaToLibrary(project: ToadaProject): Promise<void> {
  const now = Date.now();
  const summary = buildSummary(project, now);
  const existing = readCachedIndex() || [];
  writeCachedIndex([summary, ...existing.filter((item) => item.id !== project.id)]);

  try {
    const db = await openLibraryDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).put({ ...project, updatedAt: now });
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
      const req = tx.objectStore(STORE_NAME).get(id);
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
  const existing = readCachedIndex();
  if (existing) writeCachedIndex(existing.filter((item) => item.id !== id));

  try {
    const db = await openLibraryDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const req = tx.objectStore(STORE_NAME).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('[toadaLibraryStorage] Erreur suppression toada :', err);
  }
}
