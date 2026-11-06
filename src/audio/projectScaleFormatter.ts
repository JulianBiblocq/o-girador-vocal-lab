/**
 * projectScaleFormatter.ts
 * Formatage bilingue (FR / PT-BR) et résolution de la gamme active du projet (< 90 lignes).
 */
import type { ToadaProject } from '../types/toadaProject.types';
import { getTonicSemitone, type ScaleType } from './scaleQuantizer';

export const SOLFEGE_NOTE_NAMES = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'Sib', 'Si'];
export const SOLFEGE_NOTE_NAMES_BR = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Sib', 'Si'];

export function formatProjectScaleLabel(tonic: string, scaleType: ScaleType, lang: 'fr' | 'br' = 'fr'): string {
  if (scaleType === 'chromatic') return lang === 'br' ? 'Escala livre (Desativada)' : 'Mode libre (Chromatique)';
  const pc = getTonicSemitone(tonic);
  const names = lang === 'br' ? SOLFEGE_NOTE_NAMES_BR : SOLFEGE_NOTE_NAMES;
  const rootLbl = names[pc] || tonic;
  const modeMapFr: Partial<Record<ScaleType, string>> = {
    natural_minor: 'Mineur', minor: 'Mineur', major: 'Majeur',
    mixolydian: 'Mixolydien', dorian: 'Dorien', harmonic_minor: 'Mineur Harm.',
    pentatonic_minor: 'Pentatonique Min.', pentatonic_major: 'Pentatonique Maj.',
  };
  const modeMapBr: Partial<Record<ScaleType, string>> = {
    natural_minor: 'Menor', minor: 'Menor', major: 'Maior',
    mixolydian: 'Mixolídio', dorian: 'Dórico', harmonic_minor: 'Menor Harm.',
    pentatonic_minor: 'Pentatônica Men.', pentatonic_major: 'Pentatônica Mai.',
  };
  const map = lang === 'br' ? modeMapBr : modeMapFr;
  return `${rootLbl} ${map[scaleType] || (lang === 'br' ? 'Menor' : 'Mineur')}`;
}

export function formatReferencePitchSolfege(referencePitch: string, lang: 'fr' | 'br' = 'fr'): string {
  const m = (referencePitch || 'A3').match(/^([A-Ga-g][#b]?)(\d+)$/);
  const note = m ? m[1].toUpperCase() : 'A', oct = m ? m[2] : '3';
  const pc = getTonicSemitone(note);
  const names = lang === 'br' ? SOLFEGE_NOTE_NAMES_BR : SOLFEGE_NOTE_NAMES;
  return `${names[pc] || note}${oct}`;
}

export function parseStoredScaleString(raw?: string): { tonic: string; scaleType: ScaleType } | null {
  if (!raw || /^[A-G][#b]?\d$/i.test(raw.trim())) return null;
  const s = raw.trim().toLowerCase();
  if (s.includes('libre') || s.includes('chromati') || s.includes('desativad')) return { tonic: 'A', scaleType: 'chromatic' };
  const rootPairs: Array<[string, string]> = [
    ['do#', 'C#'], ['dó#', 'C#'], ['do', 'C'], ['dó', 'C'], ['ré#', 'D#'], ['re#', 'D#'], ['ré', 'D'], ['re', 'D'],
    ['mi', 'E'], ['fa#', 'F#'], ['fá#', 'F#'], ['fa', 'F'], ['fá', 'F'], ['sol#', 'G#'], ['sol', 'G'],
    ['la#', 'A#'], ['lá#', 'A#'], ['sib', 'A#'], ['la', 'A'], ['lá', 'A'], ['si', 'B'],
  ];
  let tonic = 'A';
  for (const [k, v] of rootPairs) { if (s.startsWith(k)) { tonic = v; break; } }
  let scaleType: ScaleType = 'natural_minor';
  if (s.includes('mixol')) scaleType = 'mixolydian';
  else if (s.includes('dori') || s.includes('dóri')) scaleType = 'dorian';
  else if (s.includes('penta') && (s.includes('maj') || s.includes('mai'))) scaleType = 'pentatonic_major';
  else if (s.includes('penta')) scaleType = 'pentatonic_minor';
  else if (s.includes('maj') || s.includes('maior')) scaleType = 'major';
  return { tonic, scaleType };
}

export function resolveProjectActiveScale(
  project: ToadaProject,
  lang: 'fr' | 'br' = 'fr',
  fallbackAnalysis?: { tonic: string; scaleType: ScaleType; analyzedPatternsCount: number; referencePitch: string }
): { tonic: string; scaleType: ScaleType; isLocked: boolean; label: string; referencePitch: string } {
  const parsed = parseStoredScaleString(project.toadaMeta?.tonaliteDefaut);
  const patRef = project.patterns.find((p) => p.referencePitch && p.referencePitch !== 'C4')?.referencePitch || 'A3';
  if (parsed) {
    return {
      tonic: parsed.tonic, scaleType: parsed.scaleType, isLocked: parsed.scaleType !== 'chromatic',
      label: formatProjectScaleLabel(parsed.tonic, parsed.scaleType, lang), referencePitch: patRef,
    };
  }
  const hasAnalysis = Boolean(fallbackAnalysis && fallbackAnalysis.analyzedPatternsCount > 0);
  const tonic = hasAnalysis ? fallbackAnalysis!.tonic : 'A';
  const scaleType: ScaleType = hasAnalysis ? fallbackAnalysis!.scaleType : 'natural_minor';
  return {
    tonic, scaleType, isLocked: hasAnalysis,
    label: formatProjectScaleLabel(tonic, scaleType, lang),
    referencePitch: hasAnalysis ? fallbackAnalysis!.referencePitch : patRef,
  };
}

