/**
 * toadaTxtReconstitutor.ts — Reconstitution 100% fidèle du format .txt (POSER LES TEMPS) et du HTML souligné (parolesOriginales)
 * depuis les pas du Piano Roll (Livret 4) et la Frise Conducteur (< 140 lignes).
 */
import type { ToadaProject, VocalPatternItem } from '../types/toadaProject.types';
import type { VocalStepData } from '../types/vocalPack.types';
import { formatMeasureChordsString } from './chordGridHelper';
import { resolvePatternOrTwinOrganizadorLine, hasEditedMidiSyllables } from './stepsToOrganizadorLineBuilder';
import { cleanLyricsForAlignment, extractActiveSyllablesFromPattern, formatWordsWithUnderlinedSyllables } from './syllableUnderlineFormatter';

export function stitchSyllablesFromSteps(steps: VocalStepData[] = []): string {
  const active = steps.filter((s) => s.active && s.syllable && s.syllable !== '───');
  if (active.length === 0) return '';
  let result = '';
  for (const s of active) {
    const syl = (s.syllable || '').trim();
    if (!syl || syl === '───') continue;
    result += syl.endsWith('-') ? syl.slice(0, -1) : `${syl} `;
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
  const paras = rawTxtCode.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean), htmlParas: string[] = [];
  for (const p of paras) {
    const lines = p.split(/\r?\n/).map((l) => {
      if (/^\s*\[\s*(?:PAUSE|SILENCE)/i.test(l.trim())) return '';
      const clean = l.replace(/^\s*[+/]\s*/, '').replace(/\[[^\]]+\]/g, '').replace(/(^|\s|\*)\+\s+/g, '$1').replace(/_/g, ' ').replace(/\s{2,}/g, ' ').trim();
      return clean.replace(/\*\*\*([^*]+)\*\*\*/g, '<em><strong>$1</strong></em>').replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
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
  for (let i = 0; i < 2; i++) {
    const m = body.match(/^(\[(?:sig:[^\]]+|sim|nosim)\]\s*)/i);
    if (m) { sigPrefix += m[1]; body = body.slice(m[0].length).trim(); }
  }
  const stripped = body.replace(/^\*+|\*+$/g, '').trim();
  if (isTutti) return `${sigPrefix}***${stripped}***`;
  return role === 'puxador' ? `${sigPrefix}*${stripped}*` : `${sigPrefix}${stripped}`;
}

export function reconstituteSinglePatternLine(
  pat: VocalPatternItem,
  allPatterns: VocalPatternItem[] = [],
  isTutti = false
): string {
  const fromSteps = resolvePatternOrTwinOrganizadorLine(pat, allPatterns, { isTutti });
  if (fromSteps) return fromSteps;

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

function buildPatternUnderlinedHtmlLine(pat: VocalPatternItem, allPatterns: VocalPatternItem[], isTutti = false): string {
  const patNorm = cleanLyricsForAlignment(pat.assignedLyricsText || pat.rawLineCode || '').toLowerCase();
  const twin = !hasEditedMidiSyllables(pat) && patNorm
    ? allPatterns.find((p) => p.id !== pat.id && hasEditedMidiSyllables(p) && cleanLyricsForAlignment(p.assignedLyricsText || p.rawLineCode || '').toLowerCase() === patNorm)
    : undefined;
  const sylls = extractActiveSyllablesFromPattern(twin || pat);
  const words = pat.assignedLyricsText || pat.rawLineCode || pat.name || '';
  return formatWordsWithUnderlinedSyllables(words, sylls, pat.role === 'puxador', isTutti);
}

export function reconstituteToadaTxt(project: ToadaProject): { rawTxtCode: string; cleanHtml: string } {
  const lines: string[] = [], pendingCoro: string[] = [], htmlLines: string[] = [], pendingHtmlCoro: string[] = [];
  const allPats = project.patterns || [], patMap = new Map<string, VocalPatternItem>(allPats.map((p) => [p.id, p]));
  const flushCoro = () => {
    if (pendingCoro.length) { lines.push(...pendingCoro); pendingCoro.length = 0; }
    if (pendingHtmlCoro.length) { htmlLines.push(...pendingHtmlCoro); pendingHtmlCoro.length = 0; }
  };

  if (project.slots && project.slots.length > 0) {
    for (const slot of project.slots) {
      const patPux = slot.puxadorPatternId ? patMap.get(slot.puxadorPatternId) : null;
      const patCoro = slot.coroPatternId ? patMap.get(slot.coroPatternId) : null;
      if (!patPux && !patCoro) {
        flushCoro();
        lines.push(`[PAUSE ${Math.max(1, Math.min(8, slot.advanceMeasures ?? 1))}M]`);
        continue;
      }
      if (patPux && patCoro) {
        if (patPux.cardIndex !== undefined && patPux.cardIndex === patCoro.cardIndex) {
          flushCoro();
          lines.push(reconstituteSinglePatternLine(patPux, allPats, true));
          htmlLines.push(buildPatternUnderlinedHtmlLine(patPux, allPats, true));
        } else {
          lines.push(reconstituteSinglePatternLine(patPux, allPats, false));
          pendingCoro.push(reconstituteSinglePatternLine(patCoro, allPats, false));
          htmlLines.push(buildPatternUnderlinedHtmlLine(patPux, allPats, false));
          pendingHtmlCoro.push(buildPatternUnderlinedHtmlLine(patCoro, allPats, false));
        }
      } else {
        flushCoro();
        if (patPux) { lines.push(reconstituteSinglePatternLine(patPux, allPats, false)); htmlLines.push(buildPatternUnderlinedHtmlLine(patPux, allPats, false)); }
        if (patCoro) { lines.push(reconstituteSinglePatternLine(patCoro, allPats, false)); htmlLines.push(buildPatternUnderlinedHtmlLine(patCoro, allPats, false)); }
      }
    }
    flushCoro();
  } else {
    for (const pat of allPats) {
      lines.push(reconstituteSinglePatternLine(pat, allPats, false));
      htmlLines.push(buildPatternUnderlinedHtmlLine(pat, allPats, false));
    }
  }

  const rawTxtCode = lines.join('\n');
  const validHtml = htmlLines.filter(Boolean);
  const cleanHtml = validHtml.length > 0 ? `<p>${validHtml.join('<br>')}</p>` : toadaToCleanHtml(rawTxtCode);
  return { rawTxtCode, cleanHtml };
}
