/**
 * toadaGameContextExtractor.ts
 * Extraction dynamique du contexte musical de la Toada active pour les Jeux de Voix :
 * BPM, tonalité Troupe (troupeKey), diapason referencePitchHz, notes cibles réelles, voyelles longues et record d'endurance (< 90 lignes).
 */
import { DEFAULT_TOADA_BPM, type ToadaProject, type VocalPatternItem } from '../types/toadaProject.types';
import { resolveProjectDualScale } from '../utils/scaleTranspositionHelper';
import { sanitizePitchHz } from '../utils/pitchHzContract';
import { resolveTonicDroneMidi } from './tonicDroneSynth';

export const ENDURANCE_BEST_STORAGE_KEY = 'vocal_lab_endurance_best_sec_v1';
export const FALLBACK_CALL_SYLLABLES = ['Ô !', 'Ê !', 'Nagô !'] as const;

export interface ToadaVocalGameContext {
  bpm: number;
  troupeKeyRoot: string;
  transpositionSemitones: number;
  referencePitchHz: number;
  attackNote: number;
  attackSyl: string;
  holdNote: number;
  holdSyl: string;
  secondNote: number;
  longVowels: string[];
  hasToadaNotes: boolean;
}

export function extractToadaVocalGameContext(
  project?: ToadaProject | null,
  activePattern?: VocalPatternItem | null,
  fallbackComfortMidi?: number
): ToadaVocalGameContext {
  const pat = activePattern ?? project?.patterns?.[0] ?? null;
  const bpm = Math.max(30, Math.round(pat?.bpm ?? pat?.baseBpm ?? project?.bpm ?? DEFAULT_TOADA_BPM));
  const dual = project ? resolveProjectDualScale(project, 'fr') : null;
  const troupeKeyRoot = dual?.troupeScaleRoot || 'C';
  const shiftSt = dual?.transpositionSemitones ?? 0;
  const referencePitchHz = sanitizePitchHz(project?.referencePitchHz);

  const collectGroups = (p: VocalPatternItem | null) => {
    if (!p) return [];
    const raw = [...(p.hasAnacrusis !== false ? (p.anacrusisSteps || []) : []), ...(p.pack?.grid.steps ?? p.mainSteps ?? [])];
    const groups: Array<{ midi: number; syllable: string; len: number }> = [];
    for (let i = 0; i < raw.length; i++) {
      const s = raw[i], sMidi = s.midiNumber ?? 0;
      if (!s.active || sMidi <= 0 || s.note === '───') continue;
      let ties = 0;
      while (i + 1 + ties < raw.length && raw[i + 1 + ties].note === '───') ties++;
      const transposed = Math.max(36, Math.min(84, Math.round(sMidi + shiftSt)));
      const syl = (s.syllable || '').trim();
      groups.push({ midi: transposed, syllable: syl === '_' ? '' : syl, len: 1 + ties });
      i += ties;
    }
    return groups;
  };

  let groups = collectGroups(pat);
  if (groups.length === 0 && project?.patterns?.length) {
    for (const candidate of project.patterns) {
      groups = collectGroups(candidate);
      if (groups.length > 0) break;
    }
  }

  const defaultMidi = fallbackComfortMidi && fallbackComfortMidi >= 36 ? fallbackComfortMidi : resolveTonicDroneMidi(troupeKeyRoot, 4);
  const attackNote = groups[0]?.midi ?? defaultMidi;
  const attackSyl = groups[0]?.syllable || FALLBACK_CALL_SYLLABLES[0];
  const sortedByHold = [...groups].sort((a, b) => b.len - a.len);
  const holdNote = sortedByHold[0]?.midi ?? attackNote;
  const holdSyl = sortedByHold[0]?.syllable || attackSyl;
  const secondNote = groups.find((g) => g.midi !== attackNote)?.midi ?? attackNote;
  const longVowels = Array.from(new Set([...sortedByHold.map((g) => g.syllable).filter((s) => s.length > 0 && s !== '───'), ...FALLBACK_CALL_SYLLABLES])).slice(0, 5);

  return { bpm, troupeKeyRoot, transpositionSemitones: shiftSt, referencePitchHz, attackNote, attackSyl, holdNote, holdSyl, secondNote, longVowels, hasToadaNotes: groups.length > 0 };
}

export function loadEnduranceBestSec(): number {
  try { const v = parseFloat(localStorage.getItem(ENDURANCE_BEST_STORAGE_KEY) || '0'); return Number.isFinite(v) && v > 0 ? Math.round(v * 10) / 10 : 0; } catch { return 0; }
}

export function saveEnduranceBestSec(sec: number): number {
  const prev = loadEnduranceBestSec(), next = Math.max(prev, Math.round(Math.max(0, sec) * 10) / 10);
  try { localStorage.setItem(ENDURANCE_BEST_STORAGE_KEY, String(next)); } catch {}
  return next;
}
