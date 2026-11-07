/**
 * test_ghost_filter_syllable_reanalysis_and_doubt.mjs
 * Suite de tests automatisés E2E & unitaires pour les Volets 1 à 6 :
 * - Test 1 (Filtre Fantôme + Ambitus Anti-Octave) : Signal vocal synthétique à 196 Hz (Sol3)
 *   avec harmonique 2 (392 Hz, Sol4) 2.5x plus fort et pop de consonne à 60 Hz, analysé avec
 *   un Ambitus de baryton (minMidi = 45, maxMidi = 64, comfortMidi = 55) -> 100% Sol3 (MIDI 55), 0 saut vers Sol4 (67).
 * - Test 2 (Cœur de Voyelle + Auto-Diapason) : Double-croche de 160 ms sur La3 (MIDI 57) commençant
 *   par 55 ms de glissando de consonne depuis Fa3 (MIDI 53) et chantée avec +30 cents (+0.30 ST) ->
 *   reconnue sur La3 (MIDI 57) avec isUncertain === false.
 * - Test 3 (Re-Analyse sur Rythme Calé + Point de Doute ?) : Phrase de 6 syllabes dont le rythme
 *   (1-2-4, liaisons ───) est déjà écrit -> reanalyzeNotesOnAlignedSyllables garde 100% des active,
 *   isTie et syllable intacts, attribue les notes exactes aux 5 syllabes franches (isUncertain === false),
 *   et marque isUncertain === true + alternativeNote sur la 6e syllabe chantée pile entre deux notes (57.47 MIDI).
 */
import assert from 'node:assert/strict';
import './resolve-ts.mjs';

// Polyfill localStorage en mémoire pour Node
const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  clear: () => memStore.clear(),
};

const {
  AMBITUS_PROFILE_STORAGE_KEY,
  hasSavedAmbitusProfile,
  getEffectiveVocalBounds,
  createVocalProfilePayload,
  saveVocalProfile,
} = await import('../src/utils/ambitusStorage.ts');
const { createPreConditionedAnalysisPcm } = await import('../src/audio/pitchAnalysisPreFilter.ts');
const { extractContinuousPitchCurve } = await import('../src/audio/pitchExtractor.ts');
const {
  computeStationaryVowelWeights,
  cleanConsonantDipsInPitchCurve,
  estimateVocalTuningOffsetSemitones,
} = await import('../src/audio/vowelCorePitchEstimator.ts');
const {
  reanalyzeNotesOnAlignedSyllables,
} = await import('../src/audio/syllableGuidedPitchReanalyzer.ts');

console.log('=== TEST VOLET 1 : PONT AMBITUS & PLAGE VOCALE EFFECTIVE ===');
globalThis.localStorage.clear();
assert.equal(hasSavedAmbitusProfile(), false, 'Aucun profil Ambitus ne doit être présent après clear');
const fallbackBounds = getEffectiveVocalBounds();
assert.equal(fallbackBounds.isFromAmbitusTest, false);
assert.equal(fallbackBounds.minMidi, 43);
assert.equal(fallbackBounds.maxMidi, 69);

// Sauvegarde d'un profil Ambitus baryton (minMidi = 45, maxMidi = 64, comfortMidi = 55)
const baritonePayload = createVocalProfilePayload(45, 64, 95, true);
assert.ok(globalThis.localStorage.getItem(AMBITUS_PROFILE_STORAGE_KEY), 'La clé vocal_lab_ambitus_profile_v1 doit être écrite');
assert.equal(hasSavedAmbitusProfile(), true, 'Le profil Ambitus sauvegardé doit être détecté');
const baritoneBounds = getEffectiveVocalBounds();
assert.equal(baritoneBounds.isFromAmbitusTest, true);
assert.equal(baritoneBounds.minMidi, 43); // rawMin (45) - 2
assert.equal(baritoneBounds.maxMidi, 66); // rawMax (64) + 2
assert.equal(baritoneBounds.comfortMidi, 55);
console.log('✓ Volet 1 validé : Pont Ambitus et getEffectiveVocalBounds opérationnels.');

console.log('\n=== TEST 1 : FILTRE FANTÔME + AMBITUS ANTI-OCTAVE (196 Hz Sol3 + 2.5x 392 Hz Sol4 + Pop 60 Hz) ===');
const sampleRate = 44100;
const durationSec = 0.80;
const totalSamples = Math.floor(sampleRate * durationSec);
const rawPcmTest1 = new Float32Array(totalSamples);

const f0Sol3 = 196.0; // MIDI 55 (Sol3)
const f2Sol4 = 392.0; // MIDI 67 (Sol4, 2nd harmonique 2.5x plus fort)
const fPop = 60.0;    // Pop de consonne / proximité micro à 60 Hz

