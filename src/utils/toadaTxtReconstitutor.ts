/**
 * toadaTxtReconstitutor.ts — Reconstitution 100% fidèle du format .txt (POSER LES TEMPS) et du HTML souligné (parolesOriginales)
 * depuis les pas du Piano Roll (Livret 4) et la Frise Conducteur (< 138 lignes).
 */
import type { ToadaProject, VocalPatternItem } from '../types/toadaProject.types';
import type { VocalStepData } from '../types/vocalPack.types';
import { formatMeasureChordsString } from './chordGridHelper';
import { resolvePatternOrTwinOrganizadorLine, hasEditedMidiSyllables } from './stepsToOrganizadorLineBuilder';
import { cleanLyricsForAlignment, extractActiveSyllablesFromPattern, formatWordsWithUnderlinedSyllables } from './syllableUnderlineFormatter';
import { VOCAL_GRAMMAR_VERSION, normalizeToadaTextV1ToV2, isKaraokeHiddenToken } from './vocalGrammarV2';

export function stitchSyllablesFromSteps(steps: VocalStepData[] = []): string {
  const active = steps.filter((s) => s.active && !s.isTie && !s.isMelisma && s.note !== '───' && s.syllable);
  if (active.length === 0) return '';
  let result = '';
  for (const s of active) {
    const syl = (s.syllable || '').trim();
    if (isKaraokeHiddenToken(syl)) continue;
    result += syl.endsWith('-') ? syl.slice(0, -1) : `${syl} `;
  }
  return result.trim().replace(/\s+/g, ' ');
}

export function extractPatternLyrics(pattern: VocalPatternItem): { text: string; hasAnacrusis: boolean } {
  const hasAnaSteps = Array.isArray(pattern.anacrusisSteps) && pattern.anacrusisSteps.some((s) => s.active && (s.midiNumber ?? 0) > 0);
  const midiLyrics = stitchSyllablesFromSteps([...(pattern.anacrusisSteps || []), ...(pattern.mainSteps || [])]);
  return { text: pattern.assignedLyricsText?.trim() || midiLyrics.trim() || pattern.name || 'Mesure', hasAnacrusis: Boolean(pattern.hasAnacrusis || hasAnaSteps) };
}

export function toadaToCleanHtml(rawTxtCode: string): string {
  if (!rawTxtCode || typeof rawTxtCode !== 'string') return '';
  const paras = rawTxtCode.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean), htmlParas: string[] = [];
  for (const p of paras) {
    const lines = p.split(/\r?\n/).map((l) => {
      if (/^\s*\[\s*(?:PAUSE|SILENCE)/i.test(l.trim())) return '';
      const clean = l.replace(/^\s*(\*{0,3})\s*[+/]\s*/, '$1').replace(/\[[^\]]+\]/g, '').replace(/(^|\s|\*)\+\s+/g, '$1')
        .replace(/(?<![\p{L}\d])0(?![\p{L}\d])|𝄽|───|_/gu, ' ').replace(/(\p{L})-\s+(?=\p{L})/gu, '$1').replace(/\s{2,}/g, ' ').trim();
      return clean.replace(/\*\*\*([^*]+)\*\*\*/g, '<em><strong>$1</strong></em>').replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
    }).filter(Boolean);
    if (lines.length > 0) htmlParas.push(`<p>${lines.join('<br>')}</p>`);
  }
  return htmlParas.join('\n');
}

const normalizeWordsOnly = (str: string) => str.replace(/\[[^\]]+\]/g, '').replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();

function applyRoleAsterisks(line: string, role: 'puxador' | 'coro', isTutti = false): string {
  let sigPrefix = '', body = line.trim();
  for (let i = 0; i < 2; i++) {
    const m = body.match(/^(\[(?:sig:[^\]]+|sim|nosim)\]\s*)/i);
    if (m) { sigPrefix += m[1]; body = body.slice(m[0].length).trim(); }
  }
  const stripped = body.replace(/^\*+|\*+$/g, '').trim();
  return isTutti ? `${sigPrefix}***${stripped}***` : (role === 'puxador' ? `${sigPrefix}*${stripped}*` : `${sigPrefix}${stripped}`);
}

