/**
 * toadaDocNormalizer.ts
 * Normalisation exhaustive et résiliente des fiches Toadas venant d'Organizador (< 120 lignes).
 * Garantit la lecture et le parsing sans perte de notesLexique, questionsQcm et harmonyGrid.
 */
import type { ToadaDocument } from '../types/toadaDocument.types';
import type { ToadaLexiconEntry, ToadaQuizItem } from '../types/toadaLexicon.types';
import type { PatternHarmonyGrid } from '../types/harmony.types';
import { createHarmonyGridFromChords } from './chordGridHelper';

export function normalizeLexiconList(raw: any): ToadaLexiconEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item) return null;
        if (typeof item === 'string') {
          const parts = item.split(/[-—:]/);
          const mot = (parts[0] || '').trim();
          const explication = (parts.slice(1).join('—') || parts[0] || '').trim();
          if (!mot) return null;
          return { mot, explication, traductionFr: explication };
        }
        const mot = String(item.mot || item.word || item.terme || '').trim();
        const explication = String(item.explication || item.definition || item.sens || '').trim();
        const traductionFr = String(item.traductionFr || item.traduction || explication).trim();
        if (!mot && !explication) return null;
        return {
          mot: mot || 'Vocabulaire',
          explication: explication || traductionFr,
          traductionFr: traductionFr || explication,
          phonetique: item.phonetique || undefined,
          conseilDiction: item.conseilDiction || undefined,
          soundCardId: item.soundCardId || undefined,
          categorie: item.categorie || 'maracatu',
        };
      })
      .filter(Boolean) as ToadaLexiconEntry[];
  }
  if (typeof raw === 'string' && raw.trim()) {
    return [{ mot: 'Note', explication: raw.trim(), traductionFr: raw.trim() }];
  }
  return [];
}

export function normalizeQuizList(raw: any): ToadaQuizItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((q) => {
      if (!q || typeof q !== 'object') return null;
      const question = String(q.question || '').trim();
      if (!question) return null;
      const options = Array.isArray(q.options) ? q.options.map((opt: any) => String(opt || '').trim()).filter(Boolean) : [];
      const correctIndex = typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < options.length ? q.correctIndex : 0;
      return {
        id: q.id || undefined,
        question,
        options: options.length >= 2 ? options : [...options, 'Option B'],
        correctIndex,
        termeBr: String(q.termeBr || q.terme || '').trim(),
        traductionFr: String(q.traductionFr || q.reponse || (options[correctIndex] || '')).trim(),
        phonetique: q.phonetique || undefined,
        extraitTexte: q.extraitTexte || undefined,
        type: q.type || 'traduction_br_fr',
      };
    })
    .filter(Boolean) as ToadaQuizItem[];
}

export function normalizeHarmonyGrid(raw: any): PatternHarmonyGrid | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    const chordStrings = raw.map((c: any) => String(c || '').trim()).filter((c) => /^[A-G][b#]?[a-zA-Z0-9/]*$/.test(c));
    if (chordStrings.length > 0) return createHarmonyGridFromChords(chordStrings);
  }
  if (typeof raw === 'object' && Array.isArray(raw.measures)) {
    return {
      measures: raw.measures.map((m: any, idx: number) => ({
        measureIndex: typeof m.measureIndex === 'number' ? m.measureIndex : idx,
        chordsByBeat: typeof m.chordsByBeat === 'object' && m.chordsByBeat !== null ? { ...m.chordsByBeat } : {},
      })),
    };
  }
  if (typeof raw === 'string' && raw.trim()) {
    const chords = raw.split(/[\s,;|]+/).map((c) => c.trim().replace(/^\[|\]$/g, '')).filter((c) => /^[A-G][b#]?[a-zA-Z0-9/]*$/.test(c));
    if (chords.length > 0) return createHarmonyGridFromChords(chords);
  }
  return undefined;
}

export function normalizeToadaDoc(id: string, data: any, repertoireId?: string): ToadaDocument {
  const paroles = data.parolesOriginales || data.paroles || data.lyrics || (data.type === 'song' ? data.texte : '') || data.activeToada?.paroles || '';
  const notesLexique = normalizeLexiconList(data.notesLexique || data.lexique);
  const questionsQcm = normalizeQuizList(data.questionsQcm || data.quiz || data.customQuestions);
  const harmonyGrid = normalizeHarmonyGrid(data.harmonyGrid || data.globalHarmonyGrid || data.grilleHarmonique || data.chords);

  return {
    id,
    titre: data.titre || data.title || data.nom || 'Sans titre',
    type: 'song',
    categoryId: data.categoryId || data.categorie || 'Toadas',
    categorie: data.categorie || data.categoryId || 'Toadas',
    groupId: data.groupId || 'samambaia',
    nacao: data.nacao || data.nação || '',
    rythme: data.rythme || data.ritmo || '',
    annee: data.annee || (data.year ? Number(data.year) : undefined),
    signature: data.signature || data.timeSignature || '4/4',
    timeSignature: data.timeSignature || data.signature || '4/4',
    tonaliteDefaut: data.tonaliteDefaut,
    bpmDefaut: data.bpmDefaut || data.bpm,
    parolesOriginales: paroles,
    parolesPhonetiques: data.parolesPhonetiques || data.phonetique || data.activeToada?.parolesPhonetiques || '',
    rawTxtCode: data.rawTxtCode || (typeof paroles === 'string' && paroles.includes('[') ? paroles : undefined),
    traduction: data.traduction || '',
    anecdote: data.anecdote || '',
    notesLexique,
    questionsQcm,
    harmonyGrid,
    globalHarmonyGrid: harmonyGrid,
    lienSequenceurId: data.sequenceurId || data.lienSequenceurId,
    audioUrl: data.activeAudioUrl || data.audioUrl,
    repertoireId: repertoireId || data.repertoireId,
    cantadorToadaId: data.cantadorToadaId || data.toadaId || undefined,
  };
}
