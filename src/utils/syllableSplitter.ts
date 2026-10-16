/**
 * syllableSplitter.ts
 * Découpeur syllabique phonétique automatique (Portugais du Brésil & Français).
 * Gère diphtongues nasales, digrammes, attaques consonantiques et mélismes.
 */

const VOWELS = /[aáàâãeéêèëiíïoóôõuúüAÁÀÂÃEÉÊÈËIÍÏOÓÔÕUÚÜyY]/;
const ONSET_CLUSTERS = /^(nh|lh|ch|qu|gu|gn|[bcdfgptv][rl])/i;
const NASAL_DIPHTHONGS = /^(ão|ões|ãe)/i;
const ORAL_DIPHTHONGS = /^(ai|au|ei|eu|oi|ou|ui)/i;

export function syllabifySingleWord(word: string): string[] {
  const clean = word.trim();
  if (!clean) return [];
  if (clean.includes('-')) {
    const parts = clean.split('-').filter(Boolean);
    return parts.map((p, i) => (i === parts.length - 1 ? `${p} ` : p));
  }
  if (clean.includes("'")) return [`${clean} `];

  const syllables: string[] = [];
  let current = '';

  for (let i = 0; i < clean.length; i++) {
    current += clean[i];
    if (!VOWELS.test(clean[i])) continue;

    const two = clean.slice(i, i + 2);
    if (NASAL_DIPHTHONGS.test(two)) {
      current += clean[i + 1]; i++;
      if (clean.slice(i, i + 2).toLowerCase() === 'es') { current += 's'; i++; }
    } else if (ORAL_DIPHTHONGS.test(two)) {
      current += clean[i + 1]; i++;
    } else if (i + 1 === clean.length - 1 && /^(am|em)$/i.test(clean.slice(i, i + 2))) {
      current += clean[i + 1]; i++;
    }

    const rest = clean.slice(i + 1);
    if (!VOWELS.test(rest)) continue;

    let cLen = 0;
    while (i + 1 + cLen < clean.length && !VOWELS.test(clean[i + 1 + cLen])) cLen++;

    if (cLen <= 1) {
      syllables.push(current);
      current = '';
    } else {
      const cluster2 = clean.slice(i + 1, i + 3);
      if (ONSET_CLUSTERS.test(cluster2)) {
        syllables.push(current);
        current = '';
      } else {
        current += clean[i + 1];
        i++;
        syllables.push(current);
        current = '';
      }
    }
  }

  if (current) syllables.push(current);
  return syllables.map((s, idx) => (idx === syllables.length - 1 ? `${s} ` : s));
}

export function splitTextIntoLetraSyllables(text: string): string[] {
  const normalized = text.replace(/--+/g, ' - ').trim();
  if (!normalized) return [];
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const result: string[] = [];

  for (const token of tokens) {
    if (token === '-' || token === '~' || token === '_') {
      if (result.length > 0) result[result.length - 1] = result[result.length - 1].trimEnd();
      result.push('-');
    } else {
      result.push(...syllabifySingleWord(token));
    }
  }
  return result;
}