export function reconstituteSinglePatternLine(pat: VocalPatternItem, allPatterns: VocalPatternItem[] = [], isTutti = false, upgradeToV2 = false): string {
  const fromSteps = resolvePatternOrTwinOrganizadorLine(pat, allPatterns, { isTutti });
  if (fromSteps) return fromSteps;
  const { text, hasAnacrusis } = extractPatternLyrics(pat);
  if (pat.rawLineCode && normalizeWordsOnly(pat.rawLineCode) === normalizeWordsOnly(text)) {
    return applyRoleAsterisks(upgradeToV2 ? normalizeToadaTextV1ToV2(pat.rawLineCode, { grammarVersion: 1, mainSteps: pat.mainSteps }) : pat.rawLineCode, pat.role, isTutti);
  }
  if (pat.timeAnchors && pat.timeAnchors.length > 0) {
    const built = pat.timeAnchors.map((a) => (a.isRest || a.isInitialRest) ? `[${a.beat}]0 ` : (a.isSustainedHold || !a.textSlice ? `[${a.beat}]_ ` : `[${a.beat}]${a.hasLeadingRest ? '_ ' : ''}${a.textSlice} `)).join('').trim();
    if (built) return applyRoleAsterisks(built, pat.role, isTutti);
  }
  const chordsStr = formatMeasureChordsString(pat.harmonyGrid?.measures?.[0]), chordsPrefix = chordsStr ? `${chordsStr} ` : '';
  const startAnchor = hasAnacrusis ? `[3]${text} [1]_` : `[1]${text}`, restTok = upgradeToV2 ? '0' : '_';
  const extraMeasures = Array.from({ length: Math.max(0, (pat.measuresCount || 1) - 1) }, () => `[1]${restTok} [2]${restTok} [3]${restTok} [4]${restTok}`).join(' ');
  return applyRoleAsterisks(`${chordsPrefix}${startAnchor}${extraMeasures ? ' ' + extraMeasures : ''}`.trim(), pat.role, isTutti);
}

function buildPatternUnderlinedHtmlLine(pat: VocalPatternItem, allPatterns: VocalPatternItem[], isTutti = false): string {
  const patNorm = cleanLyricsForAlignment(pat.assignedLyricsText || pat.rawLineCode || '').toLowerCase();
  const twin = !hasEditedMidiSyllables(pat) && patNorm ? allPatterns.find((p) => p.id !== pat.id && hasEditedMidiSyllables(p) && cleanLyricsForAlignment(p.assignedLyricsText || p.rawLineCode || '').toLowerCase() === patNorm) : undefined;
  return formatWordsWithUnderlinedSyllables(pat.assignedLyricsText || pat.rawLineCode || pat.name || '', extractActiveSyllablesFromPattern(twin || pat), pat.role === 'puxador', isTutti);
}

export function reconstituteToadaTxt(project: ToadaProject, options?: { upgradeToV2?: boolean }): { rawTxtCode: string; cleanHtml: string } {
  const upgradeToV2 = Boolean(options?.upgradeToV2 || (project.grammarVersion ?? project.toadaMeta?.grammarVersion ?? 1) >= VOCAL_GRAMMAR_VERSION);
  const lines: string[] = [], pendingCoro: string[] = [], htmlLines: string[] = [], pendingHtmlCoro: string[] = [];
  const allPats = project.patterns || [], patMap = new Map<string, VocalPatternItem>(allPats.map((p) => [p.id, p]));
  const flushCoro = () => {
    if (pendingCoro.length) { lines.push(...pendingCoro); pendingCoro.length = 0; }
    if (pendingHtmlCoro.length) { htmlLines.push(...pendingHtmlCoro); pendingHtmlCoro.length = 0; }
  };

  if (project.slots && project.slots.length > 0) {
    for (const slot of project.slots) {
      const patPux = slot.puxadorPatternId ? patMap.get(slot.puxadorPatternId) : null, patCoro = slot.coroPatternId ? patMap.get(slot.coroPatternId) : null;
      if (!patPux && !patCoro) { flushCoro(); lines.push(`[PAUSE ${Math.max(1, Math.min(8, slot.advanceMeasures ?? 1))}M]`); continue; }
      if (patPux && patCoro) {
        if (patPux.cardIndex !== undefined && patPux.cardIndex === patCoro.cardIndex) {
          flushCoro(); lines.push(reconstituteSinglePatternLine(patPux, allPats, true, upgradeToV2)); htmlLines.push(buildPatternUnderlinedHtmlLine(patPux, allPats, true));
        } else {
          lines.push(reconstituteSinglePatternLine(patPux, allPats, false, upgradeToV2)); pendingCoro.push(reconstituteSinglePatternLine(patCoro, allPats, false, upgradeToV2));
          htmlLines.push(buildPatternUnderlinedHtmlLine(patPux, allPats, false)); pendingHtmlCoro.push(buildPatternUnderlinedHtmlLine(patCoro, allPats, false));
        }
      } else {
        flushCoro();
        if (patPux) { lines.push(reconstituteSinglePatternLine(patPux, allPats, false, upgradeToV2)); htmlLines.push(buildPatternUnderlinedHtmlLine(patPux, allPats, false)); }
        if (patCoro) { lines.push(reconstituteSinglePatternLine(patCoro, allPats, false, upgradeToV2)); htmlLines.push(buildPatternUnderlinedHtmlLine(patCoro, allPats, false)); }
      }
    }
    flushCoro();
  } else {
    for (const pat of allPats) { lines.push(reconstituteSinglePatternLine(pat, allPats, false, upgradeToV2)); htmlLines.push(buildPatternUnderlinedHtmlLine(pat, allPats, false)); }
  }

  const rawTxtCode = lines.join('\n'), validHtml = htmlLines.filter(Boolean);
  return { rawTxtCode, cleanHtml: validHtml.length > 0 ? `<p>${validHtml.join('<br>')}</p>` : toadaToCleanHtml(rawTxtCode) };
}
