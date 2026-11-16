/**
 * vocalTab4EDecoder.ts
 * Décodage optique pur de la Feuille 5 ([CODE: CHANT-TAB-4E]) via vocalDurationWeldParser :
 * Décode les durées soudées par '/' (ex: '4/4', '1/4/3'), les silences '0', les notes (C, F#, A3) et les mélismes '_' (< 90 lignes).
 */
import type { ScannedVocalPatternBlock, ScannedVocalStepCell } from '../../types/vocalPaperWorkshop.types';
import { parseWeldedDurationTokens } from '../vocalDurationWeldParser';

const SOLFEGE_MAP: Record<string, string> = {
  DO: 'C', 'DÓ': 'C', RE: 'D', 'RÉ': 'D', MI: 'E', FA: 'F', 'FÁ': 'F', SOL: 'G', LA: 'A', 'LÁ': 'A', SI: 'B',
};

function parseTab4EPitchToken(raw?: string): { pitchKey: string; octaveShift: number } | null {
  const clean = String(raw || '').trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  if (!clean || clean === '0' || clean === '𝄽' || clean === '-' || clean === '—') return null;
  const m = clean.match(/^(Do|Dó|Re|Ré|Mi|Fa|Fá|Sol|La|Lá|Si|[A-Ga-g])([#b])?(-?\d)?$/i);
  if (!m) return null;
  const base = SOLFEGE_MAP[m[1].toUpperCase()] || m[1].toUpperCase();
  const acc = m[2] ? (m[2] === 'b' ? 'B' : '#') : '';
  const pitchKey = `${base}${acc}`;
  const explicitOct = m[3] !== undefined ? parseInt(m[3], 10) : 4;
  // Dans vocalPaperToProjectConverter, baseA3Midi = 57 : A, A#, B à octaveShift=0 sont en octave 3, C..G# sont en octave 4 !
  const isLowAtoB = base === 'A' || base === 'B';
  const octaveShift = isLowAtoB ? explicitOct - 3 : explicitOct - 4;
  return { pitchKey, octaveShift };
}

export function decodeChantTab4EBlock(block: ScannedVocalPatternBlock): ScannedVocalPatternBlock {
  const isTab4E = block.sheetCode === 'CHANT-TAB-4E' || Boolean(block.subdivisionLine || block.notesLine || block.syllablesLine);
  if (!isTab4E) return block;
  if (Array.isArray(block.cells) && block.cells.length > 0 && !block.subdivisionLine) return block;

  const durEvents = parseWeldedDurationTokens((block.subdivisionLine || '').replace(/\+/g, ' '), false);
  const noteTokens = String(block.notesLine || '').trim().split(/\s+/).filter(Boolean);
  const sylTokens = String(block.syllablesLine || '').trim().split(/\s+/).filter(Boolean);

  if (durEvents.length === 0) return block;

  const cells: ScannedVocalStepCell[] = [];
  let stepCursor = 0;
  let lastPitch: { pitchKey: string; octaveShift: number } | null = null;
  let hasAnyPitch = false;

  for (let i = 0; i < durEvents.length && stepCursor < 32; i++) {
    const dur = Math.max(1, Math.round(durEvents[i].totalSubdivisions));
    const rawNote = noteTokens[i] ?? '';
    const rawSyl = sylTokens[i] ?? '';
    const isRest = rawNote === '0' || rawNote === '𝄽' || rawSyl === '0' || rawSyl === '𝄽';

    if (!isRest) {
      const parsedPitch = parseTab4EPitchToken(rawNote);
      if (parsedPitch) { lastPitch = parsedPitch; hasAnyPitch = true; }
      const effPitch = parsedPitch || lastPitch;
      const isHoldOrMelisma = rawSyl === '_' || rawSyl === '───';
      const samePitchAsPrev = Boolean(isHoldOrMelisma && !parsedPitch);

      cells.push({
        stepIndex: stepCursor,
        durationSteps: dur,
        syllable: rawSyl || (effPitch ? 'LA' : ''),
        pitchKey: effPitch?.pitchKey,
        octaveShift: effPitch?.octaveShift ?? 0,
        isTie: samePitchAsPrev,
      });
    }
    stepCursor += dur;
  }

  return {
    ...block,
    rhythmOnlyMode: !hasAnyPitch && Boolean(block.rhythmOnlyMode),
    beatNumbers: block.beatNumbers || [1, 2, 3, 4, 1, 2, 3, 4],
    cells,
  };
}
