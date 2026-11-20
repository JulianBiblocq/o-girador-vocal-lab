/**
 * cloudToadaStorageCleaner.ts
 * Empreinte binaire WAV déterministe (déduplication exacte avant upload) et purge automatique
 * des anciens fichiers `vocalRecordings/${packId}_*` strictement scopée au `packId` exporté (< 115 lignes).
 */
import { isLegacyDefaultToadaId } from '../utils/toadaPackIdResolver';
import { parseSequenciadorPresetData } from '../utils/lzStringCodec';

export function computeWavBufferFingerprint(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let h1 = 0xcbf29ce484222325n;
  let h2 = 0x84222325cbf29ce4n;
  const p1 = 0x100000001b3n;
  const p2 = 0x100000001b5n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < bytes.length; i++) {
    const b = BigInt(bytes[i]);
    h1 = ((h1 ^ b) * p1) & mask;
    h2 = ((h2 ^ b) * p2) & mask;
  }
  return `${bytes.byteLength}_${h1.toString(16).padStart(16, '0')}${h2.toString(16).padStart(16, '0')}`;
}

export function extractStoragePathFromAudioUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('vocalRecordings/')) return url;
  try {
    const encoded = new URL(url).pathname.split('/o/')[1];
    if (!encoded) return null;
    const decoded = decodeURIComponent(encoded);
    return decoded.startsWith('vocalRecordings/') ? decoded : null;
  } catch {
    return null;
  }
}

export function filterStalePackStoragePaths(
  allItemPaths: string[],
  packId: string,
  keptStoragePaths: ReadonlySet<string>
): string[] {
  if (isLegacyDefaultToadaId(packId) || packId.includes('/') || packId.includes('_')) return [];
  const prefix = `${packId}_`;
  const stale: string[] = [];
  for (const raw of allItemPaths) {
    const fullPath = raw.startsWith('vocalRecordings/') ? raw : `vocalRecordings/${raw}`;
    const shortName = fullPath.slice('vocalRecordings/'.length);
    if (shortName.startsWith(prefix) && !keptStoragePaths.has(fullPath)) {
      stale.push(fullPath);
    }
  }
  return stale;
}

export async function purgeStalePackWavsFromStorage(
  packId: string,
  keptStoragePaths: ReadonlySet<string>
): Promise<number> {
  if (isLegacyDefaultToadaId(packId) || packId.includes('/') || packId.includes('_')) return 0;
  let deletedCount = 0;
  try {
    const [{ ref, listAll, deleteObject }, { storage }] = await Promise.all([
      import('firebase/storage'),
      import('./firebaseClient'),
    ]);
    const listing = await listAll(ref(storage, 'vocalRecordings'));
    const stalePaths = filterStalePackStoragePaths(
      listing.items.map((it) => it.fullPath),
      packId,
      keptStoragePaths
    );
    await Promise.all(stalePaths.map(async (fullPath) => {
      try { await deleteObject(ref(storage, fullPath)); deletedCount++; } catch { /* ignore */ }
    }));
  } catch (err) {
    console.warn(`[cloudToadaStorageCleaner] Purge partielle ${packId} :`, err);
  }
  return deletedCount;
}

export async function cleanupLegacyDefaultPackIfUnreferenced(migratedToPackId: string): Promise<number> {
  if (isLegacyDefaultToadaId(migratedToPackId)) return 0;
  let deletedCount = 0;
  try {
    const [{ collection, doc, getDocs, deleteDoc, updateDoc }, { ref, listAll, deleteObject }, { db }, { storage }] = await Promise.all([
      import('firebase/firestore'), import('firebase/storage'), import('../firebase/config'), import('./firebaseClient'),
    ]);
    const presetsSnap = await getDocs(collection(db, 'presets'));
    let stillReferenced = false;
    presetsSnap.forEach((d) => {
      if (stillReferenced) return;
      const raw = d.data() || {};
      const parsed = parseSequenciadorPresetData(raw.data);
      const blob = JSON.stringify({ rawPack: raw.toadaPackId, parsed });
      if (raw.toadaPackId === 'toada-default' || blob.includes('toada-default')) stillReferenced = true;
    });
    if (stillReferenced) return 0;

    const listing = await listAll(ref(storage, 'vocalRecordings'));
    await Promise.all(listing.items.filter((it) => it.name.startsWith('toada-default_')).map(async (it) => {
      try { await deleteObject(it); deletedCount++; } catch { /* ignore */ }
    }));
    const legacyDoc = doc(db, 'toada_packs', 'toada-default');
    await deleteDoc(legacyDoc).catch(() => updateDoc(legacyDoc, { isDeleted: true, updatedAt: Date.now() }).catch(() => {}));
  } catch { /* ignore */ }
  return deletedCount;
}
