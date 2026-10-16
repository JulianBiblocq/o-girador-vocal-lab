/**
 * varalSongFilter.ts
 * Filtrage strict des fiches Varal (exclusion commissions/administratif)
 * et déduplication canonique Varal <-> Répertoire (< 110 lignes).
 */
import type { ToadaDocument } from '../types/toadaDocument.types';

export function isVaralCommissionOrNonSong(data: any): boolean {
  if (!data || typeof data !== 'object') return true;
  if (data.type === 'cordel_commission' || data.typeDoc === 'cordel_commission') return true;
  if (Boolean(data.commissionSourceId) || Boolean(data.commissionData)) return true;
  if (typeof data.categoryId === 'string' && data.categoryId.startsWith('projet_')) return true;
  if (typeof data.categorie === 'string' && data.categorie.startsWith('projet_')) return true;
  const nonSongCats = ['ComptesRendus', 'TutosFabrication', 'PhotosPrestations', 'fabrication', 'tuto_fabrication'];
  if (nonSongCats.includes(data.categoryId) || nonSongCats.includes(data.categorie)) return true;
  if (data.type === 'culture_fiche' || data.type === 'fiche_pedagogique' || data.type === 'fabrication') return true;
  if (typeof data.titre === 'string' && (data.titre.includes('Commission :') || data.titre.startsWith('📋') || data.titre.startsWith('📌'))) return true;
  return false;
}

export function isVaralSong(data: any): boolean {
  if (isVaralCommissionOrNonSong(data)) return false;
  if (data.type === 'song' || data.typeMorceau === 'song') return true;
  if (data.categoryId === 'Toadas' || data.categoryId === 'Chants' || data.categorie === 'Toadas' || data.categorie === 'Chants') return true;
  const hasLyrics = Boolean(data.parolesOriginales || data.paroles || data.lyrics || data.activeToada?.paroles);
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

export function normalizeToadaDoc(id: string, data: any, repertoireId?: string): ToadaDocument {
  const paroles = data.parolesOriginales || data.paroles || data.lyrics || (data.type === 'song' ? data.texte : '') || data.activeToada?.paroles || '';
  return {
    id,
    titre: data.titre || data.title || data.nom || 'Sans titre',
    type: 'song',
    nacao: data.nacao || data.nação || '',
    rythme: data.rythme || data.ritmo || '',
    parolesOriginales: paroles,
    parolesPhonetiques: data.parolesPhonetiques || data.phonetique || data.activeToada?.parolesPhonetiques || '',
    tonaliteDefaut: data.tonaliteDefaut,
    bpmDefaut: data.bpmDefaut || data.bpm,
    lienSequenceurId: data.sequenceurId || data.lienSequenceurId,
    audioUrl: data.activeAudioUrl || data.audioUrl,
    repertoireId: repertoireId || data.repertoireId,
  };
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
      // Trace de l'identifiant Répertoire pour le bouton d'ouverture 1-clic
      existing.repertoireId = rep.id;
      if (!existing.rythme && rep.data.rythme) existing.rythme = rep.data.rythme;
      if (!existing.nacao && rep.data.nacao) existing.nacao = rep.data.nacao;
      if (!existing.audioUrl && (rep.data.activeAudioUrl || rep.data.audioUrl)) {
        existing.audioUrl = rep.data.activeAudioUrl || rep.data.audioUrl;
      }
      if (!existing.bpmDefaut && (rep.data.bpmDefaut || rep.data.bpm)) {
        existing.bpmDefaut = rep.data.bpmDefaut || rep.data.bpm;
      }
      if (!existing.lienSequenceurId && (rep.data.sequenceurId || rep.data.lienSequenceurId)) {
        existing.lienSequenceurId = rep.data.sequenceurId || rep.data.lienSequenceurId;
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
