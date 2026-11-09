/**
 * vocalPaperToProjectConverter.ts
 * Conversion d'un résultat de lecture optique multi-photos (VocalPaperBatchScanResult) en ToadaProject (< 135 lignes).
 * Gère le clavier 1 octave (La -> Sol#), les traits horizontaux (durationSteps), l'auto-détection Ana T3-T4 / +T1 et l'Unisson Pux/Cor.
 */
import type {
  VocalPaperBatchScanResult, ScannedVocalPatternBlock, ScannedVocalStepCell, VocalPaperImportTargetConfig,
} from '../../types/vocalPaperWorkshop.types';
import {
  type ToadaProject, type VocalPatternItem, type ToadaArrangementSlot, type VocalRole, createDefaultVocalPattern,
} from '../../types/toadaProject.types';
import type { VocalStepData } from '../../types/vocalPack.types';
import { buildOrganizadorLineFromSteps } from '../stepsToOrganizadorLineBuilder';
import { extractTimeAnchors } from '../timeAnchorParser';
import { applyDualScaleToProject, computeSemitoneDistance } from '../scaleTranspositionHelper';
import { parseStoredScaleString } from '../../audio/projectScaleAnalyzer';
import { alignScannedPatternsWithOrganizadorLyrics } from './vocalPaperLyricsAligner';

const SEMITONE_FROM_A3: Record<string, number> = {
  A: 0, LA: 0, BB: 1, 'A#': 1, SIB: 1, 'SI♭': 1, 'LA#': 1, B: 2, SI: 2,
  C: 3, DO: 3, DÓ: 3, 'C#': 4, DB: 4, 'DO#': 4, 'DÓ#': 4, D: 5, RE: 5, RÉ: 5,
  EB: 6, 'D#': 6, MIB: 6, 'MI♭': 6, 'RE#': 6, 'RÉ#': 6, E: 7, MI: 7,
  F: 8, FA: 8, FÁ: 8, 'F#': 9, GB: 9, 'FA#': 9, 'FÁ#': 9, G: 10, SOL: 10, 'G#': 11, AB: 11, 'SOL#': 11, LAB: 11,
};
const MIDI_NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function keyboardNoteToMidi(pitchKey?: string, octaveShift = 0, baseA3Midi = 57): number {
  if (!pitchKey) return 60;
  const offset = SEMITONE_FROM_A3[pitchKey.trim().toUpperCase()] ?? 3;
  return Math.max(36, Math.min(84, baseA3Midi + offset + (octaveShift || 0) * 12));
}

export function midiToScientificNote(midi: number): string {
  const safe = Math.round(Math.max(24, Math.min(96, midi)));
  return `${MIDI_NOTE_NAMES[safe % 12]}${Math.floor(safe / 12) - 1}`;
}

export function hasActiveScannedCells(cells?: ScannedVocalStepCell[]): boolean {
  return Array.isArray(cells) && cells.some((c) => {
    const s = (c?.syllable || '').trim();
    return Boolean(c && (c.isTie || (c.pitchKey && String(c.pitchKey).trim()) || (c.durationSteps && c.durationSteps > 0) || (s && s !== '_')));
  });
}

function formatSylCase(raw: string, isFirst: boolean): string {
  const trimmed = raw.trim().replace(/-+$/, '').replace(/[’‘]/g, "'");
  if (!trimmed) return '';
  const base = trimmed === trimmed.toUpperCase() && trimmed !== trimmed.toLowerCase() ? trimmed.toLowerCase() : trimmed;
  return isFirst ? base.charAt(0).toUpperCase() + base.slice(1) : base;
}