for (let i = 0; i < totalSamples; i++) {
  const t = i / sampleRate;
  // Pop grave sur les 80 premières millisecondes
  const popEnv = t < 0.08 ? Math.exp(-t * 25) * 1.8 : 0.0;
  const popSig = popEnv * Math.sin(2 * Math.PI * fPop * t);
  // Voix baryton avec 2e harmonique 2.5x plus fort que la fondamentale + 3e harmonique pour enveloppe
  const voiceSig =
    0.35 * Math.sin(2 * Math.PI * f0Sol3 * t) +
    0.875 * Math.sin(2 * Math.PI * f2Sol4 * t + 0.3) +
    0.25 * Math.sin(2 * Math.PI * (f0Sol3 * 3) * t);
  rawPcmTest1[i] = popSig + voiceSig;
}

// Vérifie que le filtre fantôme ne modifie pas rawPcmTest1
const rawCopyFirst10 = Array.from(rawPcmTest1.slice(0, 10));
const analysisPcm = createPreConditionedAnalysisPcm(rawPcmTest1, sampleRate, {
  minHz: baritoneBounds.minHz,
  maxHz: baritoneBounds.maxHz,
});
assert.deepEqual(
  Array.from(rawPcmTest1.slice(0, 10)),
  rawCopyFirst10,
  'Le PCM brut ne doit jamais être modifié par le filtre fantôme'
);
assert.equal(analysisPcm.length, rawPcmTest1.length);

const curveTest1 = extractContinuousPitchCurve(rawPcmTest1, {
  sampleRate,
  vocalBounds: {
    minMidi: 45,
    maxMidi: 64,
    comfortMidi: 55,
  },
});

const voicedFramesTest1 = curveTest1.filter((f) => Number.isFinite(f.midiFloat) && f.midiFloat >= 30);
assert.ok(voicedFramesTest1.length >= 25, `Attendu au moins 25 trames voisées, obtenu ${voicedFramesTest1.length}`);

let sol3Count = 0;
let sol4JumpCount = 0;
for (const frame of voicedFramesTest1) {
  const roundedMidi = Math.round(frame.midiFloat);
  if (roundedMidi === 55) sol3Count++;
  if (roundedMidi === 67) sol4JumpCount++;
}

assert.equal(
  sol4JumpCount,
  0,
  `Aucun saut d'octave vers Sol4 (MIDI 67) ne doit se produire (obtenu ${sol4JumpCount})`
);
assert.equal(
  sol3Count,
  voicedFramesTest1.length,
  `100% des trames voisées doivent être détectées sur Sol3 (MIDI 55) : ${sol3Count}/${voicedFramesTest1.length}`
);
console.log(`✓ Test 1 validé : ${sol3Count}/${voicedFramesTest1.length} trames à 100% sur Sol3 (MIDI 55), 0 saut vers Sol4 (MIDI 67).`);

console.log('\n=== TEST 2 : CŒUR DE VOYELLE + AUTO-DIAPASON (Double-croche 160 ms La3 avec 55 ms glissando Fa3 + 30 cents) ===');
const curveTest2 = [];
// Notes précédentes de la phrase (0.00s -> 0.80s) sur Sol3 + 0.30 ST (55.30) et Do4 + 0.30 ST (60.30)
for (let tMs = 0; tMs < 800; tMs += 10) {
  const baseMidi = tMs < 400 ? 55.30 : 60.30;
  curveTest2.push({
    timeSec: tMs / 1000,
    freqHz: 440 * Math.pow(2, (baseMidi - 69) / 12),
    midiFloat: baseMidi,
    confidence: 0.92,
    rms: 0.18,
  });
}
// Double-croche de 160 ms (1000 ms -> 1160 ms) :
// 0..55 ms : glissando de Fa3 (53.30) vers La3 (57.30)
// 55..160 ms : cœur de voyelle stable sur La3 + 30 cents (57.30)
for (let dt = 0; dt <= 160; dt += 10) {
  const isGlissando = dt < 55;
  const frac = Math.min(1, dt / 55);
  const midiVal = isGlissando ? 53.30 + frac * (57.30 - 53.30) : 57.30;
  curveTest2.push({
    timeSec: (1000 + dt) / 1000,
    freqHz: 440 * Math.pow(2, (midiVal - 69) / 12),
    midiFloat: midiVal,
    confidence: isGlissando ? 0.55 : 0.94,
    rms: isGlissando ? 0.05 : 0.22,
  });
}

const estimatedTuning = estimateVocalTuningOffsetSemitones(curveTest2);
assert.ok(
  Math.abs(estimatedTuning - 0.30) < 0.05,
  `L'auto-diapason circulaire doit détecter ~+0.30 ST (obtenu ${estimatedTuning.toFixed(3)} ST)`
);

