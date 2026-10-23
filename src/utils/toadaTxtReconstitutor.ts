/**
 * toadaTxtReconstitutor.ts
 * Reconstitution fidèle du format .txt depuis la Frise Conducteur (< 120 lignes).
 * Gère la soudure syllabique des pas MIDI, tenues ───, anacrouses (+), liaisons (/) et Puxador (*gras*).
 */
import type { ToadaProject, VocalPatternItem } from '../types/toadaProject.types';
import type { VocalStepData } from '../types/vocalPack.types';
import { formatMeasureChordsString } from './chordGridHelper';

export function stitchSyllablesFromSteps(steps: VocalStepData[] = []): string {
  const active = steps.filter((s) => s.active && s.syllable && s.syllable !== '───');
  if (active.length === 0) return '';

  let result = '';
  for (const s of active) {
    const syl = (s.syllable || '').trim();
    if (!syl || syl === '───') continue;
    if (syl.endsWith('-')) {
      result += syl.slice(0, -1);
    } else {
      result += syl + ' ';
    }
  }
  return result.trim().replace(/\s+/g, ' ');
}

export function extractPatternLyrics(pattern: VocalPatternItem): { text: string; hasAnacrusis: boolean } {
  const hasAnaSteps = Array.isArray(pattern.anacrusisSteps) && pattern.anacrusisSteps.some((s) => s.active && s.midiNumber > 0);
  const hasAnacrusis = Boolean(pattern.hasAnacrusis || hasAnaSteps);

  let text = '';
  const midiLyrics = stitchSyllablesFromSteps([...(pattern.anacrusisSteps || []), ...(pattern.mainSteps || [])]);
  if (midiLyrics.trim()) {
    text = midiLyrics;
  } else if (pattern.assignedLyricsText?.trim()) {
    text = pattern.assignedLyricsText.trim();
  } else {
    text = pattern.name || 'Mesure';
  }

  return { text, hasAnacrusis };
}

export function toadaToCleanHtml(rawTxtCode: string): string {
  if (!rawTxtCode || typeof rawTxtCode !== 'string') return '';
  const paras = rawTxtCode.split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(Boolean);
  const htmlParas: string[] = [];

  for (const p of paras) {
    const lines = p.split(/\r?\n/).map(l => {
      let clean = l
        .replace(/^\s*[+/]\s*/, '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(/(^|\s|\*)\+\s+/g, '$1')
        .trim();
      clean = clean.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
      return clean;
    }).filter(Boolean);
    if (lines.length > 0) {
      htmlParas.push(`<p>${lines.join('<br>')}</p>`);
    }
  }
  return htmlParas.join('\n');
}

export function reconstituteToadaTxt(project: ToadaProject): { rawTxtCode: string; cleanHtml: string } {
  const measuresBlocks: string[] = [];
  const patMap = new Map<string, VocalPatternItem>(project.patterns.map((p) => [p.id, p]));

  for (const slot of project.slots) {
    const patPux = slot.puxadorPatternId ? patMap.get(slot.puxadorPatternId) : null;
    const patCoro = slot.coroPatternId ? patMap.get(slot.coroPatternId) : null;

    if (patPux && patCoro) {
      // Mesure mixte tuilée
      const puxInfo = extractPatternLyrics(patPux);
      const coroInfo = extractPatternLyrics(patCoro);
      const puxAna = puxInfo.hasAnacrusis ? '+ ' : '';
      const coroAna = coroInfo.hasAnacrusis ? '+ ' : '';
      const puxChords = formatMeasureChordsString(patPux.harmonyGrid?.measures?.[0]);
      const coroChords = formatMeasureChordsString(patCoro.harmonyGrid?.measures?.[0]);
      const chordsPrefix = puxChords ? `${puxChords} ` : (coroChords ? `${coroChords} ` : '');
      measuresBlocks.push(`${puxAna}${chordsPrefix}*${puxInfo.text}* ${coroAna}${coroInfo.text}`.trim());
    } else {
      const activePat = patPux || patCoro;
      if (!activePat) continue;
      const { text, hasAnacrusis } = extractPatternLyrics(activePat);
      const prefix = hasAnacrusis ? '+ ' : '';
      const formattedText = activePat.role === 'puxador' ? `*${text}*` : text;
      const chordsStr = formatMeasureChordsString(activePat.harmonyGrid?.measures?.[0]);
      const chordsPrefix = chordsStr ? `${chordsStr} ` : '';

      measuresBlocks.push(`${prefix}${chordsPrefix}${formattedText}`);

      // Si le pattern s'étend sur plusieurs mesures, émettre les mesures liées (/)
      const mCount = activePat.measuresCount || 1;
      for (let m = 2; m <= mCount; m++) {
        const mChords = formatMeasureChordsString(activePat.harmonyGrid?.measures?.[m - 1]);
        const mChordsPrefix = mChords ? `${mChords} ` : '';
        measuresBlocks.push(`${mChordsPrefix}/ (suite ${activePat.name})`);
      }
    }
  }

  const rawTxtCode = measuresBlocks.join('\n\n');
  const cleanHtml = toadaToCleanHtml(rawTxtCode);
  return { rawTxtCode, cleanHtml };
}
