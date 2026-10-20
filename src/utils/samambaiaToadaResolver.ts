/**
 * samambaiaToadaResolver.ts
 * Fusion intelligente des Toadas distantes avec le catalogue local garanti des 12 Toadas (< 50 lignes).
 */
import type { ToadaDocument } from '../types/toadaDocument.types';
import { SAMAMBAIA_12_TOADAS, getSamambaiaToadaById } from '../data/toadas/samambaiaToadasIndex';

export function mergeWithLocalSamambaiaToadas(fetchedDocs: ToadaDocument[]): ToadaDocument[] {
  const map = new Map<string, ToadaDocument>();
  fetchedDocs.forEach((d) => map.set(d.id, d));

  SAMAMBAIA_12_TOADAS.forEach((local) => {
    const existing = map.get(local.id) || Array.from(map.values()).find((v) => v.titre.toLowerCase() === local.titre.toLowerCase());
    if (existing) {
      map.set(existing.id, {
        ...existing,
        ...local,
        id: existing.id,
        parolesOriginales: local.parolesOriginales,
        parolesPhonetiques: local.parolesPhonetiques || existing.parolesPhonetiques,
        bpmDefaut: local.bpmDefaut || existing.bpmDefaut,
        tonaliteDefaut: local.tonaliteDefaut || existing.tonaliteDefaut,
        signature: local.signature || existing.signature,
      });
    } else {
      map.set(local.id, local);
    }
  });

  return Array.from(map.values());
}

export function resolveLocalSamambaiaToada(songId: string): ToadaDocument | undefined {
  return getSamambaiaToadaById(songId);
}
