/**
 * sheetDirectiveHelper.ts
 * Extraction des métadonnées de ligne optionnelles entre parenthèses ((1m), (sans ana)...)
 * et nettoyage du texte chanté pour préserver les paroles pures (< 50 lignes).
 */

export interface LineDirectives {
  cleanText: string;
  measuresCount?: 1 | 2 | 3 | 4;
  hasAnacrusis?: boolean;
}

export function extractInlineLineDirectives(rawText: string): LineDirectives {
  if (!rawText) return { cleanText: '' };

  let measuresCount: 1 | 2 | 3 | 4 | undefined;
  let hasAnacrusis: boolean | undefined;

  // Détection des mesures : (1m), (2m), (3m), (4m), (1 M), etc.
  const mMatch = rawText.match(/\(\s*([1-4])\s*m\s*\)/i);
  if (mMatch) {
    measuresCount = parseInt(mMatch[1], 10) as 1 | 2 | 3 | 4;
  }

  // Détection de l'anacrouse : (sans ana), (no-ana), (ana), (avec ana), etc.
  if (/\(\s*(?:sans\s*ana(?:crouse)?|no-?ana(?:crusis)?)\s*\)/i.test(rawText)) {
    hasAnacrusis = false;
  } else if (/\(\s*(?:avec\s*ana(?:crouse)?|ana(?:crouse|crusis)?)\s*\)/i.test(rawText)) {
    hasAnacrusis = true;
  }

  // Nettoyage des directives du texte
  const cleanText = rawText
    .replace(/\(\s*[1-4]\s*m\s*\)/gi, '')
    .replace(/\(\s*(?:sans\s*ana(?:crouse)?|no-?ana(?:crusis)?|avec\s*ana(?:crouse)?|ana(?:crouse|crusis)?)\s*\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return { cleanText, measuresCount, hasAnacrusis };
}
