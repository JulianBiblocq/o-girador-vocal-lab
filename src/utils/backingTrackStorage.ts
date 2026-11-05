/**
 * backingTrackStorage.ts
 * Stockage réactif en mémoire + persistance IndexedDB du Bounce Rythmique (Baque Témoin de Sequenciador) (< 100 lignes).
 */

export interface BackingTrackData {
  projectId: string;
  fileName: string;
  pcm: Float32Array;
  sampleRate: number;
  referenceBpm: number;
  firstDownbeatOffsetSec: number;
  volume: number;
  enabled: boolean;
  loopTrack: boolean;
}

const DB_NAME = 'ogirador_cantador_backing_db';
const STORE_NAME = 'backing_tracks';
const memoryCache = new Map<string, BackingTrackData>();
let activeTrackProjectId = 'default';
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((cb) => cb());
}

export function extractBpmFromFileName(fileName: string, fallbackBpm = 88): number {
  const m = (fileName || '').match(/(?:^|[_\-\s])(\d{2,3})[\s_-]*bpm/i);
  if (m && m[1]) {
    const val = parseInt(m[1], 10);
    if (val >= 35 && val <= 240) return val;
  }
  return fallbackBpm;
}

export function getActiveBackingTrack(projectId?: string): BackingTrackData | null {
  const key = projectId || activeTrackProjectId || 'default';
  return memoryCache.get(key) ?? memoryCache.get(activeTrackProjectId) ?? null;
}

export function setActiveBackingTrack(track: BackingTrackData | null, projectId = 'default'): void {
  activeTrackProjectId = projectId;
  if (!track) {
    memoryCache.delete(projectId);
    deleteTrackFromIdb(projectId).catch(() => {});
  } else {
    memoryCache.set(projectId, track);
    saveTrackToIdb(track).catch(() => {});
  }
  notifyListeners();
}

export function updateActiveBackingTrack(projectId: string, partial: Partial<BackingTrackData>): BackingTrackData | null {
  const existing = getActiveBackingTrack(projectId);
  if (!existing) return null;
  const updated: BackingTrackData = { ...existing, ...partial };
  memoryCache.set(projectId, updated);
  saveTrackToIdb(updated).catch(() => {});
  notifyListeners();
  return updated;
}

export function subscribeBackingTrack(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function openIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function saveTrackToIdb(track: BackingTrackData): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(track);
}

async function deleteTrackFromIdb(projectId: string): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(projectId);
}

export async function hydrateBackingTrackFromIdb(projectId = 'default'): Promise<BackingTrackData | null> {
  activeTrackProjectId = projectId;
  if (memoryCache.has(projectId)) return memoryCache.get(projectId)!;
  const db = await openIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(projectId);
      req.onsuccess = () => {
        const res = req.result as BackingTrackData | undefined;
        if (res && res.pcm?.length) { memoryCache.set(projectId, res); notifyListeners(); resolve(res); }
        else resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
