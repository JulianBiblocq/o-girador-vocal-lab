/**
 * vocalPaperLyricsAligner.ts
 * Verrouillage et recalage orthographique post-lecture optique par la fiche existante d'Organizador (< 120 lignes).
 * Préserve à 100 % les positions rythmiques (stepIndex, isTie) et MIDI (pitchKey, octaveShift) de la grille papier.
 */
import type { ScannedVocalPatternBlock, ScannedVocalStepCell } from '../../types/vocalPaperWorkshop.types';
import { syllabifySingleWord } from '../syllableSplitter';

interface OfficialSylToken { syl: string; norm: string; joinsNext: boolean; punctAfter: string; }

export function normalizeAsciiCompare(str: string): string {
  return (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function levenshteinDist(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length || !b.length) return a.length || b.length;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0]; dp[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const temp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = temp;
    }
  }
  return dp[a.length];
}

export function extractOfficialWordsAndPhrases(organizadorDoc: any): {
  cleanLines: string[]; uniqueWords: string[]; fullText: string;
} {
  const rawSource = typeof organizadorDoc === 'string'
    ? organizadorDoc
    : (organizadorDoc?.parolesOriginales || organizadorDoc?.rawTxtCode || organizadorDoc?.paroles || organizadorDoc?.lyrics || '');
  const stripped = String(rawSource || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/\[PAUSE[^\]]*\]/gi, '\n').replace(/\[(?:M\d+[•\.:])?\d+\]/g, '')
    .replace(/\[(?:sig:[^\]]+|sim|nosim)\]/gi, '').replace(/\*+/g, '').replace(/───►|───|---/g, '');
  const cleanLines = stripped.split(/\r?\n/)
    .map((l) => l.replace(/(?:^|\s)_+(?=\s|$)/g, ' ').replace(/\s{2,}/g, ' ').trim()).filter(Boolean);
  const wordsSet = new Set<string>();
  cleanLines.forEach((line) => line.split(/\s+/).forEach((w) => {
    const cleanW = w.replace(/^[,.;:!?()"«»]+|[,.;:!?()"«»]+$/g, '');
    if (cleanW) wordsSet.add(cleanW);
  }));
  return { cleanLines, uniqueWords: Array.from(wordsSet), fullText: cleanLines.join('\n') };
}

function tokenizeOfficialSyllables(fullText: string): OfficialSylToken[] {
  const tokens: OfficialSylToken[] = [];
  for (const rawWord of fullText.replace(/\r?\n/g, ' ').split(/\s+/).filter(Boolean)) {
    const m = rawWord.match(/^([¡¿"«(]*)(.+?)([,.;:!?»")']*)$/);
    const core = m ? m[2] : rawWord, punctAfter = m ? m[3] : '';
    const parts = syllabifySingleWord(core).map((s) => s.trim().replace(/-+$/, '')).filter(Boolean);
    parts.forEach((syl, idx) => tokens.push({
      syl, norm: normalizeAsciiCompare(syl), joinsNext: idx < parts.length - 1, punctAfter: idx === parts.length - 1 ? punctAfter : '',
    }));
  }
  return tokens;
}

export function alignScannedPatternsWithOrganizadorLyrics(
  scannedPatterns: ScannedVocalPatternBlock[], organizadorDoc: any
): ScannedVocalPatternBlock[] {
  const { fullText } = extractOfficialWordsAndPhrases(organizadorDoc);
  const officialTokens = tokenizeOfficialSyllables(fullText);
  if (officialTokens.length === 0) return scannedPatterns;

  return scannedPatterns.map((block) => {
    const clone = (cells: ScannedVocalStepCell[] = []) => cells.map((c) => ({ ...c }));
    const ana = clone(block.anacrusisCells), main = clone(block.mainCells), tail = clone(block.tailCells);
    const activeCells = [...ana, ...main, ...tail].filter((c) => {
      const s = (c.syllable || '').trim();
      return !c.isTie && Boolean(s && s !== '───' && s !== '---' && s !== '───►');
    });
    if (activeCells.length === 0) return block;

    let bestScore = Infinity, bestStart = 0, bestEnd = 0, bestSyls: { text: string; joinsNext: boolean }[] = [];
    for (let start = 0; start < officialTokens.length; start++) {
      let j = start, score = 0;
      const cand: { text: string; joinsNext: boolean }[] = [];
      for (let i = 0; i < activeCells.length; i++) {
        if (j >= officialTokens.length) { score += 50; break; }
        const rawSyl = (activeCells[i].syllable || '').trim(), cNorm = normalizeAsciiCompare(rawSyl);
        const d1 = levenshteinDist(cNorm, officialTokens[j].norm);
        const canElide2 = j + 1 < officialTokens.length && !officialTokens[j].joinsNext;
        const d2 = canElide2 ? levenshteinDist(cNorm, officialTokens[j].norm + officialTokens[j + 1].norm) : Infinity;
        if (canElide2 && (d2 < d1 || (/['’‘]/.test(rawSyl) && d2 <= d1))) {
          score += d2; cand.push({ text: `${officialTokens[j].syl}'${officialTokens[j + 1].syl}`, joinsNext: officialTokens[j + 1].joinsNext }); j += 2;
        } else {
          score += d1; cand.push({ text: officialTokens[j].syl, joinsNext: officialTokens[j].joinsNext }); j += 1;
        }
      }
      if (cand.length === activeCells.length && score < bestScore) { bestScore = score; bestStart = start; bestEnd = j; bestSyls = cand; }
    }

    if (bestSyls.length === activeCells.length) {
      activeCells.forEach((cell, idx) => {
        const base = idx === 0 ? bestSyls[idx].text.charAt(0).toUpperCase() + bestSyls[idx].text.slice(1) : bestSyls[idx].text;
        cell.syllable = bestSyls[idx].joinsNext ? `${base}-` : base;
      });
      const phrase = officialTokens.slice(bestStart, bestEnd).map((t, idx) => {
        const s = idx === 0 ? t.syl.charAt(0).toUpperCase() + t.syl.slice(1) : t.syl;
        return `${s}${t.punctAfter}${t.joinsNext ? '' : ' '}`;
      }).join('').trim().replace(/\s{2,}/g, ' ');
      return { ...block, anacrusisCells: ana, mainCells: main, tailCells: tail, officialLyricsText: phrase };
    }
    return block;
  });
}
