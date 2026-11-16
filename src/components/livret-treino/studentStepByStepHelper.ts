/**
 * studentStepByStepHelper.ts
 * Extraction ordonnée syllabe par syllabe (et mélismes `_`) dans la tonalité Troupe (troupeKey)
 * + détection de micro-relâchement / ré-impulsion entre 2 syllabes consécutives de même hauteur (< 95 lignes).
 */
import type { VocalPatternItem } from '../../types/toadaProject.types';
import { formatPaperNoteCode, formatSolfegeNoteWithOctave } from '../../audio/forcedMelodyAligner';
import type { SlowNoteTick } from '../../audio/slowNoteDetectorEngine';

export interface StudentSyllableStepTarget {
  index: number;
  stepIndex: number;
  syllable: string;
  isMelisma: boolean;
  targetMidi: number;
  pitchClass: number;
  paperCode: string;
  solfegeLabel: string;
  requiresReImpulseFromPrev: boolean;
}

export function buildStudentStepByStepTargets(
  pattern: VocalPatternItem,
  transpositionSemitones = 0,
  lang: 'fr' | 'br' = 'fr'
): StudentSyllableStepTarget[] {
  const hasAnac = pattern.hasAnacrusis !== false;
  const rawSteps = [
    ...(hasAnac ? (pattern.anacrusisSteps || []) : []),
    ...(pattern.pack?.grid.steps ?? pattern.mainSteps ?? []),
  ];

  const targets: StudentSyllableStepTarget[] = [];
  for (let i = 0; i < rawSteps.length; i++) {
    const s = rawSteps[i];
    if (!s || s.tripletSlot === 'unused' || !s.active) continue;
    const rawMidi = s.midiNumber ?? 0;
    if (rawMidi <= 0) continue;

    const rawSyl = (s.syllable || '').trim();
    const isTieMarker = Boolean(s.isTie || s.note === '───');
    const hasExplicitNewSyl = rawSyl.length > 0 && rawSyl !== '───';
    if (isTieMarker && !hasExplicitNewSyl && !s.syllableAttack && !s.isMelisma) continue;

    const isMelisma = Boolean(s.isMelisma || rawSyl === '_');
    const targetMidi = Math.max(24, Math.min(108, Math.round(rawMidi + transpositionSemitones)));
    const pitchClass = ((targetMidi % 12) + 12) % 12;
    const prev = targets.length > 0 ? targets[targets.length - 1] : null;
    const requiresReImpulseFromPrev = Boolean(prev && prev.pitchClass === pitchClass && !isMelisma);

    targets.push({
      index: targets.length,
      stepIndex: i,
      syllable: isMelisma ? '↷ (_)' : (rawSyl && rawSyl !== '───' ? rawSyl : '•'),
      isMelisma,
      targetMidi,
      pitchClass,
      paperCode: formatPaperNoteCode(targetMidi),
      solfegeLabel: formatSolfegeNoteWithOctave(targetMidi, lang),
      requiresReImpulseFromPrev,
    });
  }
  return targets;
}

export class SamePitchReImpulseGate {
  private armed = true;
  private prevRms = 0;
  private dipMs = 0;

  public prepareNextTarget(requiresReImpulse: boolean): void {
    this.armed = !requiresReImpulse;
    this.dipMs = 0;
  }

  public isArmed(): boolean {
    return this.armed;
  }

  public observeTick(tick: SlowNoteTick, dtMs = 16): boolean {
    if (this.armed) {
      this.prevRms = tick.rms;
      return true;
    }
    if (!tick.isVoiced || tick.rms < 0.016) {
      this.dipMs += dtMs;
      if (this.dipMs >= 32) this.armed = true;
    } else if (this.prevRms > 0.005 && tick.rms >= this.prevRms * 1.38) {
      this.armed = true;
    }
    this.prevRms = tick.rms;
    return this.armed;
  }
}
