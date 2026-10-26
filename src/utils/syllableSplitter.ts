/**
 * syllableSplitter.ts
 * Découpeur syllabique hybride (Soulignement <u> prioritaire + Moteur phonétique corrigé).
 * Gère digrammes inséparables (qu+voyelle: ba-que, gu+voyelle: gon-guê, nh, lh, ch) (< 140 lignes).
 */

const VOWELS = /[aáàâãeéêèëiíïoóôõuúüAÁÀÂÃEÉÊÈËIÍÏOÓÔÕUÚÜyY]/;
const ONSET_CLUSTERS = /^(nh|lh|ch|qu|gu|gn|[bcdfgptv][rl])/i;
const NASAL_DIPHTHONGS = /^(ão|ões|ãe)/i;
const ORAL_DIPHTHONGS = /^(ai|au|ei|eu|oi|ou|ui)/i;

export function isVowelAt(str: string, index: number): boolean {
  const ch = str[index];
  if (!VOWELS.test(ch)) return false;
  // 'u' précédé de 'q' ou 'g' devant voyelle forme un digramme d'attaque inséparable
  if ((ch === 'u' || ch === 'U') && index > 0) {
    const prev = str[index - 1].toLowerCase(), next = str[index + 1];
    if ((prev === 'q' || prev === 'g') && next && VOWELS.test(next)) return false;
  }
  return true;
}

export function syllabifyUnderlinedWord(word: string): string[] | null {
  if (!/<u\b[^>]*>/i.test(word)) return null;
  const marked = word.replace(/<u\b[^>]*>/gi, '\u0001').replace(/<\/u>/gi, '');
  const parts = marked.split('\u0001').filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  return parts.map((s, idx) => (idx === parts.length - 1 ? `${s} ` : s));
}

export function syllabifySingleWord(word: string): string[] {
  const clean = word.trim();
  if (!clean) return [];

  // 1. Découpage prioritaire par balises <u>...</u>
  const underlined = syllabifyUnderlinedWord(clean);
  if (underlined) return underlined;

  // 2. Découpage par tirets explicites ou apostrophes
  if (clean.includes('-')) {
    const parts = clean.split('-').filter(Boolean);
    return parts.map((p, i) => (i === parts.length - 1 ? `${p} ` : p));
  }
  if (clean.includes("'")) {
    const apIdx = clean.indexOf("'"), stem = clean.slice(0, apIdx), clitic = clean.slice(apIdx + 1);
    const stemSylls = syllabifySingleWord(stem);
    if (stemSylls.length <= 1) return [`${clean} `];
    const last = stemSylls[stemSylls.length - 1].trimEnd();
    stemSylls[stemSylls.length - 1] = `${last}'${clitic} `;
    return stemSylls;
  }

  // 3. Moteur phonétique automatique (Portugais & Français)
  const syllables: string[] = [];
  let current = '';

  for (let i = 0; i < clean.length; i++) {
    current += clean[i];
    if (!isVowelAt(clean, i)) continue;

    const two = clean.slice(i, i + 2);
    if (NASAL_DIPHTHONGS.test(two)) {
      current += clean[i + 1]; i++;
      if (clean.slice(i, i + 2).toLowerCase() === 'es') { current += 's'; i++; }
    } else if (ORAL_DIPHTHONGS.test(two)) {
      current += clean[i + 1]; i++;
    } else if (i + 1 === clean.length - 1 && /^(am|em)$/i.test(clean.slice(i, i + 2))) {
      current += clean[i + 1]; i++;
    }

    let hasNextVowel = false;
    for (let k = i + 1; k < clean.length; k++) {
      if (isVowelAt(clean, k)) { hasNextVowel = true; break; }
    }
    if (!hasNextVowel) continue;

    let cLen = 0;
    while (i + 1 + cLen < clean.length && !isVowelAt(clean, i + 1 + cLen)) cLen++;

    if (cLen <= 1) {
      syllables.push(current);
      current = '';
    } else {
      const cluster2 = clean.slice(i + 1, i + 3);
      if (ONSET_CLUSTERS.test(cluster2)) {
        syllables.push(current);
        current = '';
      } else {
        current += clean[i + 1]; i++;
        syllables.push(current);
        current = '';
      }
    }
  }

  if (current) syllables.push(current);
  return syllables.map((s, idx) => (idx === syllables.length - 1 ? `${s} ` : s));
}

export function splitTextIntoLetraSyllables(text: string): string[] {
  // Découpe les badges intra-mots (ex: gongu[M6•1]ê -> gongu [M6•1]ê)
  const spacedBadges = text.replace(/([^\s\[]+)(\[(?:M\d+[•\.:])?\d+\])/g, '$1 $2');
  const normalized = spacedBadges.replace(/--+/g, ' - ').trim();
  if (!normalized) return [];
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const result: string[] = [];

  for (const token of tokens) {
    if (token === '-' || token === '~' || token === '_') {
      if (result.length > 0) result[result.length - 1] = result[result.length - 1].trimEnd();
      result.push('-');
    } else {
      // Retire les éventuels badges de temps résiduels collés devant le mot
      const cleanToken = token.replace(/^\[(?:M\d+[•\.:])?\d+\]/g, '');
      if (cleanToken) result.push(...syllabifySingleWord(cleanToken));
    }
  }
  return result;
}
