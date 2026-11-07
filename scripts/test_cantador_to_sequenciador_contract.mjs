/**
 * test_cantador_to_sequenciador_contract.mjs
 * Suite de tests E2E & unitaires validant le Contrat d'Intégration Directe Cantador -> Sequenciador (/toada_packs) :
 * 1. Lecture de la Frise Conducteur (slots) : Alternance Puxador/Coro, Chant simultané (Unisson/Harmonie), Pause du Batuque ([PAUSE XM] -> 🥁 Baque)
 * 2. Alignement Temporel Canonique (Anacrouse M-1 et Chute +1T : when = slotMeasureT1Time + (trimStartSec - t1OffsetSec) * (recordedBpm / currentBpm))
 * 3. Bascule Multi-Vitesses (75%, 88%, 100%) + playbackRate et Bascule de Tonalité (sungKey, troupeKey, transpositionSemitones)
 * 4. Affichage Roda & MIDI (anacrusisSteps, mainSteps, ignoreMelodyPitch : rythme + syllabes + arcs ─── sans notes MIDI)
 */
import assert from 'node:assert/strict';
import './resolve-ts.mjs';

const { sanitizePatternForFirestore } = await import('../src/services/toadaPublishHelpers.ts');
const { buildSequencerToadaPackDocument } = await import('../src/services/cloudToadaPublisher.ts');

const {
  buildToadaConductorSlots,
  deployToadaCycle,
} = await import('../../o-girador-sequenciador/src/utils/toadaArrangement.ts');
const {
  convertToadaPattern,
} = await import('../../o-girador-sequenciador/src/utils/toadaPatternConverter.ts');
const {
  computeCanonicalVocalTriggerTime,
  VocalTimingCalculator,
} = await import('../../o-girador-sequenciador/src/audio/vocal/vocalTimingCalculator.ts');
const {
  selectBestVocalVariant,
  resolvePreferredSpeedTierRatio,
} = await import('../../o-girador-sequenciador/src/utils/vocal/vocalVariantSelector.ts');
const {
  resolveVocalPlaybackBuffer,
} = await import('../../o-girador-sequenciador/src/utils/vocal/vocalPlaybackHelper.ts');
const {
  computeTransposedTroupeKey,
  syncCloudToadaTransposition,
} = await import('../../o-girador-sequenciador/src/services/cloudToadas.ts');
const {
  resolveActiveVoiceState,
} = await import('../../o-girador-sequenciador/src/components/circle-sequencer/resolveActiveVoiceState.ts');
const {
  extractSeparateVoiceStep,
} = await import('../../o-girador-sequenciador/src/components/circle-sequencer/extractSeparateVoiceStep.ts');
const {
  buildVoiceBlocks,
} = await import('../../o-girador-sequenciador/src/components/circle-sequencer/voiceBlockHelpers.ts');
const {
  getPatternWords,
} = await import('../../o-girador-sequenciador/src/components/circle-sequencer/karaokeHelpers.ts');

console.log('=== POINT 1 : FRISE CONDUCTEUR (SLOTS), ALTERNANCE, CHANT SIMULTANÉ & PAUSE DU BATUQUE ===');
const rawPatterns = [
  { id: 'pat_pux_1', name: 'Puxador 1', role: 'puxador', measuresCount: 2 },
  { id: 'pat_coro_1', name: 'Coro 1', role: 'coro', measuresCount: 2 },
];
const patIdMap = new Map([
  ['pat_pux_1', 1001],
  ['pat_coro_1', 2001],
]);

const rawSlots = [
  // Slot 0 : Alternance Puxador (2M : M0..M1)
  { id: 's1', puxadorPatternId: 'pat_pux_1', coroPatternId: null, advanceMeasures: 2 },
  // Slot 1 : Alternance Coro (2M : M2..M3)
  { id: 's2', puxadorPatternId: null, coroPatternId: 'pat_coro_1', advanceMeasures: 2 },
  // Slot 2 : Chant simultané Unisson / Harmonie (Puxador + Coro sur les mêmes mesures M4..M5)
  { id: 's3', puxadorPatternId: 'pat_pux_1', coroPatternId: 'pat_coro_1', advanceMeasures: 2 },
  // Slot 3 : Pause du Batuque [PAUSE 2M] (M6..M7 : uniquement le Baque)
  { id: 's4', puxadorPatternId: null, coroPatternId: null, advanceMeasures: 2, isSilenceSlot: true },
];