const stepsTest2 = Array.from({ length: 16 }, (_, idx) => ({
  stepIndex: idx,
  active: idx === 0,
  isTie: false,
  note: 'Do3',
  midiNumber: 48,
  syllable: idx === 0 ? 'la' : '',
  subBeatOffset: 0,
}));

const reanalyzedTest2 = reanalyzeNotesOnAlignedSyllables({
  steps: stepsTest2,
  pitchCurve: curveTest2,
  gridStartSec: 1.0,
  stepDurationSec: 0.16,
  tonic: 'Do',
  scaleType: 'major',
  vocalBounds: { minMidi: 45, maxMidi: 68, comfortMidi: 57 },
});

assert.equal(
  reanalyzedTest2[0].midiNumber,
  57,
  `La double-croche avec glissando +30 cents doit être reconnue sur La3 (MIDI 57), obtenu MIDI ${reanalyzedTest2[0].midiNumber} (${reanalyzedTest2[0].note})`
);
assert.equal(reanalyzedTest2[0].note, 'A3');
assert.equal(reanalyzedTest2[0].isUncertain, false, 'La note franche après nettoyage du glissando et auto-diapason doit avoir isUncertain === false');
console.log(`✓ Test 2 validé : Auto-diapason = +${(estimatedTuning * 100).toFixed(1)} cents, double-croche reconnue sur ${reanalyzedTest2[0].note} (MIDI ${reanalyzedTest2[0].midiNumber}, isUncertain = ${reanalyzedTest2[0].isUncertain}).`);

console.log('\n=== TEST 3 : RE-ANALYSE SUR RYTHME CALÉ (1-2-4 + LIAISONS) & POINT DE DOUTE (?) ===');
const stepDurationSec = 0.175; // ~85 BPM
const initialStepsTest3 = [
  { stepIndex: 0, active: true, isTie: false, note: 'Do3', midiNumber: 48, syllable: 'Vo-', subBeatOffset: 0 },
  { stepIndex: 1, active: true, isTie: true,  note: '───', midiNumber: 48, syllable: '',    subBeatOffset: 0 },
  { stepIndex: 2, active: true, isTie: false, note: 'Do3', midiNumber: 48, syllable: 'vó',  subBeatOffset: 0.15 },
  { stepIndex: 3, active: true, isTie: false, note: 'Do3', midiNumber: 48, syllable: 'fa-', subBeatOffset: 0 },
  { stepIndex: 4, active: true, isTie: false, note: 'Do3', midiNumber: 48, syllable: 'lou', subBeatOffset: 0 },
  { stepIndex: 5, active: true, isTie: true,  note: '───', midiNumber: 48, syllable: '',    subBeatOffset: 0 },
  { stepIndex: 6, active: true, isTie: true,  note: '───', midiNumber: 48, syllable: '',    subBeatOffset: 0 },
  { stepIndex: 7, active: false, isTie: false, note: 'Do3', midiNumber: 48, syllable: '',   subBeatOffset: 0 },
  { stepIndex: 8, active: true, isTie: false, note: 'Do3', midiNumber: 48, syllable: 'na',  subBeatOffset: 0 },
  { stepIndex: 9, active: true, isTie: true,  note: '───', midiNumber: 48, syllable: '',    subBeatOffset: 0 },
  { stepIndex: 10, active: false, isTie: false, note: 'Do3', midiNumber: 48, syllable: '',  subBeatOffset: 0 },
  { stepIndex: 11, active: true, isTie: false, note: 'Do3', midiNumber: 48, syllable: 'mar-', subBeatOffset: 0 },
  { stepIndex: 12, active: false, isTie: false, note: 'Do3', midiNumber: 48, syllable: '',  subBeatOffset: 0 },
  { stepIndex: 13, active: false, isTie: false, note: 'Do3', midiNumber: 48, syllable: '',  subBeatOffset: 0 },
  { stepIndex: 14, active: false, isTie: false, note: 'Do3', midiNumber: 48, syllable: '',  subBeatOffset: 0 },
  { stepIndex: 15, active: false, isTie: false, note: 'Do3', midiNumber: 48, syllable: '',  subBeatOffset: 0 },
];

