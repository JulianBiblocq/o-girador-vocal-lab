/**
 * projectAutoSave.ts
 * Persistance continue automatique du ToadaProject dans IndexedDB (< 110 lignes).
 * Utilise l'algorithme de clonage structurel natif (support zero-copy des Float32Array).
 */
import type { ToadaProject } from '../types/toadaProject.types';

const DB_NAME = 'atelier_vocal_autosave_v1';
const DB_VERSION = 1;
const STORE_NAME = 'project_state';
const RECORD_KEY = 'current_toada_project';

function openAutoSaveDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProjectToIndexedDB(project: ToadaProject): Promise<void> {
  try {
    const db = await openAutoSaveDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const putReq = store.put(project, RECORD_KEY);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('[AutoSave] Impossible de sauvegarder dans IndexedDB :', err);
  }
}

export async function loadProjectFromIndexedDB(): Promise<ToadaProject | null> {
  try {
    const db = await openAutoSaveDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(RECORD_KEY);
      getReq.onsuccess = () => {
        const result = getReq.result as ToadaProject | undefined;
        resolve(result ?? null);
      };
      getReq.onerror = () => reject(getReq.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('[AutoSave] Impossible de charger depuis IndexedDB :', err);
    return null;
  }
}

export async function clearProjectIndexedDB(): Promise<void> {
  try {
    const db = await openAutoSaveDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const delReq = store.delete(RECORD_KEY);
      delReq.onsuccess = () => resolve();
      delReq.onerror = () => reject(delReq.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('[AutoSave] Impossible de purger IndexedDB :', err);
  }
}
