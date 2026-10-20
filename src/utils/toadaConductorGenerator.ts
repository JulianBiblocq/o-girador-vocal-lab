/**
 * toadaConductorGenerator.ts
 * Frise Conducteur automatique avec agrégation des mesures liées (/) et superposition mixte (< 115 lignes).
 */
import type { ToadaProject, VocalPatternItem, ToadaArrangementSlot } from '../types/toadaProject.types';
import type { ParsedToadaSheetResult } from '../types/toadaDocument.types';
import { createDefaultVocalPattern } from '../types/toadaProject.types';
import { createHarmonyGridFromChords } from './chordGridHelper';
import { detectToadaLexicon } from './toadaLexiconDetector';
import { generateQuizFromLexicon } from './toadaQuizGenerator';

export interface ToadaSheetGenOptions {
  bpm?: number;
  defaultMeasuresCount?: 1 | 2 | 3 | 4;
  defaultHasAnacrusis?: boolean;
}

export function extractCleanFirstWord(text: string): string {
  if (!text) return 'Phrase';
  const clean = text.replace(/<[^>]*>/g, '').trim();
  const match = clean.match(/^[\s"'«“„–—\-_([{\\/*]*([\p{L}\p{M}\d]+)/u);
  if (!match || !match[1]) return (clean.split(/\s+/)[0] || 'Phrase');
  return match[1].charAt(0).toUpperCase() + match[1].slice(1);
}

export function buildPatternNameFromFirstWord(text: string, existingNames: string[]): string {
  const base = extractCleanFirstWord(text);
  if (!existingNames.includes(base)) return base;
  let idx = 2;
  while (existingNames.includes(`${base} (${idx})`)) idx++;
  return `${base} (${idx})`;
}

export function generateToadaFromSheet(project: ToadaProject, parsed: ParsedToadaSheetResult, options?: ToadaSheetGenOptions): ToadaProject {
  const newPatterns: VocalPatternItem[] = [];
  const newSlots: ToadaArrangementSlot[] = [];
  const map = new Map<string, string>();
  const targetBpm = options?.bpm ?? parsed.docMeta?.bpmDefaut ?? project.bpm ?? 55;

  let i = 0;
  while (i < parsed.segments.length) {
    const seg = parsed.segments[i];
    const nextSeg = parsed.segments[i + 1];

    // Détection de mesure mixte tuilée (Puxador + Coro sur la même ligne)
    if (seg.isMixedPair && nextSeg && nextSeg.isMixedPair && seg.role !== nextSeg.role) {
      const puxSeg = seg.role === 'puxador' ? seg : nextSeg;
      const coroSeg = seg.role === 'coro' ? seg : nextSeg;

      const patPux = createDefaultVocalPattern('puxador', buildPatternNameFromFirstWord(puxSeg.text, newPatterns.map(p => p.name)), 1, targetBpm);
      patPux.assignedLyricsText = puxSeg.text;
      patPux.hasAnacrusis = puxSeg.hasAnacrusis ?? true;
      if (puxSeg.chords?.length) patPux.harmonyGrid = createHarmonyGridFromChords(puxSeg.chords, 1);
      newPatterns.push(patPux);

      const patCoro = createDefaultVocalPattern('coro', buildPatternNameFromFirstWord(coroSeg.text, newPatterns.map(p => p.name)), 1, targetBpm);
      patCoro.assignedLyricsText = coroSeg.text;
      patCoro.hasAnacrusis = false;
      if (coroSeg.chords?.length) patCoro.harmonyGrid = createHarmonyGridFromChords(coroSeg.chords, 1);
      newPatterns.push(patCoro);

      newSlots.push({ slotId: `slot-${newSlots.length + 1}`, puxadorPatternId: patPux.id, coroPatternId: patCoro.id });
      i += 2;
      continue;
    }

    // Agrégation automatique des mesures liées consécutives (/)
    let measuresCount: 1 | 2 | 3 | 4 = (seg.measuresCount ?? 1) as 1 | 2 | 3 | 4;
    let lookAhead = i + 1;
    while (lookAhead < parsed.segments.length && parsed.segments[lookAhead].isLinkedMeasure && measuresCount < 4) {
      measuresCount = (measuresCount + 1) as 1 | 2 | 3 | 4;
      lookAhead++;
    }

    const key = `${seg.role}:${seg.text.trim().toLowerCase()}`;
    let patId = map.get(key);
    if (!patId) {
      const patBpm = seg.sectionBpm ?? targetBpm;
      const patName = buildPatternNameFromFirstWord(seg.text, newPatterns.filter(p => p.role === seg.role).map(p => p.name));
      const pat = createDefaultVocalPattern(seg.role, patName, measuresCount, patBpm);
      pat.assignedLyricsText = seg.text;
      pat.hasAnacrusis = seg.hasAnacrusis ?? options?.defaultHasAnacrusis ?? true;
      if (seg.chords?.length) pat.harmonyGrid = createHarmonyGridFromChords(seg.chords, measuresCount);
      newPatterns.push(pat);
      patId = pat.id;
      map.set(key, patId);
    }

    newSlots.push({
      slotId: `slot-${newSlots.length + 1}`,
      puxadorPatternId: seg.role === 'puxador' ? patId : null,
      coroPatternId: seg.role === 'coro' ? patId : null
    });

    i = lookAhead;
  }

  const generated: ToadaProject = {
    ...project,
    title: parsed.docMeta?.titre || project.title,
    bpm: targetBpm,
    timeSignature: (parsed.docMeta?.signature as any) || project.timeSignature,
    patterns: newPatterns.length > 0 ? newPatterns : project.patterns,
    slots: newSlots.length > 0 ? newSlots : project.slots,
    activePatternId: newPatterns[0]?.id || project.activePatternId,
    toadaMeta: parsed.docMeta ? { ...project.toadaMeta, ...parsed.docMeta } : project.toadaMeta,
    sheetLines: parsed.segments.map((s) => ({ role: s.role, text: s.text, phoneticText: s.phoneticText }))
  };

  const detectedLex = detectToadaLexicon(generated);
  const quizItems = generateQuizFromLexicon(detectedLex);
  if (generated.toadaMeta) {
    generated.toadaMeta.notesLexique = detectedLex;
    generated.toadaMeta.questionsQcm = quizItems;
  }

  return generated;
}