const curveTest3 = [];
const totalMs3 = Math.ceil(16 * stepDurationSec * 1000);
for (let tMs = 0; tMs <= totalMs3; tMs += 10) {
  const tSec = tMs / 1000;
  const stepIdx = Math.floor(tSec / stepDurationSec);
  let targetMidi = null;
  if (stepIdx === 0 || stepIdx === 1) targetMidi = 55.0; // Sol3
  else if (stepIdx === 2) targetMidi = 57.0;             // La3
  else if (stepIdx === 3) targetMidi = 60.0;             // Do4
  else if (stepIdx >= 4 && stepIdx <= 6) targetMidi = 62.0; // Ré4
  else if (stepIdx === 8 || stepIdx === 9) targetMidi = 64.0; // Mi4
  else if (stepIdx === 11) targetMidi = 57.47;           // Entre La3 (57) et Sib3 (58) / Si3 (59)

  if (targetMidi !== null) {
    curveTest3.push({
      timeSec: tSec,
      freqHz: 440 * Math.pow(2, (targetMidi - 69) / 12),
      midiFloat: targetMidi,
      confidence: 0.92,
      rms: 0.20,
    });
  }
}

const reanalyzedTest3 = reanalyzeNotesOnAlignedSyllables({
  steps: initialStepsTest3,
  pitchCurve: curveTest3,
  gridStartSec: 0,
  stepDurationSec,
  tonic: 'Do',
  scaleType: 'major',
  vocalBounds: { minMidi: 45, maxMidi: 68, comfortMidi: 58 },
});

// 1. Vérifier que 100% des active, isTie, syllable et subBeatOffset sont intacts
for (let i = 0; i < initialStepsTest3.length; i++) {
  assert.equal(reanalyzedTest3[i].active, initialStepsTest3[i].active, `Step ${i} active modifié !`);
  assert.equal(reanalyzedTest3[i].isTie, initialStepsTest3[i].isTie, `Step ${i} isTie modifié !`);
  assert.equal(reanalyzedTest3[i].syllable, initialStepsTest3[i].syllable, `Step ${i} syllable modifié !`);
  assert.equal(reanalyzedTest3[i].subBeatOffset, initialStepsTest3[i].subBeatOffset, `Step ${i} subBeatOffset modifié !`);
}

// 2. Vérifier les 5 syllabes franches (isUncertain === false) et leurs liaisons
assert.equal(reanalyzedTest3[0].midiNumber, 55, 'Syllabe 1 (pas 0) doit être Sol3 (55)');
assert.equal(reanalyzedTest3[1].midiNumber, 55, 'Liaison Syllabe 1 (pas 1) doit suivre Sol3 (55)');
assert.equal(reanalyzedTest3[0].isUncertain, false);

assert.equal(reanalyzedTest3[2].midiNumber, 57, 'Syllabe 2 (pas 2) doit être La3 (57)');
assert.equal(reanalyzedTest3[2].isUncertain, false);

assert.equal(reanalyzedTest3[3].midiNumber, 60, 'Syllabe 3 (pas 3) doit être Do4 (60)');
assert.equal(reanalyzedTest3[3].isUncertain, false);

assert.equal(reanalyzedTest3[4].midiNumber, 62, 'Syllabe 4 (pas 4) doit être Ré4 (62)');
assert.equal(reanalyzedTest3[5].midiNumber, 62, 'Liaison Syllabe 4 (pas 5) doit suivre Ré4 (62)');
assert.equal(reanalyzedTest3[6].midiNumber, 62, 'Liaison Syllabe 4 (pas 6) doit suivre Ré4 (62)');
assert.equal(reanalyzedTest3[4].isUncertain, false);

assert.equal(reanalyzedTest3[8].midiNumber, 64, 'Syllabe 5 (pas 8) doit être Mi4 (64)');
assert.equal(reanalyzedTest3[9].midiNumber, 64, 'Liaison Syllabe 5 (pas 9) doit suivre Mi4 (64)');
assert.equal(reanalyzedTest3[8].isUncertain, false);

// 3. Vérifier la 6e syllabe (pas 11, chantée à 57.47 MIDI entre deux notes) -> Point de Doute (?)
const sixthSyllable = reanalyzedTest3[11];
assert.equal(sixthSyllable.isUncertain, true, 'La 6e syllabe (57.47 MIDI) doit être marquée isUncertain === true');
assert.ok(
  typeof sixthSyllable.alternativeNote === 'string' && sixthSyllable.alternativeNote.length > 0,
  `La 6e syllabe incertaine doit proposer une alternativeNote (obtenu: ${sixthSyllable.alternativeNote})`
);
assert.notEqual(
  sixthSyllable.alternativeNote,
  sixthSyllable.note,
  'alternativeNote doit être différente de la note principale proposée'
);
console.log(
  `✓ Test 3 validé : 100% du rythme/syllabes/liaisons préservés, 5 syllabes franches exactes, 6e syllabe (57.47 MIDI) marquée incertaine (? ${sixthSyllable.note} ou ${sixthSyllable.alternativeNote}, raison: ${sixthSyllable.doubtReason}).`
);

console.log('\n🎉 TOUS LES TESTS AUTOMATISÉS (VOLETS 1 À 6) SONT PASSÉS AVEC SUCCÈS !');
