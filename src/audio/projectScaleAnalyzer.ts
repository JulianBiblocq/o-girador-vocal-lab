/**
 * projectScaleAnalyzer.ts
 * Analyse globale de la gamme et de la tonique sur l'ensemble des phrases enregistrées d'une Toada,
 * avec pondération des notes de résolution de fin de phrase et requantification (< 130 lignes).
 */
import type { ToadaProject, VocalPatternItem } from '../types/toadaProject.types';
import type { PitchCurvePoint } from '../types/vocalPack.types';
import { extractContinuousPitchCurve } from './pitchExtractor';
import {
  SCALE_DEFINITIONS, buildAllowedPitchClasses, estimateGlobalTuningOffset,
  applyScaleToSteps, getTonicSemitone, type ScaleType,
} from './scaleQuantizer';
import { recalibrateBricksToLocalPitchCurve } from './pitchStepSegmentation';
import { NOTE_NAMES } from '../utils/noteUtils';

export const SOLFEGE_NOTE_NAMES = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'Sib', 'Si'];

export interface ProjectScaleAnalysisResult {
  tonic: string; rootPitchClass: number; scaleType: ScaleType;
  modeShortLabel: string; label: string; tonicSolfege: string;
  referencePitch: string; referencePitchSolfege: string; tuningOffset: number;
  analyzedPatternsCount: number; totalVoicedFrames: number; updatedPatterns: VocalPatternItem[];
}

export function formatProjectScaleLabel(tonic: string, scaleType: ScaleType): string {
  if (scaleType === 'chromatic') return 'Mode libre (Chromatique)';
  const pc = getTonicSemitone(tonic), rootFr = SOLFEGE_NOTE_NAMES[pc] || tonic;
  const modeMap: Partial<Record<ScaleType, string>> = {
    natural_minor: 'Mineur', minor: 'Mineur', major: 'Majeur',
    mixolydian: 'Mixolydien', dorian: 'Dorien', harmonic_minor: 'Mineur Harm.',
    pentatonic_minor: 'Pentatonique Min.', pentatonic_major: 'Pentatonique Maj.',
  };
  return `${rootFr} ${modeMap[scaleType] || 'Mineur'}`;
}

