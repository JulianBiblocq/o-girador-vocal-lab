/**
 * toadaLexiconDetector.ts
 * Détection automatique des termes culturels, rythmiques et cartes de diction dans une Toada (< 135 lignes).
 * Ressoude les syllabes coupées par '-', ignore '───', les directives (+, /) et les accords [Accord].
 */
import type { ToadaProject } from '../types/toadaProject.types';
import type { ToadaLexiconEntry } from '../types/toadaLexicon.types';
import { ORGANIZADOR_VOCAL_LEXICON } from '../i18n/lexicon';
import { stitchSyllablesFromSteps } from './toadaTxtReconstitutor';

export function cleanRawLyricLine(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\[[^\]]+\]/g, '')       // Retire les accords [Cm], [G7]
    .replace(/^[\s+/]+/, '')          // Retire les préfixes + ou /
    .replace(/[*_#]/g, '')            // Retire les marqueurs markdown (*puxador*)
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractAllToadaLyricsText(project: ToadaProject): string {
  const parts: string[] = [];

  for (const pat of project.patterns) {
    const steps = [...(pat.anacrusisSteps || []), ...(pat.mainSteps || [])];
    const midiText = stitchSyllablesFromSteps(steps);
    if (midiText.trim()) {
      parts.push(cleanRawLyricLine(midiText));
    } else if (pat.assignedLyricsText?.trim()) {
      parts.push(cleanRawLyricLine(pat.assignedLyricsText));
    }
  }

  const meta = project.toadaMeta;
  if (parts.length === 0 && meta?.parolesOriginales && typeof meta.parolesOriginales === 'string') {
    parts.push(cleanRawLyricLine(meta.parolesOriginales));
  }
  if (meta?.rawTxtCode) {
    parts.push(cleanRawLyricLine(meta.rawTxtCode));
  }

  return parts.join(' \n ');
}

function normalizeForSearch(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function detectToadaLexicon(project: ToadaProject): ToadaLexiconEntry[] {
  const fullText = extractAllToadaLyricsText(project);
  if (!fullText.trim()) return project.toadaMeta?.notesLexique || [];

  const normalizedText = normalizeForSearch(fullText);
  const existingMap = new Map<string, ToadaLexiconEntry>();
  for (const entry of project.toadaMeta?.notesLexique || []) {
    existingMap.set(normalizeForSearch(entry.mot), entry);
  }

  const detected: ToadaLexiconEntry[] = [];

  for (const lex of ORGANIZADOR_VOCAL_LEXICON) {
    const termNorm = normalizeForSearch(lex.br);
    const regex = new RegExp(`(^|[^a-z0-9])${termNorm}([^a-z0-9]|$)`, 'i');
    if (regex.test(normalizedText)) {
      const existing = existingMap.get(termNorm);
      if (existing) {
        detected.push({
          ...existing,
          phonetique: existing.phonetique || lex.phonetique,
          conseilDiction: existing.conseilDiction || lex.conseilDiction,
          soundCardId: existing.soundCardId || lex.soundCardId,
          categorie: existing.categorie || lex.category,
        });
        existingMap.delete(termNorm);
      } else {
        detected.push({
          mot: lex.br,
          traductionFr: lex.fr,
          explication: `${lex.fr}${lex.phonetique ? ` — Prononciation : ${lex.phonetique}` : ''}`,
          phonetique: lex.phonetique,
          conseilDiction: lex.conseilDiction,
          soundCardId: lex.soundCardId,
          categorie: lex.category,
          isAutoDetected: true,
        });
      }
    }
  }

  // Conserve les termes manuels ajoutés par l'utilisateur qui ne sont pas dans le dictionnaire
  for (const remaining of existingMap.values()) {
    detected.push(remaining);
  }

  return detected;
}
