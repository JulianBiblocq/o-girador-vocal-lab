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
        ...local,
        ...existing,
        id: existing.id,
        parolesOriginales: existing.parolesOriginales || local.parolesOriginales,
        parolesPhonetiques: existing.parolesPhonetiques || local.parolesPhonetiques,
        bpmDefaut: existing.bpmDefaut || local.bpmDefaut,
        tonaliteDefaut: existing.tonaliteDefaut || local.tonaliteDefaut,
        signature: existing.signature || local.signature,
        notesLexique: (existing.notesLexique && existing.notesLexique.length > 0) ? existing.notesLexique : local.notesLexique,
        questionsQcm: (existing.questionsQcm && existing.questionsQcm.length > 0) ? existing.questionsQcm : local.questionsQcm,
        harmonyGrid: existing.harmonyGrid || local.harmonyGrid,
        globalHarmonyGrid: existing.globalHarmonyGrid || existing.harmonyGrid || local.globalHarmonyGrid || local.harmonyGrid,
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
