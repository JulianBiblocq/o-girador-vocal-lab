/**
 * toadaQuizGenerator.ts
 * Générateur automatique de Quiz Portugais-Français pour Organizador (< 110 lignes).
 * Produit des QCM variés et bilingues prêts pour le module d'apprentissage des élèves.
 */
import type { ToadaLexiconEntry, ToadaQuizItem } from '../types/toadaLexicon.types';
import { ORGANIZADOR_VOCAL_LEXICON } from '../i18n/lexicon';

function shuffleArray<T>(arr: T[]): T[] {
  const clone = [...arr];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}

export function generateQuizFromLexicon(entries: ToadaLexiconEntry[]): ToadaQuizItem[] {
  const items: ToadaQuizItem[] = [];
  const allTradMap = new Map<string, string>();
  for (const item of ORGANIZADOR_VOCAL_LEXICON) {
    if (item.fr && item.br) allTradMap.set(item.br.toLowerCase(), item.fr);
  }

  for (const entry of entries) {
    if (!entry.mot || !entry.traductionFr) continue;

    // 1. Cherche si un quiz pré-rédigé existe dans le référentiel
    const ref = ORGANIZADOR_VOCAL_LEXICON.find((l) => l.br.toLowerCase() === entry.mot.toLowerCase());
    if (ref && ref.quizQuestion && ref.quizOptions && ref.quizOptions.length >= 2) {
      items.push({
        id: `quiz-${ref.id}`,
        question: ref.quizQuestion,
        options: ref.quizOptions,
        correctIndex: ref.quizCorrectIndex ?? 0,
        termeBr: entry.mot,
        traductionFr: entry.traductionFr,
        phonetique: entry.phonetique,
        type: 'sens_culturel',
      });
      continue;
    }

    // 2. Génération dynamique avec distracteurs plausibles
    const distractors: string[] = [];
    const candidates = ORGANIZADOR_VOCAL_LEXICON
      .filter((l) => l.br.toLowerCase() !== entry.mot.toLowerCase() && l.fr !== entry.traductionFr)
      .map((l) => l.fr);

    const shuffledCandidates = shuffleArray(candidates);
    for (const c of shuffledCandidates) {
      if (!distractors.includes(c) && c !== entry.traductionFr) {
        distractors.push(c);
        if (distractors.length >= 3) break;
      }
    }

    // Compléments par défaut si peu de candidats
    const fallbacks = [
      'Un instrument de percussion en métal',
      'Le pas cadencé du cortège royal',
      'La formule de salutation rituelle',
      'Une phrase improvisée par le soliste',
    ];
    for (const fb of fallbacks) {
      if (distractors.length < 3 && fb !== entry.traductionFr && !distractors.includes(fb)) {
        distractors.push(fb);
      }
    }

    const options = shuffleArray([entry.traductionFr, ...distractors.slice(0, 3)]);
    const correctIndex = options.indexOf(entry.traductionFr);

    items.push({
      id: `quiz-gen-${entry.mot.toLowerCase().replace(/\s+/g, '-')}`,
      question: `Que signifie le terme « ${entry.mot} » dans cette Toada ?`,
      options,
      correctIndex: correctIndex >= 0 ? correctIndex : 0,
      termeBr: entry.mot,
      traductionFr: entry.traductionFr,
      phonetique: entry.phonetique,
      type: 'traduction_br_fr',
    });
  }

  return items;
}
