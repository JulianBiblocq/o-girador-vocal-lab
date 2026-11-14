/**
 * syllableSplitter.ts
 * Découpeur syllabique hybride v2 : pont bijectif `<u>` <-> `-` (`<u>m</u>ar<u>c</u>a<u>ç</u>ão` <-> `MAR- CA- ÇÃO`),
 * élisions par apostrophe `'`, silence `0`/`𝄽` filtré et `_` réservé aux tenues/mélismes (< 145 lignes).
 */
import { normalizeElisionApostrophes, isExplicitRestToken } from './vocalGrammarV2';

export { normalizeElisionApostrophes };

const VOWELS = /[aáàâãeéêèëiíïoóôõuúüAÁÀÂÃEÉÊÈËIÍÏOÓÔÕUÚÜyY]/;
const ONSET_CLUSTERS = /^(nh|lh|ch|qu|gu|gn|[bcdfgptv][rl]|[bcdfghjklmnpqrstvwxz]')/i;
const NASAL_DIPHTHONGS = /^(ão|ões|ãe)/i;
const ORAL_DIPHTHONGS = /^(ai|au|ei|eu|oi|ou|ui)/i;

export function isVowelAt(str: string, index: number): boolean {
  const ch = str[index];
  if (!ch || !VOWELS.test(ch)) return false;
  if ((ch === 'u' || ch === 'U') && index > 0) {
    const prev = str[index - 1].toLowerCase();
    const next = str[index + 1] === "'" ? str[index + 2] : str[index + 1];
    if ((prev === 'q' || prev === 'g') && next && VOWELS.test(next)) return false;
  }
  return true;
}

export function syllabifyUnderlinedWord(word: string): string[] | null {
  if (!/<u\b[^>]*>/i.test(word)) return null;
  const marked = word.replace(/<u\b[^>]*>/gi, '\u0001').replace(/<\/u>/gi, '');
  const parts = marked.split('\u0001').filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  return parts.map((s, idx) => (idx === parts.length - 1 ? `${s} ` : `${s}-`));
}

/** Pont 1:1 Atelier Papier `MAR- CA- ÇÃO` -> Varal `<u>M</u>AR<u>C</u>A<u>Ç</u>ÃO` */
export function convertPaperHyphensToUnderlinedHtml(paperText: string): string {
  if (!paperText) return '';
  const tokens = normalizeElisionApostrophes(paperText).trim().split(/\s+/).filter(Boolean);
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (isExplicitRestToken(tok) || tok === '_') { out += (out && !out.endsWith(' ') ? ' ' : '') + tok + ' '; continue; }
    const joinsNext = tok.endsWith('-') && tok.length > 1;
    const subParts = (joinsNext ? tok.slice(0, -1) : tok).split('-').filter(Boolean);
    for (let p = 0; p < subParts.length; p++) {
      const seg = subParts[p], m = seg.match(/[\p{L}\p{M}]/u);
      out += m && m.index !== undefined ? `${seg.slice(0, m.index)}<u>${m[0]}</u>${seg.slice(m.index + m[0].length)}` : seg;
    }
    if (!joinsNext && i < tokens.length - 1) out += ' ';
  }
  return out.trim();
}

/** Pont inverse 1:1 Varal `<u>m</u>ar<u>c</u>a<u>ç</u>ão` -> Atelier Papier `mar- ca- ção` */
export function convertUnderlinedHtmlToPaperHyphens(htmlText: string): string {
  if (!htmlText) return '';
  return normalizeElisionApostrophes(htmlText)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const syls = syllabifyUnderlinedWord(word);
      return syls ? syls.map((s) => s.trim()).join(' ') : word;
    })
    .join(' ');
}

export function syllabifySingleWord(word: string): string[] {
  const clean = normalizeElisionApostrophes(word).trim();
  if (!clean || isExplicitRestToken(clean)) return [];
  const underlined = syllabifyUnderlinedWord(clean);
  if (underlined) return underlined;

  if (clean.includes('-')) {
    const endsWithHyphen = clean.endsWith('-') && clean.length > 1;
    const parts = clean.split('-').filter(Boolean);
    return parts.map((p, i) => (i === parts.length - 1 ? (endsWithHyphen ? `${p}-` : `${p} `) : `${p}-`));
  }

  const syllables: string[] = [];
  let current = '';
  for (let i = 0; i < clean.length; i++) {
    current += clean[i];
    if (!isVowelAt(clean, i)) continue;
    const consumeDiphthongAt = () => {
      const two = clean.slice(i, i + 2);
      if (NASAL_DIPHTHONGS.test(two)) {
        current += clean[i + 1]; i++;
        if (clean.slice(i, i + 2).toLowerCase() === 'es') { current += 's'; i++; }
      } else if (ORAL_DIPHTHONGS.test(two) || (i + 1 === clean.length - 1 && /^(am|em)$/i.test(two))) {
        current += clean[i + 1]; i++;
      }
    };
    consumeDiphthongAt();
    while (clean[i + 1] === "'" && isVowelAt(clean, i + 2)) {
      current += clean[i + 1] + clean[i + 2]; i += 2; consumeDiphthongAt();
    }
    let hasNextVowel = false;
    for (let k = i + 1; k < clean.length; k++) if (isVowelAt(clean, k)) { hasNextVowel = true; break; }
    if (!hasNextVowel) continue;
    let cLen = 0;
    while (i + 1 + cLen < clean.length && !isVowelAt(clean, i + 1 + cLen)) cLen++;
    if (cLen <= 1 || ONSET_CLUSTERS.test(clean.slice(i + 1, i + 3))) { syllables.push(current); current = ''; }
    else { current += clean[i + 1]; i++; syllables.push(current); current = ''; }
  }
  if (current) syllables.push(current);
  return syllables.map((s, idx) => (idx === syllables.length - 1 ? `${s} ` : s));
}

export function splitTextIntoLetraSyllables(text: string): string[] {
  const spacedBadges = normalizeElisionApostrophes(text).replace(/([^\s\[]+)(\[(?:M\d+[•.:])?\d+\])/g, '$1 $2');
  const normalized = spacedBadges.replace(/--+/g, ' _ ').trim();
  if (!normalized) return [];
  const tokens = normalized.split(/\s+/).filter(Boolean), result: string[] = [];

  for (const token of tokens) {
    if (isExplicitRestToken(token)) continue;
    if (token === '_' || token === '~' || token === '-') {
      if (result.length > 0) result[result.length - 1] = result[result.length - 1].trimEnd();
      result.push('_');
    } else {
      const cleanToken = token.replace(/^\[(?:M\d+[•.:])?\d+\]/g, '');
      if (cleanToken && !isExplicitRestToken(cleanToken)) result.push(...syllabifySingleWord(cleanToken));
    }
  }
  return result;
}

export function splitPortugueseLyricsIntoSyllables(text: string): string[] {
  return splitTextIntoLetraSyllables(text)
    .map((s) => s.trim().replace(/-+$/, '').trim())
    .filter((s) => Boolean(s && s !== '-' && s !== '_' && !isExplicitRestToken(s)));
}
