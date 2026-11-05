/**
 * toadaTxtReconstitutor.ts
 * Reconstitution 100% fidèle du format .txt (POSER LES TEMPS) depuis la Frise Conducteur (< 130 lignes).
 * Format canonique : 1 ligne = 1 carte (#1..#N), zéro "/ (suite ...)", préservation intégrale de rawLineCode.
 */
import type { ToadaProject, VocalPatternItem } from '../types/toadaProject.types';
import type { VocalStepData } from '../types/vocalPack.types';
import { formatMeasureChordsString } from './chordGridHelper';

export function stitchSyllablesFromSteps(steps: VocalStepData[] = []): string {
  const active = steps.filter((s) => s.active && s.syllable && s.syllable !== '───');
  if (active.length === 0) return '';

  let result = '';
  for (const s of active) {
    const syl = (s.syllable || '').trim();
    if (!syl || syl === '───') continue;
    if (syl.endsWith('-')) {
      result += syl.slice(0, -1);
    } else {
      result += syl + ' ';
    }
  }
  return result.trim().replace(/\s+/g, ' ');
}

export function extractPatternLyrics(pattern: VocalPatternItem): { text: string; hasAnacrusis: boolean } {
  const hasAnaSteps = Array.isArray(pattern.anacrusisSteps) && pattern.anacrusisSteps.some((s) => s.active && s.midiNumber > 0);
  const hasAnacrusis = Boolean(pattern.hasAnacrusis || hasAnaSteps);

  let text = '';
  const midiLyrics = stitchSyllablesFromSteps([...(pattern.anacrusisSteps || []), ...(pattern.mainSteps || [])]);
  if (pattern.assignedLyricsText?.trim()) {
    text = pattern.assignedLyricsText.trim();
  } else if (midiLyrics.trim()) {
    text = midiLyrics;
  } else {
    text = pattern.name || 'Mesure';
  }

  return { text, hasAnacrusis };
}

export function toadaToCleanHtml(rawTxtCode: string): string {
  if (!rawTxtCode || typeof rawTxtCode !== 'string') return '';
  const paras = rawTxtCode.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean);
  const htmlParas: string[] = [];

  for (const p of paras) {
    const lines = p.split(/\r?\n/).map((l) => {
      let clean = l
        .replace(/^\s*[+/]\s*/, '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(/(^|\s|\*)\+\s+/g, '$1')
        .replace(/_/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
      clean = clean.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
      return clean;
    }).filter(Boolean);
    if (lines.length > 0) {
      htmlParas.push(`<p>${lines.join('<br>')}</p>`);
    }
  }
  return htmlParas.join('\n');
}

function normalizeWordsOnly(str: string): string {
  return str
    .replace(/\[[^\]]+\]/g, '')
    .replace(/<(?!(\/?u\b))[^>]*>/gi, '')
    .replace(/[\*_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function applyRoleAsterisks(line: string, role: 'puxador' | 'coro'): string {
  let sigPrefix = '';
  let body = line.trim();
  const sigMatch = body.match(/^(\[sig:[^\]]+\]\s*)/i);
  if (sigMatch) {
    sigPrefix = sigMatch[1];
    body = body.slice(sigMatch[0].length).trim();
  }
  const stripped = body.replace(/^\*+|\*+$/g, '').trim();
  return role === 'puxador' ? `${sigPrefix}*${stripped}*` : `${sigPrefix}${stripped}`;
}

function reconstituteSinglePatternLine(pat: VocalPatternItem): string {
  const { text, hasAnacrusis } = extractPatternLyrics(pat);

  // 1. Si rawLineCode existe et que le texte n'a pas été réécrit, on préserve 100% des ancres d'Organizador
  if (pat.rawLineCode && normalizeWordsOnly(pat.rawLineCode) === normalizeWordsOnly(text)) {
    return applyRoleAsterisks(pat.rawLineCode, pat.role);
  }

  // 2. Si timeAnchors existe, on reconstruit la ligne avec ses pastilles [1]..[12] et _
  if (pat.timeAnchors && pat.timeAnchors.length > 0) {
    const built = pat.timeAnchors
      .map((a) => (a.isRest || a.isInitialRest || a.isSustainedHold || !a.textSlice ? `[${a.beat}]_ ` : `[${a.beat}]${a.textSlice} `))
      .join('')
      .trim();
    if (built) return applyRoleAsterisks(built, pat.role);
  }

  // 3. Repli : construction d'une ligne structurée avec le compte exact de mesures [1]
  const chordsStr = formatMeasureChordsString(pat.harmonyGrid?.measures?.[0]);
  const chordsPrefix = chordsStr ? `${chordsStr} ` : '';
  const startAnchor = hasAnacrusis ? `[3]${text} [1]_` : `[1]${text}`;
  const extraMeasures = Array.from({ length: Math.max(0, (pat.measuresCount || 1) - 1) }, () => '[1]_ [2]_ [3]_ [4]_').join(' ');
  const fullLine = `${chordsPrefix}${startAnchor}${extraMeasures ? ' ' + extraMeasures : ''}`.trim();
  return applyRoleAsterisks(fullLine, pat.role);
}

export function reconstituteToadaTxt(project: ToadaProject): { rawTxtCode: string; cleanHtml: string } {
  const lines: string[] = [];
  const patMap = new Map<string, VocalPatternItem>(project.patterns.map((p) => [p.id, p]));

  if (project.slots && project.slots.length > 0) {
    for (const slot of project.slots) {
      const patPux = slot.puxadorPatternId ? patMap.get(slot.puxadorPatternId) : null;
      const patCoro = slot.coroPatternId ? patMap.get(slot.coroPatternId) : null;
      if (patPux) lines.push(reconstituteSinglePatternLine(patPux));
      if (patCoro) lines.push(reconstituteSinglePatternLine(patCoro));
    }
  } else {
    for (const pat of project.patterns) {
      lines.push(reconstituteSinglePatternLine(pat));
    }
  }

  const rawTxtCode = lines.join('\n');
  const cleanHtml = toadaToCleanHtml(rawTxtCode);
  return { rawTxtCode, cleanHtml };
}
