/**
 * stepsToOrganizadorLineBuilder.ts
 * Reconstruction v2 (`grammarVersion: 2`) d'une ligne rawTxtCode Organizador ([1]..[4], `0`, `_`, soudures intra-mots) (< 135 lignes).
 */
import type { VocalPatternItem } from '../types/toadaProject.types';
import type { VocalStepData } from '../types/vocalPack.types';
import { cleanLyricsForAlignment, underlineSingleSyllableFirstLetter } from './syllableUnderlineFormatter';

interface StepSyllableAttack { subdiv: number; rawSyl: string; cleanSyl: string; joinsNextWord: boolean; }
interface BeatGroup { beatNum: number; steps: VocalStepData[]; attacks: StepSyllableAttack[]; }

function isStepActiveAttack(step?: VocalStepData): boolean {
  if (!step || !step.active || step.isTie || step.isMelisma || step.note === '───') return false;
  const syl = (step.syllable || '').trim();
  return Boolean(syl && syl !== '───' && syl !== '_' && syl !== '0' && syl !== '𝄽');
}

function isStepSounding(step?: VocalStepData): boolean {
  return Boolean(step?.active && ((step.midiNumber ?? 0) > 0 || step.isTie || step.isMelisma || step.note === '───'));
}

function computeWordJoinFlags(attacks: StepSyllableAttack[], refText: string): void {
  const cleanRef = cleanLyricsForAlignment(refText);
  let cursor = 0;
  for (let i = 0; i < attacks.length; i++) {
    const att = attacks[i];
    if (att.rawSyl.endsWith('-')) att.joinsNextWord = true;
    const letters = Array.from(att.cleanSyl).filter((c) => /[\p{L}\p{N}]/u.test(c));
    while (cursor < cleanRef.length && !/[\p{L}\p{N}]/u.test(cleanRef[cursor])) cursor++;
    for (let k = 0; k < letters.length && cursor < cleanRef.length; k++) {
      while (cursor < cleanRef.length && !/[\p{L}\p{N}]/u.test(cleanRef[cursor])) cursor++;
      if (cursor < cleanRef.length) cursor++;
    }
    while (cursor < cleanRef.length && (cleanRef[cursor] === "'" || cleanRef[cursor] === '-')) cursor++;
    if (!att.rawSyl.endsWith('-')) {
      const isElision = /[aáàâãeéêèëiíïoóôõuúü]'[aáàâãeéêèëiíïoóôõuúü]/i.test(att.cleanSyl);
      att.joinsNextWord = !isElision && cursor < cleanRef.length && /[\p{L}\p{N}]/u.test(cleanRef[cursor]);
    }
  }
  if (attacks.length > 0) attacks[attacks.length - 1].joinsNextWord = false;
}

export function hasEditedMidiSyllables(pat: VocalPatternItem): boolean {
  return Boolean(pat.isMidiInitialized && [...(pat.anacrusisSteps || []), ...(pat.mainSteps || [])].some(isStepActiveAttack));
}

function extractLineDirectivesPrefix(rawLineCode?: string): string {
  if (!rawLineCode) return '';
  let rest = rawLineCode.trim(), prefix = '';
  for (let i = 0; i < 2; i++) {
    const m = rest.match(/^(\[(?:sig:[^\]]+|sim|nosim)\]\s*)/i);
    if (m) { prefix += m[1]; rest = rest.slice(m[0].length); }
  }
  return prefix;
}

