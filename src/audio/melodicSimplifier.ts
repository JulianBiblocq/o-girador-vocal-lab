/**
 * melodicSimplifier.ts
 * Algorithme pur de « Mélodie Simplifiée / Carrée » pour la Roda de Sequenciador (< 120 lignes) :
 * 1. Filtrage des micro-broderies d'1 pas (glitch d'attaque ou portamento <= 2 demi-tons)
 * 2. 1 Syllabe / 1 Ancre = 1 Note franche tenue (note MIDI médiane dominante + liaisons '───')
 * 3. Préservation stricte des temps muets initiaux (isInitialRest) et des silences.
 */
import type { VocalStepData } from '../types/vocalPack.types';
import type { TimeAnchor } from '../types/toadaDocument.types';
import { midiToNoteName } from '../utils/noteUtils';

function computeDominantMedianMidi(midis: number[]): number {
  if (midis.length === 0) return 60;
  const counts = new Map<number, number>();
  for (const m of midis) counts.set(m, (counts.get(m) ?? 0) + 1);
  let bestMidi = midis[0], bestCount = -1;
  const sorted = [...midis].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  for (const [m, c] of counts.entries()) {
    if (c > bestCount || (c === bestCount && Math.abs(m - median) < Math.abs(bestMidi - median))) {
      bestMidi = m;
      bestCount = c;
    }
  }
  return bestMidi;
}

export function simplifyStepsToMainMelody(
  steps: VocalStepData[],
  timeAnchors?: TimeAnchor[],
  subdivisionsPerBeat = 4,
  beatsPerMeasure = 4,
  hasAnacrusis = false
): VocalStepData[] {
  if (!steps || steps.length === 0) return [];
  const subdiv = Math.max(1, subdivisionsPerBeat);
  const m1StartStep = hasAnacrusis ? beatsPerMeasure * subdiv : 0;

  // 1. Repérage des pas forcés au silence par isInitialRest
  const forcedSilentSteps = new Set<number>();
  const anchorStartSteps = new Set<number>();
  const sustainedHoldBeats = new Set<number>();

  if (timeAnchors && timeAnchors.length > 0) {
    let measureOffset = 0, prevBeat = 0;
    for (const a of timeAnchors) {
      if (a.beat < prevBeat && prevBeat > 0) measureOffset += beatsPerMeasure;
      prevBeat = a.beat;
      const absBeatIdx = (typeof a.measureOffset === 'number' ? a.measureOffset * beatsPerMeasure : measureOffset) + (a.beat - 1);
      const stepStart = m1StartStep + Math.round(absBeatIdx * subdiv);
      if (a.isInitialRest) {
        for (let s = 0; s < subdiv; s++) forcedSilentSteps.add(stepStart + s);
      } else if (a.isSustainedHold) {
        sustainedHoldBeats.add(stepStart);
      } else if (!a.isRest) {
        anchorStartSteps.add(stepStart);
      }
    }
  }

  // 2. Copie de travail + purge des pas muets + filtrage des micro-broderies d'1 pas
  const cleaned: VocalStepData[] = steps.map((st, idx) => {
    if (forcedSilentSteps.has(idx) || !st.active || !st.midiNumber || st.midiNumber <= 0) {
      return { ...st, active: false, midiNumber: 0, note: '', syllable: '', isTie: false, velocity: 0 };
    }
    return { ...st };
  });

  for (let i = 1; i < cleaned.length - 1; i++) {
    const prev = cleaned[i - 1], cur = cleaned[i], next = cleaned[i + 1];
    if (!cur.active || !prev.active || !next.active) continue;
    const hasOwnSyl = Boolean(cur.syllable && cur.syllable.trim() && cur.syllable !== '───');
    if (!hasOwnSyl && prev.midiNumber === next.midiNumber && Math.abs(cur.midiNumber - prev.midiNumber) <= 2) {
      cur.midiNumber = prev.midiNumber;
    } else if (!hasOwnSyl && Math.abs(cur.midiNumber - next.midiNumber) === 1 && prev.midiNumber !== cur.midiNumber) {
      cur.midiNumber = next.midiNumber;
    }
  }

  // 3. Regroupement en notes franches tenues (1 Syllabe / 1 Ancre / Saut franc >= 2 demi-tons sur >= 2 pas)
  const result = cleaned.map((st) => ({ ...st }));
  let i = 0;
  while (i < result.length) {
    if (!result[i].active || result[i].midiNumber <= 0) { i++; continue; }
    const groupStart = i;
    const rootSyl = (result[i].syllable && result[i].syllable !== '───') ? result[i].syllable : '';
    let groupEnd = i;

    while (groupEnd + 1 < result.length) {
      const nextIdx = groupEnd + 1;
      const nextStep = result[nextIdx];
      if (!nextStep.active || nextStep.midiNumber <= 0) break;

      const nextHasSyl = Boolean(nextStep.syllable && nextStep.syllable.trim() && nextStep.syllable !== '───');
      if (nextHasSyl) break;
      if (anchorStartSteps.has(nextIdx) && !sustainedHoldBeats.has(nextIdx)) break;

      // S'il n'y a pas de syllabe explicite mais un changement franc de hauteur (>= 2 demi-tons) tenu sur >= 2 pas
      const pitchDiff = Math.abs(nextStep.midiNumber - result[groupStart].midiNumber);
      const afterNext = result[nextIdx + 1];
      const isSustainedJump = !rootSyl && !sustainedHoldBeats.has(nextIdx) && pitchDiff >= 2 &&
        Boolean(afterNext?.active && Math.abs(afterNext.midiNumber - nextStep.midiNumber) <= 1);
      if (isSustainedJump) break;

      groupEnd = nextIdx;
    }

    const midis: number[] = [];
    for (let k = groupStart; k <= groupEnd; k++) midis.push(result[k].midiNumber);
    const dominantMidi = computeDominantMedianMidi(midis);
    const noteName = midiToNoteName(dominantMidi);

    result[groupStart] = {
      ...result[groupStart],
      active: true, midiNumber: dominantMidi, note: noteName,
      isTie: false, syllable: rootSyl, syllableAttack: true, velocity: 100,
    };
    for (let k = groupStart + 1; k <= groupEnd; k++) {
      result[k] = {
        ...result[k],
        active: true, midiNumber: dominantMidi, note: '───',
        isTie: true, syllable: '', syllableAttack: false, velocity: 90,
      };
    }
    i = groupEnd + 1;
  }

  return result;
}
