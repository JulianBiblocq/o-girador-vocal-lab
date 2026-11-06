/**
 * test_cubase_variaudio_livret4.mjs
 * Vérifie les 5 volets de la refonte Cubase VariAudio du Livret 4 et la règle terminologique Batuque vs Baque.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { slicerTranslationsFr } from '../src/i18n/slicerTranslationsFr.ts';
import { slicerTranslationsBr } from '../src/i18n/slicerTranslationsBr.ts';
import { treinoSubTranslationsFr } from '../src/i18n/treinoSubTranslationsFr.ts';
import { treinoSubTranslationsBr } from '../src/i18n/treinoSubTranslationsBr.ts';
import { recalibrateBricksToLocalPitchCurve } from '../src/audio/pitchStepSegmentation.ts';
import {
  moveBrick,
  glueBrickToNext,
  setBrickMelodynePullPct,
  setAllBricksMelodynePullPct,
} from '../src/components/livret-melodia/pianoRollInteractions.ts';
import {
  buildBrickVariAudioRegions,
  ensureRegionForMovedBrick,
  computeCorrectedPitchCurve,
} from '../src/audio/melodynePitchCorrector.ts';
import { applyBeatRhythmPreset, MARACATU_BEAT_PRESETS } from '../src/components/livret-melodia/BeatRhythmPresetBar.tsx';

console.log('🧪 Test 1 : Règle terminologique Maracatu (Batuque vs Baque, zéro Bateria)...');
assert.equal(treinoSubTranslationsFr.conductorAddSilenceBtn, '🔇 Pause Batuque');
assert.equal(treinoSubTranslationsBr.conductorAddSilenceBtn, '🔇 Pausa do Batuque');
assert.equal(slicerTranslationsFr.slicerPauseRowBadge, '🔇 Pause Batuque • {m}M');
assert.equal(slicerTranslationsBr.slicerPauseRowBadge, '🔇 Pausa do Batuque • {m}M');

function checkNoBateria(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) checkNoBateria(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) {
      const content = fs.readFileSync(full, 'utf8');
      assert.equal(/\bbateria\b/i.test(content), false, `Mot interdit 'Bateria' trouvé dans ${full}`);
    }
  }
}
checkNoBateria(path.resolve('src'));
console.log('✅ Test 1 OK');

console.log('🧪 Test 2 : Alignement 100 % Exact Briques MIDI ⟷ Courbe Verte (Gamme Débrayée Libre)...');
// Chant en La3 (57) et Do#4 (61) — ne doit JAMAIS être décalé vers Do Majeur quand scaleType === 'chromatic'
const steps = [
  { stepIndex: 0, active: true, note: 'C4', midiNumber: 60, syllable: 'Lu', velocity: 100, decay: 0.15 },
  { stepIndex: 1, active: true, note: '───', midiNumber: 60, isTie: true, syllable: '', velocity: 90, decay: 0.15 },
  { stepIndex: 2, active: true, note: 'C4', midiNumber: 60, syllable: 'an', velocity: 100, decay: 0.15 },
  { stepIndex: 3, active: true, note: '───', midiNumber: 60, isTie: true, syllable: '', velocity: 90, decay: 0.15 },
];
const greenCurve = [
  { timeSec: 0.05, midiFloat: 57.1, confidence: 0.95, rms: 0.2 },
  { timeSec: 0.15, midiFloat: 57.05, confidence: 0.95, rms: 0.2 },
  { timeSec: 0.25, midiFloat: 57.12, confidence: 0.95, rms: 0.2 },
  { timeSec: 0.35, midiFloat: 61.08, confidence: 0.95, rms: 0.2 },
  { timeSec: 0.45, midiFloat: 61.02, confidence: 0.95, rms: 0.2 },
  { timeSec: 0.55, midiFloat: 61.10, confidence: 0.95, rms: 0.2 },
];
const aligned = recalibrateBricksToLocalPitchCurve(steps, greenCurve, 0, 0.15, 'C', 'chromatic', 0, null);
assert.equal(aligned[0].midiNumber, 57, 'Brique 1 posée pile sur La3 (57)');
assert.equal(aligned[0].note, 'A3');
assert.equal(aligned[2].midiNumber, 61, 'Brique 2 posée pile sur Do#4 (61) sans biais Do Majeur');
assert.equal(aligned[2].note, 'C#4');
assert.ok(typeof aligned[0].originalVoiceMidi === 'number');
console.log('✅ Test 2 OK');

console.log('🧪 Test 3 : Poignée de Correction Melodyne par Brique (VariAudio 0..100%)...');
// Par défaut (melodynePullPct = 0), bouger une brique ne modifie PAS la voix
const movedRaw = moveBrick(aligned, 0, 59);
const regionsWhenZero = ensureRegionForMovedBrick([], movedRaw, 0, 0.6, 0, 0.6);
assert.equal(regionsWhenZero.length, 0, 'Aucune région Melodyne active si melodynePullPct === 0');

// Quand melodynePullPct > 0 sur la brique 0, elle génère une région ciblant sa hauteur MIDI
const pulledSteps = setBrickMelodynePullPct(movedRaw, 0, 85);
assert.equal(pulledSteps[0].melodynePullPct, 85);
const variRegions = buildBrickVariAudioRegions(pulledSteps, 0.6, 0, 0.6);
assert.equal(variRegions.length, 1);
assert.equal(variRegions[0].pitchCenterPct, 85);
assert.equal(variRegions[0].targetMidiOverride, 59);

const correctedCurve = computeCorrectedPitchCurve(greenCurve, pulledSteps, 0.6, [], 0, 0.6);
assert.ok(correctedCurve[1].midiFloat > greenCurve[1].midiFloat, 'La courbe sous la brique 0 est attirée vers Si3 (59)');
assert.equal(correctedCurve[4].midiFloat, greenCurve[4].midiFloat, 'La courbe sous la brique 2 (0%) reste 100% brute');

const purged = setAllBricksMelodynePullPct(pulledSteps, 0);
assert.equal(buildBrickVariAudioRegions(purged, 0.6, 0, 0.6).length, 0);
console.log('✅ Test 3 OK');

console.log('🧪 Test 4 : Outil Colle 🔗 (glueBrickToNext)...');
const glued = glueBrickToNext(aligned, 0);
assert.equal(glued[0].midiNumber, 57);
assert.equal(glued[0].syllable, 'Luan');
assert.equal(glued[2].note, '───');
assert.equal(glued[2].isTie, true);
assert.equal(glued[2].midiNumber, 57);
console.log('✅ Test 4 OK');

console.log('🧪 Test 5 : Boutons de Figures Rythmiques Maracatu (1-2-4)...');
const preset124 = MARACATU_BEAT_PRESETS.find((p) => p.id === '1-2-4');
assert.ok(preset124);
const afterPreset = applyBeatRhythmPreset(aligned, 0, preset124.subdivs, 4);
assert.equal(afterPreset[0].note !== '───' && afterPreset[0].active, true);
assert.equal(afterPreset[1].note !== '───' && afterPreset[1].active, true);
assert.equal(afterPreset[2].note, '───');
assert.equal(afterPreset[3].note !== '───' && afterPreset[3].active, true);
console.log('✅ Test 5 OK');

console.log('🎉 TOUS LES TESTS DE LA REFONTE CUBASE VARIAUDIO DU LIVRET 4 SONT PASSÉS AVEC SUCCÈS !');
