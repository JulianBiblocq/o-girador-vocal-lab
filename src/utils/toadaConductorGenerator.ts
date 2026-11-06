/**
 * toadaConductorGenerator.ts
 * Frise Conducteur canonique : 1 carte Organizador = 1 VocalPatternItem avec superposition Tutti/Ensemble (< 80 lignes).
 */
import type { ToadaProject } from '../types/toadaProject.types';
import type { ParsedToadaSheetResult } from '../types/toadaDocument.types';
import { DEFAULT_TOADA_BPM } from '../types/toadaProject.types';
import { detectToadaLexicon } from './toadaLexiconDetector';
import { generateQuizFromLexicon } from './toadaQuizGenerator';
import {
  extractCleanFirstWord,
  buildPatternNameFromFirstWord,
  buildPatternsAndSlotsFromSegments,
} from './sheetSlotBuilder';

export { extractCleanFirstWord, buildPatternNameFromFirstWord };

export interface ToadaSheetGenOptions {
  bpm?: number;
  defaultMeasuresCount?: 1 | 2 | 3 | 4;
  defaultHasAnacrusis?: boolean;
}

export function generateToadaFromSheet(project: ToadaProject, parsed: ParsedToadaSheetResult, options?: ToadaSheetGenOptions): ToadaProject {
  const targetBpm = options?.bpm ?? parsed.docMeta?.bpmDefaut ?? project.bpm ?? DEFAULT_TOADA_BPM;
  const { patterns: newPatterns, slots: newSlots } = buildPatternsAndSlotsFromSegments(
    parsed.segments,
    targetBpm,
    options?.defaultHasAnacrusis ?? false
  );

  const globalHarmony = parsed.docMeta?.globalHarmonyGrid || parsed.docMeta?.harmonyGrid || project.globalHarmonyGrid;
  const generated: ToadaProject = {
    ...project,
    source: 'organizador',
    title: parsed.docMeta?.titre || project.title,
    bpm: targetBpm,
    timeSignature: (parsed.docMeta?.signature as any) || project.timeSignature,
    patterns: newPatterns.length > 0 ? newPatterns : project.patterns,
    slots: newSlots.length > 0 ? newSlots : project.slots,
    activePatternId: newPatterns[0]?.id || project.activePatternId,
    toadaMeta: parsed.docMeta ? { ...project.toadaMeta, ...parsed.docMeta, bpmDefaut: targetBpm } : project.toadaMeta,
    sheetLines: parsed.segments.map((s) => ({
      role: s.role,
      text: s.text,
      phoneticText: s.phoneticText,
      cardIndex: s.cardIndex,
      rawLineCode: s.rawLineCode,
    })),
    globalHarmonyGrid: globalHarmony,
  };

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