const conductorSlots = buildToadaConductorSlots(rawSlots, rawPatterns, patIdMap);
assert.equal(conductorSlots.length, 4);
assert.equal(conductorSlots[0].puxadorPatternId, 1001);
assert.equal(conductorSlots[0].coroPatternId, undefined);
assert.equal(conductorSlots[2].puxadorPatternId, 1001);
assert.equal(conductorSlots[2].coroPatternId, 2001);
assert.equal(conductorSlots[3].isSilenceSlot, true);
assert.equal(conductorSlots[3].advanceMeasures, 2);

const mockPuxPat = { id: 1001, name: 'Puxador 1', steps: 32, activeSteps: Array(32).fill('P'), measureAssignments: Array(8).fill(false) };
const mockCoroPat = { id: 2001, name: 'Coro 1', steps: 32, activeSteps: Array(32).fill('C'), measureAssignments: Array(8).fill(false) };
const mockState = {
  totalMeasures: 8,
  bpm: 88,
  timeSig: '4/4',
  toadaConductorSlots: conductorSlots,
  tracks: [
    { id: 10, instrumentIdx: 10, patterns: [mockPuxPat] }, // puxador
    { id: 11, instrumentIdx: 11, patterns: [mockCoroPat] }, // coro
  ],
  measureBpms: Array(8).fill(88),
  measureTimeSigs: Array(8).fill('4/4'),
  measureVols: Array(8).fill(100),
  measureBpmTransitions: Array(8).fill('immediate'),
  measureVolTransitions: Array(8).fill('immediate'),
  measureSignals: Array(8).fill(null),
};

const deployed = deployToadaCycle(mockState, 0);
const depPuxAssign = deployed.tracks[0].patterns[0].measureAssignments;
const depCoroAssign = deployed.tracks[1].patterns[0].measureAssignments;

// M0..M1 : Puxador seul
assert.deepEqual(depPuxAssign.slice(0, 2), [true, true]);
assert.deepEqual(depCoroAssign.slice(0, 2), [false, false]);
// M2..M3 : Coro seul
assert.deepEqual(depPuxAssign.slice(2, 4), [false, false]);
assert.deepEqual(depCoroAssign.slice(2, 4), [true, true]);
// M4..M5 : Chant simultané (Puxador ET Coro actifs en même temps)
assert.deepEqual(depPuxAssign.slice(4, 6), [true, true]);
assert.deepEqual(depCoroAssign.slice(4, 6), [true, true]);
// M6..M7 : Pause du Batuque ([PAUSE 2M] -> ni Puxador ni Coro, uniquement le Baque)
assert.deepEqual(depPuxAssign.slice(6, 8), [false, false]);
assert.deepEqual(depCoroAssign.slice(6, 8), [false, false]);

// Vérification de l'affichage "🥁 Baque" sur la Roda pendant la Pause du Batuque (M6)
const pauseVoiceState = resolveActiveVoiceState(
  { step: 0, measure: 6, maxTicks: 96, ratio: 0 },
  deployed.tracks,
  8
);
assert.equal(pauseVoiceState.activeRole, 'baque', 'Sur une mesure de Pause du Batuque, activeRole doit être "baque" (affiche 🥁 Baque sur la Roda)');
console.log('✓ Point 1 validé : Alternance, Chant simultané (Puxador + Coro) et Pause du Batuque (🥁 Baque) 100% conformes.');

console.log('\n=== POINT 2 : ALIGNEMENT TEMPOREL CANONIQUE (ANACROUSE M-1 & CHUTE +1T) ===');
// Formule : when = slotMeasureT1Time + (trimStartSec - t1OffsetSec) * (recordedBpm / currentBpm)
const slotMeasureT1Time = 10.0;
const trimStartSec = 0.20;
const t1OffsetSec = 1.60; // Anacrouse de 1.40s au tempo d'enregistrement
const recordedBpm = 85;
const currentBpm = 100;

const { triggerOffsetSec, when } = computeCanonicalVocalTriggerTime(
  slotMeasureT1Time,
  trimStartSec,
  t1OffsetSec,
  recordedBpm,
  currentBpm
);
const expectedWhen = 10.0 + (0.20 - 1.60) * (85 / 100); // 10.0 - 1.19 = 8.81s
assert.ok(Math.abs(when - expectedWhen) < 1e-6, `Attendu when = ${expectedWhen}, obtenu ${when}`);

const calcTiming = VocalTimingCalculator.calculateTiming({
  clip: { trimStartSec, t1OffsetSec, recordedBpm, nudgeMs: 0 },
  ptnRef: { steps: 32, activeSteps: Array(32).fill('P') },
  voiceTrack: {},
  effectiveBpm: currentBpm,
  measureStartTime: slotMeasureT1Time,
  sequencerStore: { bpm: currentBpm },
});
assert.ok(Math.abs(calcTiming.triggerTime - expectedWhen) < 1e-6, `VocalTimingCalculator.calculateTiming doit appliquer la formule canonique exacte`);

