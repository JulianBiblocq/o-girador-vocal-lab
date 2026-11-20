/**
 * takeRecoveryService.ts
 * Inspection 100 % LECTURE SEULE de `/toada_packs` et `vocalRecordings/` (Firebase Storage) pour récupérer
 * et ré-aligner les prises `.wav` existantes (pack actif + orphelins groupés par lot/date). Zéro écriture Cloud (< 120 lignes).
 */
import { doc, getDoc } from 'firebase/firestore';
import { ref, listAll, getMetadata, getDownloadURL } from 'firebase/storage';
import { db } from '../firebase/config';
import { storage } from './firebaseClient';
import type { ToadaProject, VocalRole } from '../types/toadaProject.types';
import type { RecoveryInventory, RecoveryPackInfo, RecoveryTake } from '../utils/takeRecoveryTypes';
import { parseBatchInfo, parseWavHeader, estimateWavDurationFromSize } from '../utils/takeRecoveryBatchInfo';
import { normalizeSongTitle } from '../utils/varalSongFilter';

function extractStoragePathFromUrl(url?: string): string {
  if (!url) return '';
  try { return decodeURIComponent(new URL(url).pathname.split('/o/')[1] || ''); } catch { return ''; }
}

async function probeExactWavDuration(url: string, sizeBytes: number): Promise<{ durationSec: number; exact: boolean }> {
  if (!url.toLowerCase().includes('.wav') && !url.includes('alt=media')) {
    return { durationSec: estimateWavDurationFromSize(sizeBytes), exact: false };
  }
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-127' } });
    if (res.ok || res.status === 206) {
      const ab = await res.arrayBuffer();
      const bytes = new Uint8Array(ab, 0, Math.min(128, ab.byteLength));
      const hdr = parseWavHeader(bytes, sizeBytes);
      if (hdr && hdr.durationSec > 0) return { durationSec: Number(hdr.durationSec.toFixed(3)), exact: true };
    }
  } catch { /* repli taille */ }
  return { durationSec: Number(estimateWavDurationFromSize(sizeBytes).toFixed(3)), exact: false };
}

async function fetchBestCandidatePack(project: ToadaProject): Promise<{ id: string; data: Record<string, any> } | null> {
  const candidates = Array.from(new Set([project.id, project.toadaMeta?.id, 'toada-default'].filter(Boolean) as string[]));
  const found: Array<{ id: string; data: Record<string, any> }> = [];
  for (const id of candidates) {
    try {
      const snap = await getDoc(doc(db, 'toada_packs', id));
      if (snap.exists()) found.push({ id: snap.id, data: snap.data() });
    } catch { /* pack inaccessible */ }
  }
  if (found.length === 0) return null;
  const targetNorm = normalizeSongTitle(project.title);
  return found.find((f) => normalizeSongTitle(f.data.title) === targetNorm) ?? found[0];
}

export async function inspectCloudTakesForProject(project: ToadaProject): Promise<RecoveryInventory> {
  const bestPack = await fetchBestCandidatePack(project);
  let packInfo: RecoveryPackInfo | null = null;
  const packTakes: RecoveryTake[] = [];
  const referencedPaths = new Set<string>();

  const storageByPath = new Map<string, { size: number; updated?: string; url: string; name: string }>();
  try {
    const listing = await listAll(ref(storage, 'vocalRecordings'));
    const metas = await Promise.all(listing.items.map(async (itemRef) => {
      try {
        const [meta, url] = await Promise.all([getMetadata(itemRef), getDownloadURL(itemRef)]);
        return { fullPath: itemRef.fullPath, name: itemRef.name, size: Number(meta.size || 0), updated: meta.updated, url };
      } catch { return null; }
    }));
    for (const m of metas) if (m) storageByPath.set(m.fullPath, m);
  } catch (err) {
    console.warn('[takeRecoveryService] Lecture vocalRecordings/ partielle :', err);
  }

  if (bestPack) {
    const d = bestPack.data, shiftSt = Number(d.transpositionSemitones ?? 0);
    packInfo = { id: bestPack.id, title: String(d.title || bestPack.id), documentId: d.documentId || d.toadaMeta?.id, transpositionSemitones: shiftSt };
    const rawPats: any[] = Array.isArray(d.patterns) ? d.patterns : [];
    for (const p of rawPats) {
      const url: string | undefined = p.audioUrl || p.variants?.norm_norm?.audioUrl;
      if (!url) continue;
      const storagePath = extractStoragePathFromUrl(url) || `vocalRecordings/${bestPack.id}_${p.id}.wav`;
      referencedPaths.add(storagePath);
      const stMeta = storageByPath.get(storagePath);
      const fileName = storagePath.replace(/^vocalRecordings\//, '');
      const { batchKey, batchLabel } = parseBatchInfo(fileName, stMeta?.updated);
      const sizeBytes = stMeta?.size || 0;
      const dur = p.trimEndSec && p.trimEndSec > 0
        ? { durationSec: Number(Number(p.trimEndSec).toFixed(3)), exact: true }
        : await probeExactWavDuration(stMeta?.url || url, sizeBytes);
      packTakes.push({
        key: `pack:${p.id}`, source: 'pack', storagePath, url: stMeta?.url || url,
        sizeKb: Math.round(sizeBytes / 1024), updated: stMeta?.updated,
        durationSec: dur.durationSec, durationExact: dur.exact, batchKey, batchLabel,
        patternId: p.id, role: p.role as VocalRole, lyrics: p.assignedLyricsText || '',
        cardIndex: p.cardIndex, hasTailBeat: Boolean(p.hasTailBeat || p.exitBeat === 1),
        t1OffsetSec: p.t1OffsetSec ?? 0, trimStartSec: p.trimStartSec ?? 0, trimEndSec: p.trimEndSec ?? dur.durationSec,
        recordedBpm: p.recordedBpm || p.bpm || d.bpm, transpositionSemitones: p.transpositionSemitones ?? shiftSt,
      });
    }
  }

  const orphanEntries = Array.from(storageByPath.entries()).filter(([fullPath]) => !referencedPaths.has(fullPath));
  const orphanTakes: RecoveryTake[] = await Promise.all(orphanEntries.map(async ([fullPath, m]) => {
    const fileName = m.name || fullPath.replace(/^vocalRecordings\//, '');
    const { batchKey, batchLabel } = parseBatchInfo(fileName, m.updated);
    const dur = await probeExactWavDuration(m.url, m.size);
    return {
      key: `orphan:${fullPath}`, source: 'orphan', storagePath: fullPath, url: m.url,
      sizeKb: Math.round(m.size / 1024), updated: m.updated,
      durationSec: dur.durationSec, durationExact: dur.exact, batchKey, batchLabel,
    };
  }));
  orphanTakes.sort((a, b) => (b.updated || '').localeCompare(a.updated || '') || a.storagePath.localeCompare(b.storagePath));

  return { pack: packInfo, packTakes, orphanTakes };
}