export function buildStepsAndLyricsFromScannedBlock(
  block: ScannedVocalPatternBlock, baseA3Midi = 57
): { anacrusisSteps: VocalStepData[]; mainSteps: VocalStepData[]; assignedLyricsText: string; hasAnacrusis: boolean; hasTailBeat: boolean } {
  let isFirstSyl = true, lastMidi = 60, lyricsAcc = '';
  const hasAnacrusis = hasActiveScannedCells(block.anacrusisCells), hasTailBeat = hasActiveScannedCells(block.tailCells);
  const buildArray = (cells: ScannedVocalStepCell[] = [], totalSteps: number): VocalStepData[] => {
    const map = new Map<number, ScannedVocalStepCell>();
    for (const c of cells) if (c && typeof c.stepIndex === 'number') map.set(c.stepIndex, c);
    for (const c of cells) if (c && typeof c.stepIndex === 'number' && c.durationSteps && c.durationSteps > 1) {
      for (let k = 1; k < c.durationSteps; k++) if (c.stepIndex + k < totalSteps && !map.has(c.stepIndex + k)) map.set(c.stepIndex + k, { stepIndex: c.stepIndex + k, isTie: true, syllable: '───' });
    }
    return Array.from({ length: totalSteps }, (_, idx) => {
      const cell = map.get(idx), rawSyl = (cell?.syllable || '').trim(), isTie = Boolean(cell?.isTie || rawSyl === '───' || rawSyl === '---' || rawSyl === '───►');
      if (!isTie && !rawSyl && !cell?.pitchKey) return { stepIndex: idx, active: false, note: 'C4', midiNumber: 60, velocity: 0, decay: 0 };
      if (isTie) return { stepIndex: idx, active: true, isTie: true, note: '───', midiNumber: lastMidi, syllable: '───', velocity: 82, decay: 100 };
      const octShift = typeof cell?.octaveShift === 'number' ? cell.octaveShift : typeof cell?.octave === 'number' ? cell.octave - 4 : 0;
      const midi = block.rhythmOnlyMode ? 60 : keyboardNoteToMidi(cell?.pitchKey, octShift, baseA3Midi); lastMidi = midi;
      const joinsNext = rawSyl.endsWith('-'), cleanSyl = formatSylCase(rawSyl, isFirstSyl);
      if (cleanSyl) { isFirstSyl = false; lyricsAcc += joinsNext ? cleanSyl : `${cleanSyl} `; }
      return { stepIndex: idx, active: true, isTie: false, note: midiToScientificNote(midi), midiNumber: midi, syllable: cleanSyl || 'la', syllableAttack: true, tripletSlot: cell?.isTriplet ? 1 : undefined, velocity: 92, decay: 100 };
    });
  };
  const anacrusisSteps = hasAnacrusis ? buildArray(block.anacrusisCells, 8) : [], mainCount = Math.max(1, block.measuresCount) * 16;
  const baseMain = buildArray(block.mainCells, mainCount), tailSteps = hasTailBeat ? buildArray(block.tailCells, 4).map((s, i) => ({ ...s, stepIndex: mainCount + i })) : [];
  return { anacrusisSteps, mainSteps: [...baseMain, ...tailSteps], assignedLyricsText: block.officialLyricsText?.trim() || lyricsAcc.trim().replace(/\s{2,}/g, ' '), hasAnacrusis, hasTailBeat };
}

