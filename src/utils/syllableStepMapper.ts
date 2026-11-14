/**
 * syllableStepMapper.ts — Utilitaires purs d'assignation et reconstruction syllabique sur pas MIDI v2 (< 65 lignes).
 */
import type { VocalStepData } from '../types/vocalPack.types';
import { splitTextIntoLetraSyllables } from './syllableSplitter';
import { mergeSyllablesToImpulseCount } from './syllableImpulseMerger';

export function mapSyllablesToSteps(steps: VocalStepData[], syllables: string[]): VocalStepData[] {
  let syllIdx = 0;
  return steps.map((st) => {
    if (!st.active || st.note === '───' || st.isTie) return { ...st, syllable: '' };
    if (st.isMelisma || st.syllable?.trim() === '_') return { ...st, syllable: '_', isMelisma: true, syllableAttack: false };
    return { ...st, syllable: syllables[syllIdx++] ?? '', isMelisma: false, syllableAttack: true };
  });
}

export function assignSyllablesStrictlyToExistingBricks(steps: VocalStepData[], lyricsText: string): VocalStepData[] {
  const rawSyllables = splitTextIntoLetraSyllables(lyricsText || '').filter((s) => s.trim() !== '_');
  const attackIndices = steps
    .map((st, idx) => (st.active && st.note !== '───' && !st.isTie && !st.isMelisma && st.syllable?.trim() !== '_' ? idx : -1))
    .filter((idx) => idx !== -1);
  if (attackIndices.length === 0) return steps;
  const syllables = rawSyllables.length > attackIndices.length ? mergeSyllablesToImpulseCount(rawSyllables, attackIndices.length) : rawSyllables;
  const result = steps.map((st) => (st.isMelisma || st.syllable?.trim() === '_' ? { ...st, syllable: '_', isMelisma: true, syllableAttack: false } : { ...st, syllable: '' }));
  for (let k = 0; k < attackIndices.length; k++) {
    result[attackIndices[k]] = { ...result[attackIndices[k]], syllable: syllables[k] ?? '', isMelisma: false, syllableAttack: true };
  }
  return result;
}

export function reconstructWordsFromSteps(steps: VocalStepData[]): string {
  const parts: string[] = [];
  for (const st of steps) {
    if (!st.active || st.note === '───' || st.isTie || st.isMelisma || !st.syllable) continue;
    const raw = st.syllable, trimmed = raw.trim();
    if (!trimmed || trimmed === '_' || trimmed === '~' || trimmed === '-' || trimmed === '0' || trimmed === '𝄽' || trimmed === '───') continue;
    if (trimmed.endsWith('-')) parts.push(trimmed.slice(0, -1));
    else if (!raw.endsWith(' ') && /[aáàâãeéêèëiíïoóôõuúü]'[aáàâãeéêèëiíïoóôõuúü]/i.test(trimmed)) parts.push(`${trimmed} `);
    else parts.push(raw);
  }
  return parts.join('').replace(/\s+/g, ' ').trim();
}
