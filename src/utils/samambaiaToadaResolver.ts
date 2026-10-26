/**
 * samambaiaToadaResolver.ts
 * Priorité absolue aux documents Firestore d'Organizador avec catalogue local en simple fallback (< 40 lignes).
 */
import type { ToadaDocument } from '../types/toadaDocument.types';
import { SAMAMBAIA_12_TOADAS, getSamambaiaToadaById } from '../data/toadas/samambaiaToadasIndex';
import { normalizeSongTitle } from './varalSongFilter';

export function findDocByIdOrNormalizedTitle(docs: ToadaDocument[], queryIdOrTitle?: string | null): ToadaDocument | undefined {
  if (!queryIdOrTitle) return undefined;
  const direct = docs.find((d) => d.id === queryIdOrTitle);
  if (direct) return direct;
  const targetNorm = normalizeSongTitle(queryIdOrTitle);
  if (!targetNorm) return undefined;
  return docs.find((d) => normalizeSongTitle(d.titre) === targetNorm);
}

export function mergeWithLocalSamambaiaToadas(fetchedDocs: ToadaDocument[]): ToadaDocument[] {
  const map = new Map<string, ToadaDocument>();
  const fetchedTitles = new Set<string>();

  // 1. Les documents Firestore sont la source de vérité absolue (SSOT)
  fetchedDocs.forEach((d) => {
    map.set(d.id, d);
    const norm = normalizeSongTitle(d.titre);
    if (norm) fetchedTitles.add(norm);
  });

  // 2. On n'ajoute une toada locale QUE si elle n'existe absolument pas dans Firestore
  SAMAMBAIA_12_TOADAS.forEach((local) => {
    const titleKey = normalizeSongTitle(local.titre);
    if (!map.has(local.id) && !fetchedTitles.has(titleKey)) {
      map.set(local.id, local);
    }
  });

  return Array.from(map.values());
}

export function resolveLocalSamambaiaToada(songId: string): ToadaDocument | undefined {
  return getSamambaiaToadaById(songId);
}
