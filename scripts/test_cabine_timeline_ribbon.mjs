/**
 * test_cabine_timeline_ribbon.mjs
 * Vérifie la construction du Ruban des Mesures à Bille Rebondissante (Volet 1, Volet 2, Volet 3).
 */
import assert from 'node:assert/strict';
import { createDefaultToadaProject, createDefaultVocalPattern } from '../src/utils/toadaProjectDefaults.ts';
import { buildCabineTimelineMeasures, extractMeasureWaveform } from '../src/components/livret-prise/cabineTimelineDrawer.ts';
import { resolvePatternAnacrusisBeats } from '../src/utils/anacrusisTimingHelper.ts';

console.log('🧪 Test 1 : resolvePatternAnacrusisBeats...');
assert.equal(resolvePatternAnacrusisBeats({ hasAnacrusis: false }, 4), 0);
assert.equal(resolvePatternAnacrusisBeats({ hasAnacrusis: true, anacrusisBeats: 2 }, 4), 2);
assert.equal(
  resolvePatternAnacrusisBeats({
    hasAnacrusis: true,
    timeAnchors: [{ measureOffset: 0, beat: 4, isRest: false }],
  }, 4),
  1
);
console.log('✅ Test 1 OK');

console.log('🧪 Test 2 : Mode Ce bloc seul (avec Voix témoin + Anacrouse + Appel 2 temps)...');
const project = createDefaultToadaProject();
const cuePat = createDefaultVocalPattern('puxador', 'Puxador 1', 2);
const fakePcm = new Float32Array(48000 * 5);
for (let i = 0; i < fakePcm.length; i++) fakePcm[i] = Math.sin(i * 0.05) * 0.6;
cuePat.recordingResult = { pcm: fakePcm, sampleRate: 48000, recordedBpm: 96, t1OffsetSec: 2.5 };

const activePat = createDefaultVocalPattern('coro', 'Coro 1', 2);
activePat.hasAnacrusis = true;
activePat.anacrusisBeats = 2;
activePat.assignedLyricsText = 'Nagô Nagô';

const singleData = buildCabineTimelineMeasures({
  takeMode: 'pattern',
  project,
  activePattern: activePat,
  cuePattern: cuePat,
  beatsPerMeasure: 4,
});

// PreRoll = 1 + cuePat.measuresCount (2) = 3 mesures de précompte/témoin + 2 mesures chantées + 1 boîte +T1 = 6 boîtes
assert.equal(singleData.measures.length, 6);
assert.equal(singleData.measures[1].kind, 'cue');
assert.ok(singleData.measures[1].waveformBins && singleData.measures[1].waveformBins.length > 0, 'Forme d’onde témoin extraite');
// Anacrouse sur les temps 3-4 de la dernière mesure de précompte (mesure d’index 2, startBeatGlobal = 8)
assert.equal(singleData.measures[2].anacrusisStartBeatInMeasure, 3);
// Les 2 temps d'appel (1400 Hz) précèdent immédiatement l'entrée d'anacrouse (temps 1 et 2 de la mesure 2 => globalBeats 8 et 9)
assert.deepEqual(singleData.measures[2].callInBeatsInMeasure, [1, 2]);
assert.equal(singleData.isCallInBeat(8), true);
assert.equal(singleData.isCallInBeat(9), true);
assert.equal(singleData.isAnacrusisBeat(10), true);
assert.equal(singleData.isAnacrusisBeat(11), true);
assert.equal(singleData.isRecordingBeat(10), true);
console.log('✅ Test 2 OK');

console.log('🧪 Test 3 : Mode Continu (Tout le Coro avec Voix témoin Puxador active par défaut)...');
project.patterns = [cuePat, activePat];
project.slots = [
  { slotId: 's1', puxadorPatternId: cuePat.id, coroPatternId: null },
  { slotId: 's2', puxadorPatternId: null, coroPatternId: activePat.id },
];
const contData = buildCabineTimelineMeasures({
  takeMode: 'coro',
  project,
  activePattern: activePat,
  cuePattern: null,
  beatsPerMeasure: 4,
  counterRoleCueEnabled: true,
});
assert.ok(contData.measures.some((m) => m.kind === 'cue' && m.waveformBins && m.waveformBins.length > 0), 'Forme d’onde du contre-rôle présente');
assert.ok(contData.measures.some((m) => m.kind === 'sung' && m.role === 'coro'), 'Mesures chantées Coro présentes');
assert.equal(contData.measures[contData.measures.length - 1].label, '+T1');
console.log('✅ Test 3 OK');
console.log('🎉 TOUS LES TESTS DU RUBAN DES MESURES SONT PASSÉS AVEC SUCCÈS !');
