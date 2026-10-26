/**
 * toadaConductorGenerator.ts
 * Frise Conducteur automatique avec agrégation des mesures liées (/) et superposition mixte (< 140 lignes).
 */
import type { ToadaProject, VocalPatternItem, ToadaArrangementSlot, VocalRole } from '../types/toadaProject.types';
import type { ParsedToadaSheetResult } from '../types/toadaDocument.types';
import { createDefaultVocalPattern } from '../types/toadaProject.types';
import { createHarmonyGridFromChords } from './chordGridHelper';
import { detectToadaLexicon } from './toadaLexiconDetector';
import { generateQuizFromLexicon } from './toadaQuizGenerator';
import { buildNormalizedPatternKey } from './timeAnchorParser';

export interface ToadaSheetGenOptions {
  bpm?: number;
  defaultMeasuresCount?: 1 | 2 | 3 | 4;
  defaultHasAnacrusis?: boolean;
}

export function extractCleanFirstWord(text: string): string {
  if (!text) return 'Phrase';
  const m = text.replace(/<[^>]*>/g, '').trim().match(/^[\s"'«“„–—\-_([{\\/*]*([\p{L}\p{M}\d]+)/u);
  return m?.[1] ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : (text.trim().split(/\s+/)[0] || 'Phrase');
}

export function buildPatternNameFromFirstWord(text: string, existingNames: string[]): string {
  const base = extractCleanFirstWord(text);
  let idx = 2, name = base;
  while (existingNames.includes(name)) name = `${base} (${idx++})`;
  return name;
}

function initPatternFromSegment(
  role: VocalRole, seg: any, bpm: number, existingNames: string[], measuresCount: 1 | 2 | 3 | 4 = 1, defaultAna = false
): VocalPatternItem {
  const effBpm = seg.sectionBpm ?? bpm;
  const pat = createDefaultVocalPattern(role, buildPatternNameFromFirstWord(seg.text, existingNames), measuresCount, effBpm);
  pat.baseBpm = effBpm;
  pat.bpm = effBpm;
  pat.assignedLyricsText = seg.text;
  pat.hasAnacrusis = seg.hasAnacrusis ?? defaultAna;
  pat.anacrusisBeats = seg.anacrusisBeats ?? (pat.hasAnacrusis ? 2 : undefined);
  pat.timeAnchors = seg.timeAnchors;
  pat.exitBeat = seg.exitBeat;
  if (seg.chords?.length) pat.harmonyGrid = createHarmonyGridFromChords(seg.chords, measuresCount);
  return pat;
}

export function generateToadaFromSheet(project: ToadaProject, parsed: ParsedToadaSheetResult, options?: ToadaSheetGenOptions): ToadaProject {
  const newPatterns: VocalPatternItem[] = [];
  const newSlots: ToadaArrangementSlot[] = [];
  const map = new Map<string, string>();
  const targetBpm = options?.bpm ?? parsed.docMeta?.bpmDefaut ?? project.bpm ?? 88;

  let i = 0;
  while (i < parsed.segments.length) {
    const seg = parsed.segments[i];
    const nextSeg = parsed.segments[i + 1];

    if (seg.isMixedPair && nextSeg && nextSeg.isMixedPair && seg.role !== nextSeg.role) {
      const puxSeg = seg.role === 'puxador' ? seg : nextSeg, coroSeg = seg.role === 'coro' ? seg : nextSeg;
      const puxKey = buildNormalizedPatternKey('puxador', puxSeg.text, puxSeg.timeAnchors);
      let patPuxId = map.get(puxKey);
      if (!patPuxId) { const patPux = initPatternFromSegment('puxador', puxSeg, targetBpm, newPatterns.map((p) => p.name), 1); newPatterns.push(patPux); map.set(puxKey, (patPuxId = patPux.id)); }
      const coroKey = buildNormalizedPatternKey('coro', coroSeg.text, coroSeg.timeAnchors);
      let patCoroId = map.get(coroKey);
      if (!patCoroId) { const patCoro = initPatternFromSegment('coro', coroSeg, targetBpm, newPatterns.map((p) => p.name), 1); newPatterns.push(patCoro); map.set(coroKey, (patCoroId = patCoro.id)); }
      newSlots.push({ slotId: `slot-${newSlots.length + 1}`, puxadorPatternId: patPuxId, coroPatternId: patCoroId });
      i += 2; continue;
    }

    let measuresCount: 1 | 2 | 3 | 4 = (seg.measuresCount ?? 1) as 1 | 2 | 3 | 4;
    let lookAhead = i + 1;
    while (lookAhead < parsed.segments.length && parsed.segments[lookAhead].isLinkedMeasure && measuresCount < 4) {
      measuresCount = (measuresCount + 1) as 1 | 2 | 3 | 4;
      lookAhead++;
    }

    const key = buildNormalizedPatternKey(seg.role, seg.text, seg.timeAnchors);
    let patId = map.get(key);
    if (!patId) {
      const pat = initPatternFromSegment(seg.role, seg, targetBpm, newPatterns.filter((p) => p.role === seg.role).map((p) => p.name), measuresCount, options?.defaultHasAnacrusis ?? true);
      newPatterns.push(pat);
      map.set(key, (patId = pat.id));
    }

    newSlots.push({
      slotId: `slot-${newSlots.length + 1}`,
      puxadorPatternId: seg.role === 'puxador' ? patId : null,
      coroPatternId: seg.role === 'coro' ? patId : null
    });
    i = lookAhead;
  }

  // Tuilage horizontal (advanceMeasures) si fin sur T1 et attaque suivante sur temps > 1
  const patMap = new Map(newPatterns.map((p) => [p.id, p]));
  for (let s = 0; s < newSlots.length - 1; s++) {
    const curPat = patMap.get(newSlots[s].puxadorPatternId || newSlots[s].coroPatternId || '');
    const nextPat = patMap.get(newSlots[s + 1].puxadorPatternId || newSlots[s + 1].coroPatternId || '');
    const nextAttackBeat = nextPat?.timeAnchors?.find((a) => !a.isRest)?.beat;
    if (curPat?.exitBeat === 1 && curPat?.measuresCount === 2 && nextAttackBeat !== undefined && nextAttackBeat > 1) {
      newSlots[s].advanceMeasures = 1;
    } else if (curPat?.measuresCount === 1) {
      newSlots[s].advanceMeasures = 1;
    }
  }

  const globalHarmony = parsed.docMeta?.globalHarmonyGrid || parsed.docMeta?.harmonyGrid || project.globalHarmonyGrid;
  const generated: ToadaProject = {
    ...project,
    title: parsed.docMeta?.titre || project.title,
    bpm: targetBpm,
    timeSignature: (parsed.docMeta?.signature as any) || project.timeSignature,
    patterns: newPatterns.length > 0 ? newPatterns : project.patterns,
    slots: newSlots.length > 0 ? newSlots : project.slots,
    activePatternId: newPatterns[0]?.id || project.activePatternId,
    toadaMeta: parsed.docMeta ? { ...project.toadaMeta, ...parsed.docMeta } : project.toadaMeta,
    sheetLines: parsed.segments.map((s) => ({ role: s.role, text: s.text, phoneticText: s.phoneticText })),
    globalHarmonyGrid: globalHarmony,
  };

  // Conservation prioritaire des lexiques et quiz existants (venant d'Organizador)
  const existingLex = parsed.docMeta?.notesLexique?.length ? parsed.docMeta.notesLexique : (project.toadaMeta?.notesLexique || []);
  const detectedLex = existingLex.length > 0 ? existingLex : detectToadaLexicon(generated);
  const existingQuiz = parsed.docMeta?.questionsQcm?.length ? parsed.docMeta.questionsQcm : (project.toadaMeta?.questionsQcm || []);
  const quizItems = existingQuiz.length > 0 ? existingQuiz : generateQuizFromLexicon(detectedLex);

  if (generated.toadaMeta) {
    generated.toadaMeta.notesLexique = detectedLex;
    generated.toadaMeta.questionsQcm = quizItems;
    if (globalHarmony && !generated.toadaMeta.harmonyGrid) generated.toadaMeta.harmonyGrid = globalHarmony;
  }
  generated.patterns.forEach((p) => {
    p.baseBpm = targetBpm;
    p.bpm = targetBpm;
    if (globalHarmony && !p.harmonyGrid?.measures?.length) p.harmonyGrid = globalHarmony;
  });
  return generated;
}