// Vérification que le débordement de fin (+1T, hasTailBeat: true, 36 pas pour 2M) ne gonfle pas measuresCount (reste 32 pas = 2M)
const patternWithTail = convertToadaPattern(
  {
    id: 'pat_tail',
    name: 'Phrase avec chute +1T',
    measuresCount: 2,
    hasAnacrusis: true,
    hasTailBeat: true,
    anacrusisSteps: Array.from({ length: 16 }, (_, i) => ({ stepIndex: i, active: i >= 12, note: 'G3', syllable: i === 12 ? 'Vo-' : '───', isTie: i > 12 })),
    mainSteps: Array.from({ length: 36 }, (_, i) => ({ stepIndex: i, active: i < 4, note: 'C4', syllable: i === 0 ? 'vó' : '───', isTie: i > 0 })),
  },
  'puxador',
  3001,
  85,
  8
);
assert.equal(patternWithTail.steps, 32, 'Le débordement +1T (36 pas) ne doit jamais gonfler le nombre de mesures du cycle (steps doit rester 32 = 2M)');
assert.equal(patternWithTail.hasTailBeat, true, 'hasTailBeat doit être préservé pour laisser résonner la chute +1T sur le slot suivant');
console.log(`✓ Point 2 validé : Formule canonique when = ${when.toFixed(3)}s exacte et chute +1T (hasTailBeat) sans gonflement de mesures.`);

console.log('\n=== POINT 3 : BASCULE MULTI-VITESSES (75%, 88%, 100%) + PLAYBACKRATE & BASCULE DE TONALITÉ ===');
const variantKeys = ['spd75_pit0', 'spd88_pit0', 'spd100_pit0'];
const baseRecBpm = 88;

// 1. Seuil < 81% (ex: 68 BPM / 88 BPM = 77.27%) -> fichier 75% (variantRecordedBpm = 66 BPM)
const sel75 = selectBestVocalVariant(variantKeys, 68, baseRecBpm, 0);
assert.equal(sel75.bestKey, 'spd75_pit0', 'Sous 81% du BPM de base, doit sélectionner le fichier 75%');
assert.ok(Math.abs(sel75.residualPlaybackRate - (68 / (88 * 0.75))) < 1e-5, 'playbackRate doit valoir currentBpm / variantRecordedBpm');

// 2. Seuil 81%..94% (ex: 76 BPM / 88 BPM = 86.36%) -> fichier 88% (variantRecordedBpm = 77.44 BPM)
const sel88 = selectBestVocalVariant(variantKeys, 76, baseRecBpm, 0);
assert.equal(sel88.bestKey, 'spd88_pit0', 'Entre 81% et 94% du BPM de base, doit sélectionner le fichier 88%');
assert.ok(Math.abs(sel88.residualPlaybackRate - (76 / (88 * 0.88))) < 1e-5, 'playbackRate doit valoir currentBpm / variantRecordedBpm');

// 3. Seuil >= 94% (ex: 85 BPM / 88 BPM = 96.59%) -> fichier 100% (variantRecordedBpm = 88 BPM)
const sel100 = selectBestVocalVariant(variantKeys, 85, baseRecBpm, 0);
assert.equal(sel100.bestKey, 'spd100_pit0', 'À >= 94% du BPM de base, doit sélectionner le fichier 100%');
assert.ok(Math.abs(sel100.residualPlaybackRate - (85 / 88)) < 1e-5, 'playbackRate doit valoir currentBpm / variantRecordedBpm');

// 4. Bascule de Tonalité : à transpositionSemitones === pack.transpositionSemitones (+2 st), lecture directe du .wav principal (detuneCents === 0)
const dummyBaseBuffer = { duration: 4.0, sampleRate: 44100, length: 44100 * 4, numberOfChannels: 1 };
const ptnWithPackShift = {
  id: 4001,
  packTranspositionSemitones: 2,
  vocalClip: { packTranspositionSemitones: 2 },
};
const directResolved = resolveVocalPlaybackBuffer(
  ptnWithPackShift,
  { id: 10, tuning: 0 },
  88,
  88,
  dummyBaseBuffer,
  {},
  2 // transpositionSemitones === pack.transpositionSemitones (+2)
);
assert.equal(directResolved.buffer, dummyBaseBuffer, 'À transpositionSemitones === pack.transpositionSemitones, doit lire directement le .wav principal transposé par Cantador');
assert.equal(directResolved.detuneCents, 0, 'Aucun detune résiduel ne doit être appliqué au .wav déjà transposé par Cantador');
assert.equal(directResolved.playbackRate, 1.0);