export function convertVocalPaperScanToProject(
  currentProject: ToadaProject, scanResult: VocalPaperBatchScanResult, targetConfig?: Partial<VocalPaperImportTargetConfig>, organizadorDoc?: any
): ToadaProject {
  const bpm = Number(targetConfig?.bpm || scanResult.bpm || currentProject.bpm || 88);
  const timeSignature = targetConfig?.timeSignature || scanResult.timeSignature || currentProject.timeSignature || '4/4';
  const title = (targetConfig?.title || scanResult.title || currentProject.title || 'Toada Manuscrit').trim(), refDoc = organizadorDoc || currentProject.toadaMeta;
  const alignedPatterns = refDoc ? alignScannedPatternsWithOrganizadorLyrics(scanResult.patterns, refDoc) : scanResult.patterns;
  const blockMap = new Map<string, { block: ScannedVocalPatternBlock; cardIdx: number }>();
  alignedPatterns.forEach((b, idx) => blockMap.set(b.code.trim().toUpperCase(), { block: b, cardIdx: idx }));

  const createdPatterns: VocalPatternItem[] = [], roleInstanceMap = new Map<string, VocalPatternItem>();
  const getOrCreatePattern = (code: string, role: VocalRole, isTutti = false): VocalPatternItem | null => {
    const normCode = code.trim().toUpperCase(), key = `${normCode}_${role}`;
    if (roleInstanceMap.has(key)) return roleInstanceMap.get(key)!;
    const entry = blockMap.get(normCode); if (!entry) return null;
    const { block, cardIdx } = entry, { anacrusisSteps, mainSteps, assignedLyricsText, hasAnacrusis, hasTailBeat } = buildStepsAndLyricsFromScannedBlock(block);
    const pat = createDefaultVocalPattern(role, block.name || `${normCode} (${role === 'puxador' ? 'Pux' : 'Cor'})`, block.measuresCount, bpm, 'C4');
    Object.assign(pat, {
      cardIndex: cardIdx, hasAnacrusis, anacrusisBeats: hasAnacrusis ? 2 : 0, hasTailBeat, exitBeat: hasTailBeat ? 1 : undefined,
      foldNotesView: block.rhythmOnlyMode, anacrusisSteps, mainSteps, assignedLyricsText: assignedLyricsText || block.name || normCode,
      isMidiInitialized: true, midiLocked: true, stepStatus: { recorded: false, trimmed: false, rhythmValidated: true, notesValidated: !block.rhythmOnlyMode, variantsReady: false },
    });
    pat.rawLineCode = buildOrganizadorLineFromSteps(pat, { isTutti });
    pat.timeAnchors = extractTimeAnchors(pat.rawLineCode.replace(/^\*+|\*+$/g, ''), 4, !hasAnacrusis).timeAnchors;
    createdPatterns.push(pat); roleInstanceMap.set(key, pat); return pat;
  };

  const slots: ToadaArrangementSlot[] = [], normSeq = (c?: string | null) => (!c || ['X', '-', '—', '_'].includes(c.trim().toUpperCase()) ? null : c.trim().toUpperCase());
  if (scanResult.sequenceColumns.length > 0) {
    scanResult.sequenceColumns.forEach((col, i) => {
      const pCode = normSeq(col.puxCode), cCode = normSeq(col.corCode);
      if (!pCode && !cCode) {
        const prev = slots[slots.length - 1];
        if (prev && !prev.puxadorPatternId && !prev.coroPatternId) prev.advanceMeasures = (prev.advanceMeasures || 1) + 1;
        else slots.push({ slotId: `slot-pause-${i + 1}`, puxadorPatternId: null, coroPatternId: null, advanceMeasures: 1 });
        return;
      }
      const isUnison = Boolean(pCode && cCode && pCode === cCode), puxPat = pCode ? getOrCreatePattern(pCode, 'puxador', isUnison) : null, corPat = cCode ? getOrCreatePattern(cCode, 'coro', isUnison) : null;
      if (isUnison && puxPat && corPat) corPat.linkedSourcePatternId = puxPat.id;
      slots.push({ slotId: `slot-seq-${i + 1}`, puxadorPatternId: puxPat?.id || null, coroPatternId: corPat?.id || null, advanceMeasures: Math.max(puxPat?.measuresCount || 1, corPat?.measuresCount || 1) });
    });
  } else alignedPatterns.forEach((b, idx) => { const pat = getOrCreatePattern(b.code, 'puxador', false); if (pat) slots.push({ slotId: `slot-auto-${idx + 1}`, puxadorPatternId: pat.id, coroPatternId: null, advanceMeasures: pat.measuresCount }); });
  const nextProj: ToadaProject = {
    ...currentProject, title, bpm, timeSignature, patterns: createdPatterns.length > 0 ? createdPatterns : currentProject.patterns,
    slots: slots.length > 0 ? slots : currentProject.slots, activePatternId: createdPatterns[0]?.id || currentProject.activePatternId,
    sequenciadorExportMode: alignedPatterns.some((p) => !p.rhythmOnlyMode) ? 'full_notes' : 'rhythm_only',
  };
  const parsedSung = parseStoredScaleString(targetConfig?.sungKey || scanResult.sungKey) || { tonic: currentProject.sungScaleRoot || 'C', scaleType: (targetConfig?.scaleMode || scanResult.scaleMode || 'major') as any };
  const parsedTroupe = parseStoredScaleString(targetConfig?.troupeKey || scanResult.troupeKey), shiftSt = parsedTroupe ? computeSemitoneDistance(parsedSung.tonic, parsedTroupe.tonic) : (currentProject.transpositionSemitones || 0);
  return applyDualScaleToProject(nextProj, parsedSung.tonic, parsedSung.scaleType, shiftSt, 'C4', 'fr');
}
