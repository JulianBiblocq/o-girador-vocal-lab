/**
 * varalSongFilter.ts
 * Filtrage strict des fiches Varal (exclusion commissions/administratif)
 * et déduplication canonique Varal <-> Répertoire (< 120 lignes).
 */
import type { ToadaDocument } from '../types/toadaDocument.types';
import { normalizeToadaDoc, normalizeLexiconList, normalizeQuizList, normalizeHarmonyGrid } from './toadaDocNormalizer';

export { normalizeToadaDoc };

export function isVaralCommissionOrNonSong(data: any): boolean {
  if (!data || typeof data !== 'object') return true;
  if (data.type === 'cordel_commission' || data.typeDoc === 'cordel_commission') return true;
  if (Boolean(data.commissionSourceId) || Boolean(data.commissionData)) return true;
  if (typeof data.categoryId === 'string' && data.categoryId.startsWith('projet_')) return true;
  if (typeof data.categorie === 'string' && data.categorie.startsWith('projet_')) return true;
  const nonSongCats = ['ComptesRendus', 'TutosFabrication', 'PhotosPrestations', 'fabrication', 'tuto_fabrication'];
  if (nonSongCats.includes(data.categoryId) || nonSongCats.includes(data.categorie)) return true;
  if (data.type === 'culture_fiche' || data.type === 'fiche_pedagogique' || data.type === 'fabrication') return true;
  if (typeof data.titre === 'string' && (data.titre.includes('Commission :') || data.titre.startsWith('\u{1F4CB}') || data.titre.startsWith('\u{1F4CC}'))) return true;
  return false;
}

export function isVaralSong(data: any): boolean {
  if (isVaralCommissionOrNonSong(data)) return false;
  if (data.type === 'song' || data.typeMorceau === 'song') return true;
  if (data.categoryId === 'Toadas' || data.categoryId === 'Chants' || data.categorie === 'Toadas' || data.categorie === 'Chants') return true;
  const hasLyrics = Boolean(data.parolesOriginales || data.paroles || data.lyrics || data.activeToada?.paroles || data.rawTxtCode);
  return hasLyrics;
}

export function normalizeSongTitle(title?: string | null): string {
  if (!title) return '';
  return title
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function findDocByIdOrNormalizedTitle(docs: ToadaDocument[], idOrTitle?: string | null): ToadaDocument | undefined {
  if (!idOrTitle) return undefined;
  const direct = docs.find((d) => d.id === idOrTitle || d.repertoireId === idOrTitle);
  if (direct) return direct;
  const targetNorm = normalizeSongTitle(idOrTitle);
  if (!targetNorm) return undefined;
  return docs.find((d) => normalizeSongTitle(d.titre) === targetNorm || normalizeSongTitle(d.id) === targetNorm);
}

export function mergeAndDeduplicateToadas(
  primaryDocs: ToadaDocument[],
  repertoireDocs: { id: string; data: any }[]
): ToadaDocument[] {
  const byId = new Map<string, ToadaDocument>();
  const byNormTitle = new Map<string, ToadaDocument>();

  primaryDocs.forEach((doc) => {
    byId.set(doc.id, doc);
    const norm = normalizeSongTitle(doc.titre);
    if (norm) byNormTitle.set(norm, doc);
  });

  repertoireDocs.forEach((rep) => {
    if (isVaralCommissionOrNonSong(rep.data)) return;
    const targetId = rep.data.toadaDocId || rep.data.toadaId;
    let existing = targetId ? byId.get(targetId) : undefined;
    if (!existing) {
      const norm = normalizeSongTitle(rep.data.titre || rep.data.nom);
      if (norm) existing = byNormTitle.get(norm);
    }

    if (existing) {
      existing.repertoireId = rep.id;
      if (!existing.rythme && rep.data.rythme) existing.rythme = rep.data.rythme;
      if (!existing.nacao && rep.data.nacao) existing.nacao = rep.data.nacao;
      if (!existing.audioUrl && (rep.data.activeAudioUrl || rep.data.audioUrl)) {
        existing.audioUrl = rep.data.activeAudioUrl || rep.data.audioUrl;
      }
      if (!existing.bpmDefaut && (rep.data.bpmDefaut || rep.data.bpm)) {
        existing.bpmDefaut = Number(rep.data.bpmDefaut || rep.data.bpm);
      }
      if (!existing.lienSequenceurId && (rep.data.sequenceurId || rep.data.lienSequenceurId)) {
        existing.lienSequenceurId = rep.data.sequenceurId || rep.data.lienSequenceurId;
      }
      if (!existing.notesLexique?.length && (rep.data.notesLexique || rep.data.lexique)) {
        existing.notesLexique = normalizeLexiconList(rep.data.notesLexique || rep.data.lexique);
      }
      if (!existing.questionsQcm?.length && (rep.data.questionsQcm || rep.data.quiz)) {
        existing.questionsQcm = normalizeQuizList(rep.data.questionsQcm || rep.data.quiz);
      }
      if (!existing.harmonyGrid && (rep.data.harmonyGrid || rep.data.globalHarmonyGrid || rep.data.chords)) {
        existing.harmonyGrid = normalizeHarmonyGrid(rep.data.harmonyGrid || rep.data.globalHarmonyGrid || rep.data.chords);
        existing.globalHarmonyGrid = existing.harmonyGrid;
      }
    } else if (isVaralSong(rep.data)) {
      const newDoc = normalizeToadaDoc(rep.id, rep.data, rep.id);
      byId.set(rep.id, newDoc);
      const norm = normalizeSongTitle(newDoc.titre);
      if (norm) byNormTitle.set(norm, newDoc);
    }
  });

  return Array.from(byId.values()).sort((a, b) => a.titre.localeCompare(b.titre));
}
