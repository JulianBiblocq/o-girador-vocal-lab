/**
 * scripts/test_melodyne_smooth_psola.mjs
 * Test automatisé du moteur Phase-Locked PSOLA (normalisation exacte acc/weight, Hermite 4-points)
 * et de la protection absolue des 16 briques manuelles lors de [ + Aligner ].
 */
import assert from 'node:assert';
import { correctAudioPitchWithMelodyne } from '../src/audio/melodynePitchCorrector.ts';
import { assignSyllablesStrictlyToExistingBricks } from '../src/utils/syllableAligner.ts';

const sampleRate = 44100;
const durationSec = 4.0;
const totalSamples = Math.floor(sampleRate * durationSec);
const rawAudio = new Float32Array(totalSamples);
const rawPitchCurve = [];

// 1. Génération d'un signal vocal réaliste (fondamentale + harmoniques 2, 3, 4 + vibrato + segments non-voisés)
let phase = 0;
for (let i = 0; i < totalSamples; i++) {
  const t = i / sampleRate;
  const isUnvoiced = (t >= 0.0 && t < 0.25) || (t >= 1.8 && t < 2.05) || (t >= 3.7 && t <= 4.0);
  if (isUnvoiced) {
    // Segment consonne fricative / souffle doux déterministe
    rawAudio[i] = 0.08 * Math.sin(2 * Math.PI * 1850 * t) * Math.cos(2 * Math.PI * 430 * t);
  } else {
    // Voyelle chantée autour de A3 + 60 cents (MIDI 57.60) avec vibrato naturel de 5.5 Hz
    const midi = 57.60 + 0.18 * Math.sin(2 * Math.PI * 5.5 * t);
    const f0 = 440 * Math.pow(2, (midi - 69) / 12);
    phase += (2 * Math.PI * f0) / sampleRate;
    const s =
      0.50 * Math.sin(phase) +
      0.25 * Math.sin(2 * phase + 0.3) +
      0.14 * Math.sin(3 * phase + 0.7) +
      0.08 * Math.sin(4 * phase + 1.1);
    rawAudio[i] = s * 0.8;
  }
}

for (let t = 0; t <= durationSec; t += 0.01) {
  const isUnvoiced = (t >= 0.0 && t < 0.25) || (t >= 1.8 && t < 2.05) || (t >= 3.7 && t <= 4.0);
  const midi = isUnvoiced ? 0 : 57.60 + 0.18 * Math.sin(2 * Math.PI * 5.5 * t);
  rawPitchCurve.push({ timeSec: t, midiFloat: midi });
}

const steps = Array.from({ length: 16 }, (_, idx) => ({
  stepIndex: idx,
  active: idx >= 1 && idx <= 14,
  note: idx === 1 || idx === 8 ? 'A3' : idx > 1 && idx <= 14 ? '───' : '',
  isTie: !(idx === 1 || idx === 8) && idx >= 1 && idx <= 14,
  midiNumber: idx >= 1 && idx <= 14 ? 57 : 0,
  velocity: 100,
  decay: durationSec / 16,
  manualPitchMoved: true,
}));

// Forcer sungMedian à 57.60 et cible à 56.0 (G#3 déplacé) pour qu'à 4%, |shift| = 0.064 demi-ton (> 0.015) active réellement la boucle Phase-Locked PSOLA
for (let i = 1; i <= 14; i++) steps[i].midiNumber = 56;
steps[1].note = 'G#3';
steps[8].note = 'G#3';

// Correction Melodyne à 4 % (Justesse: 4%, Tenue: 4%, Stabilité: 4%) sur toute la phrase
const regions = [
  {
    id: 'reg_test_4pct',
    startSec: 0.0,
    endSec: durationSec,
    pitchCenterPct: 4,
    driftCorrectionPct: 4,
    flattenPct: 4,
  },
];

const corrected = correctAudioPitchWithMelodyne(rawAudio, sampleRate, durationSec, rawPitchCurve, steps, regions, 0, durationSec);

// Vérification 1A : Absence totale de discontinuité de phase (aucun saut d'échantillon brusque > original * 1.15)
let maxDiffOrig = 0;
let maxDiffCorr = 0;
for (let i = 1; i < totalSamples; i++) {
  const d0 = Math.abs(rawAudio[i] - rawAudio[i - 1]);
  const d1 = Math.abs(corrected[i] - corrected[i - 1]);
  if (d0 > maxDiffOrig) maxDiffOrig = d0;
  if (d1 > maxDiffCorr) maxDiffCorr = d1;
}
console.log(`Max sample-to-sample derivative: original=${maxDiffOrig.toFixed(4)}, corrected=${maxDiffCorr.toFixed(4)}`);
assert.ok(maxDiffCorr <= maxDiffOrig * 1.15, `Discontinuité de phase détectée: ${maxDiffCorr} > ${maxDiffOrig * 1.15}`);