export function buildOrganizadorLineFromSteps(
  pat: VocalPatternItem,
  options?: { isTutti?: boolean; withUnderline?: boolean; overrideRole?: 'puxador' | 'coro'; prefixSourceLine?: string }
): string {
  const isTutti = Boolean(options?.isTutti), withUnderline = Boolean(options?.withUnderline);
  const role = options?.overrideRole ?? pat.role, resolution = 4, beatsPerMeasure = 4;
  const beatGroups: BeatGroup[] = [], anaSteps = pat.hasAnacrusis !== false ? (pat.anacrusisSteps || []) : [];
  const anaBeatCount = Math.floor(anaSteps.length / resolution);
  let firstActiveAnaBeat = -1;
  for (let b = 0; b < anaBeatCount; b++) if (anaSteps.slice(b * resolution, (b + 1) * resolution).some(isStepActiveAttack)) { firstActiveAnaBeat = b; break; }
  if (firstActiveAnaBeat >= 0) {
    for (let b = firstActiveAnaBeat; b < anaBeatCount; b++) beatGroups.push({ beatNum: (beatsPerMeasure - anaBeatCount) + b + 1, steps: anaSteps.slice(b * resolution, (b + 1) * resolution), attacks: [] });
  }

  const mainSteps = pat.mainSteps || [], totalMainBeats = Math.max(1, pat.measuresCount || 1) * beatsPerMeasure;
  for (let bIdx = 0; bIdx < totalMainBeats; bIdx++) beatGroups.push({ beatNum: (bIdx % beatsPerMeasure) + 1, steps: mainSteps.slice(bIdx * resolution, (bIdx + 1) * resolution), attacks: [] });
  const tailSteps = mainSteps.slice(totalMainBeats * resolution, (totalMainBeats + 1) * resolution);
  if (tailSteps.some(isStepActiveAttack)) beatGroups.push({ beatNum: 1, steps: tailSteps, attacks: [] });

  const allAttacks: StepSyllableAttack[] = [];
  for (const bg of beatGroups) {
    for (let s = 0; s < bg.steps.length; s++) {
      if (isStepActiveAttack(bg.steps[s])) {
        const rawSyl = bg.steps[s].syllable!.trim(), cleanSyl = rawSyl.replace(/-+$/, '').trim();
        const att: StepSyllableAttack = { subdiv: s, rawSyl, cleanSyl, joinsNextWord: false };
        bg.attacks.push(att); allAttacks.push(att);
      }
    }
  }
  computeWordJoinFlags(allAttacks, pat.assignedLyricsText || pat.rawLineCode || '');

  let out = '', prevBeatEndedActive = false;
  for (let g = 0; g < beatGroups.length; g++) {
    const bg = beatGroups[g], nextBg = beatGroups[g + 1], hasSound = bg.steps.some(isStepSounding);
    if (bg.attacks.length === 0) {
      out = hasSound ? `${prevBeatEndedActive ? out.trimEnd() : out}[${bg.beatNum}]_ ` : `${out}[${bg.beatNum}]0 `;
      prevBeatEndedActive = isStepSounding(bg.steps[bg.steps.length - 1]);
      continue;
    }
    out += bg.attacks[0].subdiv === 0 ? `[${bg.beatNum}]` : `[${bg.beatNum}]${isStepSounding(bg.steps[0]) ? '_' : '0'} `;
    for (let i = 0; i < bg.attacks.length; i++) {
      const att = bg.attacks[i], nextInBeat = bg.attacks[i + 1];
      out += withUnderline ? underlineSingleSyllableFirstLetter(att.cleanSyl) : att.cleanSyl;
      if (nextInBeat) {
        const needsGap = (att.subdiv === 0 && nextInBeat.subdiv === 3) || (bg.attacks.length === 3 && nextInBeat.subdiv - att.subdiv >= 2);
        if (needsGap) out += isStepSounding(bg.steps[att.subdiv + 1]) ? ' _ ' : ' 0 ';
        else if (!att.joinsNextWord) out += ' ';
      } else {
        const nextIsHoldBeat = Boolean(nextBg && nextBg.attacks.length === 0 && nextBg.steps.some(isStepSounding));
        const weldsToNext = nextIsHoldBeat || (att.joinsNextWord && Boolean(nextBg && nextBg.attacks.length > 0 && nextBg.attacks[0].subdiv === 0));
        if (!weldsToNext && g < beatGroups.length - 1) out += ' ';
      }
    }
    prevBeatEndedActive = isStepSounding(bg.steps[bg.steps.length - 1]);
  }

  const core = out.trim().replace(/\s{2,}/g, ' '), prefix = extractLineDirectivesPrefix(options?.prefixSourceLine ?? pat.rawLineCode);
  return isTutti ? `${prefix}***${core}***` : (role === 'puxador' ? `${prefix}*${core}*` : `${prefix}${core}`);
}

export function resolvePatternOrTwinOrganizadorLine(pat: VocalPatternItem, allPatterns: VocalPatternItem[], options?: { isTutti?: boolean; withUnderline?: boolean }): string | null {
  if (hasEditedMidiSyllables(pat)) return buildOrganizadorLineFromSteps(pat, options);
  const patNorm = cleanLyricsForAlignment(pat.assignedLyricsText || pat.rawLineCode || '').toLowerCase();
  if (!patNorm) return null;
  const twin = allPatterns.find((p) => p.id !== pat.id && p.role === pat.role && p.measuresCount === pat.measuresCount && hasEditedMidiSyllables(p) && cleanLyricsForAlignment(p.assignedLyricsText || p.rawLineCode || '').toLowerCase() === patNorm)
    ?? allPatterns.find((p) => p.id !== pat.id && p.measuresCount === pat.measuresCount && hasEditedMidiSyllables(p) && cleanLyricsForAlignment(p.assignedLyricsText || p.rawLineCode || '').toLowerCase() === patNorm);
  return twin ? buildOrganizadorLineFromSteps(twin, { ...options, overrideRole: pat.role, prefixSourceLine: pat.rawLineCode }) : null;
}