export function formatReferencePitchSolfege(referencePitch: string): string {
  const m = (referencePitch || 'A3').match(/^([A-Ga-g][#b]?)(\d+)$/);
  const note = m ? m[1].toUpperCase() : 'A', oct = m ? m[2] : '3';
  const pc = getTonicSemitone(note);
  return `${SOLFEGE_NOTE_NAMES[pc] || note}${oct}`;
}

export function analyzeFullProjectScale(patterns: VocalPatternItem[]): ProjectScaleAnalysisResult {
  const allPoints: PitchCurvePoint[] = [], phraseCurves: PitchCurvePoint[][] = [];
  let analyzedPatternsCount = 0;

  const updatedPatterns = patterns.map((pat) => {
    let curve = pat.rawPitchCurve?.length ? pat.rawPitchCurve : (pat.pitchCurve?.length ? pat.pitchCurve : []);
    if (curve.length === 0) {
      const varRec = pat.variants?.[pat.activeVariantKey]?.recordingResult;
      const pcm = pat.rawAudioSamples?.length ? pat.rawAudioSamples : (pat.recordingResult?.pcm?.length ? pat.recordingResult.pcm : varRec?.pcm);
      const sr = pat.recordingResult?.sampleRate || varRec?.sampleRate || 44100;
      if (pcm && pcm.length > 0) {
        const dur = pcm.length / sr;
        curve = extractContinuousPitchCurve(pcm, { sampleRate: sr, totalDurationSec: dur, trimStartSec: pat.trimStartSec || 0, trimEndSec: pat.trimEndSec > 0 ? pat.trimEndSec : dur, tessitura: pat.tessitura });
      }
    }
    const valid = curve.filter((p) => p.midiFloat >= 36 && p.midiFloat <= 96);
    if (valid.length >= 3) {
      analyzedPatternsCount++; allPoints.push(...valid); phraseCurves.push(valid);
      if (!pat.rawPitchCurve?.length) return { ...pat, rawPitchCurve: curve, pitchCurve: curve };
    }
    return pat;
  });

  const tuningOffset = estimateGlobalTuningOffset(allPoints);
  const plateauHist = new Float32Array(12), cadenceHist = new Float32Array(12);
  for (const curve of phraseCurves) {
    const norm = 20 / Math.max(6, curve.length);
    const tailStartIdx = Math.max(0, Math.floor(curve.length * 0.72));
    for (let i = 0; i < curve.length; i++) {
      const m = curve[i].midiFloat - tuningOffset, prevM = i > 0 ? curve[i - 1].midiFloat - tuningOffset : m;
      if (Math.abs(m - prevM) < 0.38) {
        const pc = ((Math.round(m) % 12) + 12) % 12, w = (curve[i].confidence ?? 0.9) * norm;
        plateauHist[pc] += w;
        if (i >= tailStartIdx) cadenceHist[pc] += w * (i >= curve.length - 4 ? 2.6 : 1.4);
      }
    }
  }

  const candidateModes: ScaleType[] = ['natural_minor', 'major', 'mixolydian', 'dorian'];
  let bestRoot = 9, bestMode: ScaleType = 'natural_minor', bestScore = -Infinity;
  if (allPoints.length >= 3) {
    for (let r = 0; r < 12; r++) {
      for (const mode of candidateModes) {
        const ivSet = new Set(SCALE_DEFINITIONS[mode].intervals.map((iv) => (r + iv) % 12));
        let score = 0;
        for (let pc = 0; pc < 12; pc++) {
          const rel = (pc - r + 12) % 12;
          score += ivSet.has(pc) ? plateauHist[pc] * (rel === 0 ? 1.45 : rel === 7 ? 1.18 : 1.0) : -plateauHist[pc] * 0.65;
        }
        score += cadenceHist[r] * 2.8 + cadenceHist[(r + 7) % 12] * 0.75;
        if (score > bestScore) { bestScore = score; bestRoot = r; bestMode = mode; }
      }
    }
  }

  const tonic = NOTE_NAMES[bestRoot];
  const tonicMidis = allPoints.map((p) => Math.round(p.midiFloat - tuningOffset)).filter((m) => ((m % 12) + 12) % 12 === bestRoot);
  const pool = tonicMidis.length > 0 ? tonicMidis : allPoints.map((p) => Math.round(p.midiFloat - tuningOffset));
  pool.sort((a, b) => a - b);
  const medMidi = pool.length > 0 ? pool[Math.floor(pool.length / 2)] : 57;
  const bestOctave = Math.max(2, Math.min(5, Math.floor(medMidi / 12) - 1));
  const referencePitch = `${tonic}${bestOctave}`, label = formatProjectScaleLabel(tonic, bestMode);

  return {
    tonic, rootPitchClass: bestRoot, scaleType: bestMode,
    modeShortLabel: label.split(' ').slice(1).join(' '), label,
    tonicSolfege: SOLFEGE_NOTE_NAMES[bestRoot], referencePitch,
    referencePitchSolfege: `${SOLFEGE_NOTE_NAMES[bestRoot]}${bestOctave}`,
    tuningOffset, analyzedPatternsCount, totalVoicedFrames: allPoints.length, updatedPatterns,
  };
}

export function applyDetectedScaleToProject(
  project: ToadaProject, tonic: string, scaleType: ScaleType, referencePitch?: string
): ToadaProject {
  const pc = getTonicSemitone(tonic), cleanTonic = NOTE_NAMES[pc] || 'A';
  const refPitch = referencePitch || `${cleanTonic}3`, keyLabel = formatProjectScaleLabel(cleanTonic, scaleType);
  const allowed = scaleType === 'chromatic' ? null : buildAllowedPitchClasses(cleanTonic, scaleType);

  const patterns = project.patterns.map((pat) => {
    const hasAnac = pat.hasAnacrusis !== false;
    const all = hasAnac ? [...(pat.anacrusisSteps || []), ...(pat.mainSteps || [])] : (pat.mainSteps || []);
    if (all.length === 0) return { ...pat, referencePitch: refPitch };
    const bpm = pat.bpm ?? pat.baseBpm ?? project.bpm ?? 88, stepDur = (60 / bpm) / 4, t1Off = hasAnac ? 4 * (60 / bpm) : 0.15;
    const curve = pat.rawPitchCurve?.length ? pat.rawPitchCurve : (pat.pitchCurve || []);
    const requantized = curve.length > 0
      ? recalibrateBricksToLocalPitchCurve(all, curve, hasAnac ? 0 : t1Off, stepDur, cleanTonic, scaleType, 0, allowed)
      : applyScaleToSteps(all, cleanTonic, scaleType);
    const anacLen = hasAnac ? (pat.anacrusisSteps?.length ?? 0) : 0;
    return {
      ...pat, referencePitch: refPitch,
      anacrusisSteps: hasAnac ? requantized.slice(0, anacLen) : [],
      mainSteps: (hasAnac ? requantized.slice(anacLen) : requantized).map((s, idx) => ({ ...s, stepIndex: idx })),
    };
  });

  return { ...project, toadaMeta: { ...(project.toadaMeta || {}), tonaliteDefaut: keyLabel }, patterns };
}