// Vérification 1B : Corrélation d'enveloppe RMS > 0.995 avec l'original (zéro modulation d'amplitude / hachage)
const envWin = Math.round(0.020 * sampleRate);
const envStep = Math.round(0.005 * sampleRate);
const origEnv = [];
const corrEnv = [];
for (let start = 0; start + envWin <= totalSamples; start += envStep) {
  let s0 = 0, s1 = 0;
  for (let k = 0; k < envWin; k++) {
    s0 += rawAudio[start + k] * rawAudio[start + k];
    s1 += corrected[start + k] * corrected[start + k];
  }
  origEnv.push(Math.sqrt(s0 / envWin));
  corrEnv.push(Math.sqrt(s1 / envWin));
}
let dot = 0, e0 = 0, e1 = 0;
for (let i = 0; i < origEnv.length; i++) {
  dot += origEnv[i] * corrEnv[i];
  e0 += origEnv[i] * origEnv[i];
  e1 += corrEnv[i] * corrEnv[i];
}
const rmsEnvCorrelation = dot / Math.sqrt(e0 * e1);
console.log(`Corrélation d'enveloppe RMS (4% Melodyne vs Original): ${rmsEnvCorrelation.toFixed(6)}`);
assert.ok(rmsEnvCorrelation > 0.995, `Modulation d'amplitude parasite détectée: corrélation RMS = ${rmsEnvCorrelation} <= 0.995`);

// Vérification 2 : Protection stricte des 16 briques manuelles lors de [ + Aligner ]
const manual48Steps = Array.from({ length: 48 }, (_, i) => ({
  stepIndex: i,
  active: false,
  note: '',
  isTie: false,
  midiNumber: 0,
  velocity: 0,
  decay: 0.15,
  syllable: '',
}));

const manualBrickPositions = [
  { start: 8, len: 2, midi: 57, note: 'A3' },
  { start: 10, len: 2, midi: 57, note: 'A3' },
  { start: 12, len: 2, midi: 57, note: 'A3' },
  { start: 14, len: 1, midi: 56, note: 'G#3' },
  { start: 15, len: 1, midi: 55, note: 'G3' },
  { start: 16, len: 2, midi: 55, note: 'G3' },
  { start: 18, len: 2, midi: 53, note: 'F3' },
  { start: 20, len: 2, midi: 57, note: 'A3' },
  { start: 22, len: 2, midi: 57, note: 'A3' },
  { start: 25, len: 1, midi: 55, note: 'G3' },
  { start: 26, len: 2, midi: 55, note: 'G3' },
  { start: 28, len: 2, midi: 57, note: 'A3' },
  { start: 30, len: 1, midi: 55, note: 'G3' },
  { start: 31, len: 1, midi: 53, note: 'F3' },
  { start: 32, len: 2, midi: 52, note: 'E3' },
  { start: 34, len: 4, midi: 53, note: 'F3' },
];

for (const b of manualBrickPositions) {
  manual48Steps[b.start] = {
    ...manual48Steps[b.start],
    active: true,
    isTie: false,
    midiNumber: b.midi,
    note: b.note,
    velocity: 100,
  };
  for (let k = 1; k < b.len; k++) {
    manual48Steps[b.start + k] = {
      ...manual48Steps[b.start + k],
      active: true,
      isTie: true,
      midiNumber: b.midi,
      note: '───',
      velocity: 90,
    };
  }
}

const snapshotBefore = manual48Steps.map((s) => ({
  stepIndex: s.stepIndex,
  active: s.active,
  isTie: s.isTie,
  midiNumber: s.midiNumber,
  note: s.note,
}));

const aligned16 = assignSyllablesStrictlyToExistingBricks(
  manual48Steps,
  'Negro vem de Luanda Trazendo o baque virado nação'
);

const snapshotAfter = aligned16.map((s) => ({
  stepIndex: s.stepIndex,
  active: s.active,
  isTie: s.isTie,
  midiNumber: s.midiNumber,
  note: s.note,
}));

assert.deepStrictEqual(snapshotAfter, snapshotBefore, '[ + Aligner ] ne doit JAMAIS modifier active, isTie, midiNumber ou note');
const attackBricksAfter = aligned16.filter((s) => s.active && !s.isTie && s.note !== '───');
assert.strictEqual(attackBricksAfter.length, 16, 'Les 16 briques manuelles doivent rester strictement au nombre de 16');
console.log('16 briques conservées intactes avec syllabes :', attackBricksAfter.map((b) => b.syllable));
console.log('✅ TOUS LES TESTS PSOLA PHASE-LOCKED & PROTECTION DES 16 BRIQUES SONT PASSÉS AVEC SUCCÈS !');