// 5. Synchronisation de la nouvelle Tonalité Troupe (sungKey + transpositionSemitones -> troupeKey)
assert.equal(computeTransposedTroupeKey('Sib Majeur', 2), 'Do Majeur');
assert.equal(computeTransposedTroupeKey('Sib Majeur', 4), 'Ré Majeur');
const syncRes = await syncCloudToadaTransposition(undefined, 4, 'Sib Majeur');
assert.equal(syncRes.troupeKey, 'Ré Majeur');
assert.equal(syncRes.transpositionSemitones, 4);
console.log('✓ Point 3 validé : Seuils 75%/88%/100%, playbackRate exact, lecture directe à pack.transpositionSemitones et calcul Tonalité Troupe.');

console.log('\n=== POINT 4 : AFFICHAGE RODA & MIDI (ANACRUSISSTEPS, MAINSTEPS, IGNOREMELODYPITCH) ===');
// Mode "🥁 Rythme seul" (ignoreMelodyPitch: true) :
// - Garde les syllabes, les attaques (active: true) et les arcs continus de tenue (isTie: true / ───)
// - Masque les hauteurs de notes (notes[attack] === '') et coupe le synthétiseur MIDI
const rhythmOnlyPattern = convertToadaPattern(
  {
    id: 'pat_rhythm_only',
    name: 'Vovó falou (Rythme seul)',
    measuresCount: 1,
    hasAnacrusis: false,
    ignoreMelodyPitch: true,
    mainSteps: [
      { stepIndex: 0, active: true, isTie: false, note: 'G3', syllable: 'Vo-' },
      { stepIndex: 1, active: true, isTie: true,  note: 'G3', syllable: '───' },
      { stepIndex: 2, active: true, isTie: false, note: 'A3', syllable: 'vó ' },
      { stepIndex: 3, active: false, isTie: false, note: '', syllable: '' },
      ...Array.from({ length: 12 }, (_, i) => ({ stepIndex: i + 4, active: false, isTie: false, note: '', syllable: '' })),
    ],
  },
  'puxador',
  5001,
  85,
  4
);

assert.equal(rhythmOnlyPattern.ignoreMelodyPitch, true);
assert.equal(rhythmOnlyPattern.activeSteps[0], 'P', 'Attaque pas 0 active');
assert.equal(rhythmOnlyPattern.activeSteps[1], 'P', 'Tenue pas 1 active');
assert.equal(rhythmOnlyPattern.lyrics[0], 'Vo-', 'Syllabe pas 0 conservée');
assert.equal(rhythmOnlyPattern.lyrics[1], '───', 'Arc de tenue pas 1 conservé');
assert.equal(rhythmOnlyPattern.notes[0], '', 'Note masquée sur attaque en mode ignoreMelodyPitch');
assert.equal(rhythmOnlyPattern.notes[1], '───', 'Symbole de tenue conservé sur liaison pour tracer le ruban continu sur la Roda');

// Vérification de l'extraction Roda (extractSeparateVoiceStep + buildVoiceBlocks + getPatternWords)
const extractedRodaSteps = [];
for (let i = 0; i < 16; i++) {
  const s = extractSeparateVoiceStep(i, 16, rhythmOnlyPattern, null, null, null, rhythmOnlyPattern.activeSteps, null, null);
  const isProlongation = i > 0 && s.pActive && extractedRodaSteps[i - 1].active && s.pSyl === '───';
  extractedRodaSteps.push({ active: s.pActive, note: s.pNote, syl: s.pSyl, isProlongation, isAnacrusis: s.pAnacrusis });
}
const blocks = buildVoiceBlocks(extractedRodaSteps, 16);
assert.equal(blocks.length, 2, 'Doit produire 2 blocs sur la Roda : bloc [0..1] (attaque + tenue) et bloc [2..2]');
assert.equal(blocks[0].startIndex, 0);
assert.equal(blocks[0].endIndex, 1, 'Le bloc 0 doit s’étendre sur les pas 0 et 1 grâce à la liaison ───');

const karaokeWords = getPatternWords(rhythmOnlyPattern, false, 16);
assert.equal(karaokeWords.length, 1);
assert.equal(karaokeWords[0].fullWord, 'Vovó');
assert.equal(karaokeWords[0].syllables[0].note, undefined, 'Aucune hauteur de note ne doit être passée au Karaoké en mode ignoreMelodyPitch');
console.log('✓ Point 4 validé : Syllabes, attaques et arcs continus (───) affichés sur la Roda, hauteurs MIDI masquées et synthé coupé.');

console.log('\n🎉 CONTRAT CANTADOR -> SEQUENCIADOR (/toada_packs) VALIDÉ À 100 % !');

