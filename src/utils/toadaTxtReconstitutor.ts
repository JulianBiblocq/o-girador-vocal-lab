/**
 * toadaTxtReconstitutor.ts
 * Reconstitution 100% fidèle du format .txt (POSER LES TEMPS) depuis la Frise Conducteur (< 138 lignes).
 * Format canonique : 1 ligne = 1 carte (#1..#N), support Tutti (***...***) et préservation de rawLineCode.
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
    if (syl.endsWith('-')) result += syl.slice(0, -1);
    else result += syl + ' ';
  }
  return result.trim().replace(/\s+/g, ' ');
}

export function extractPatternLyrics(pattern: VocalPatternItem): { text: string; hasAnacrusis: boolean } {
  const hasAnaSteps = Array.isArray(pattern.anacrusisSteps) && pattern.anacrusisSteps.some((s) => s.active && s.midiNumber > 0);
  const hasAnacrusis = Boolean(pattern.hasAnacrusis || hasAnaSteps);
  const midiLyrics = stitchSyllablesFromSteps([...(pattern.anacrusisSteps || []), ...(pattern.mainSteps || [])]);
  const text = pattern.assignedLyricsText?.trim() || midiLyrics.trim() || pattern.name || 'Mesure';
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
      clean = clean
        .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
      return clean;
    }).filter(Boolean);
    if (lines.length > 0) htmlParas.push(`<p>${lines.join('<br>')}</p>`);
  }
  return htmlParas.join('\n');
}

function normalizeWordsOnly(str: string): string {
  return str.replace(/\[[^\]]+\]/g, '').replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
}

function applyRoleAsterisks(line: string, role: 'puxador' | 'coro', isTutti = false): string {
  let sigPrefix = '', body = line.trim();
  const sigMatch = body.match(/^(\[sig:[^\]]+\]\s*)/i);
  if (sigMatch) { sigPrefix = sigMatch[1]; body = body.slice(sigMatch[0].length).trim(); }
  const stripped = body.replace(/^\*+|\*+$/g, '').trim();
  if (isTutti) return `${sigPrefix}***${stripped}***`;
  return role === 'puxador' ? `${sigPrefix}*${stripped}*` : `${sigPrefix}${stripped}`;
}

function reconstituteSinglePatternLine(pat: VocalPatternItem, isTutti = false): string {
  const { text, hasAnacrusis } = extractPatternLyrics(pat);
  if (pat.rawLineCode && normalizeWordsOnly(pat.rawLineCode) === normalizeWordsOnly(text)) {
    return applyRoleAsterisks(pat.rawLineCode, pat.role, isTutti);
  }
  if (pat.timeAnchors && pat.timeAnchors.length > 0) {
    const built = pat.timeAnchors
      .map((a) => (a.isRest || a.isInitialRest || a.isSustainedHold || !a.textSlice ? `[${a.beat}]_ ` : `[${a.beat}]${a.hasLeadingRest ? '_ ' : ''}${a.textSlice} `))
      .join('').trim();
    if (built) return applyRoleAsterisks(built, pat.role, isTutti);
  }
  const chordsStr = formatMeasureChordsString(pat.harmonyGrid?.measures?.[0]);
  const chordsPrefix = chordsStr ? `${chordsStr} ` : '';
  const startAnchor = hasAnacrusis ? `[3]${text} [1]_` : `[1]${text}`;
  const extraMeasures = Array.from({ length: Math.max(0, (pat.measuresCount || 1) - 1) }, () => '[1]_ [2]_ [3]_ [4]_').join(' ');
  const fullLine = `${chordsPrefix}${startAnchor}${extraMeasures ? ' ' + extraMeasures : ''}`.trim();
  return applyRoleAsterisks(fullLine, pat.role, isTutti);
}

export function reconstituteToadaTxt(project: ToadaProject): { rawTxtCode: string; cleanHtml: string } {
  const lines: string[] = [], pendingCoro: string[] = [];
  const patMap = new Map<string, VocalPatternItem>(project.patterns.map((p) => [p.id, p]));
  const flushPendingCoro = () => { if (pendingCoro.length) { lines.push(...pendingCoro); pendingCoro.length = 0; } };

  if (project.slots && project.slots.length > 0) {
    for (const slot of project.slots) {
      const patPux = slot.puxadorPatternId ? patMap.get(slot.puxadorPatternId) : null;
      const patCoro = slot.coroPatternId ? patMap.get(slot.coroPatternId) : null;
      if (!patPux && !patCoro) {
        flushPendingCoro();
        lines.push(`[PAUSE ${Math.max(1, Math.min(8, slot.advanceMeasures ?? 1))}M]`);
        continue;
      }
      if (patPux && patCoro) {
        if (patPux.cardIndex !== undefined && patPux.cardIndex === patCoro.cardIndex) {
          flushPendingCoro();
          lines.push(reconstituteSinglePatternLine(patPux, true));
        } else {
          lines.push(reconstituteSinglePatternLine(patPux, false));
          pendingCoro.push(reconstituteSinglePatternLine(patCoro, false));
        }
      } else {
        flushPendingCoro();
        if (patPux) lines.push(reconstituteSinglePatternLine(patPux, false));
        if (patCoro) lines.push(reconstituteSinglePatternLine(patCoro, false));
      }
    }
    flushPendingCoro();
  } else {
    for (const pat of project.patterns) lines.push(reconstituteSinglePatternLine(pat, false));
  }

  const rawTxtCode = lines.join('\n');
  return { rawTxtCode, cleanHtml: toadaToCleanHtml(rawTxtCode) };
}
