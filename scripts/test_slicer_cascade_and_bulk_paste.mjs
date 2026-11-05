/**
 * test_slicer_cascade_and_bulk_paste.mjs
 * Test E2E unitaire & inter-dépôts :
 * 1. Organizador : Collage multi-lignes, [PAUSE XM] / [SILENCE XM], réordonnancement et recalcul [M•1].
 * 2. Cantador Slicer : Insertion de [PAUSE 1M] entre #2 et #3 sur "De Norte a Sul",
 *    recul automatique en cascade des tranches #3 à #8 (+1M) avec conservation des targetPatternId,
 *    Drag & Drop / [▲][▼] en cascade, et boutons rapides [◀ -1M] / [+1M ▶].
 */
import assert from 'node:assert/strict';
import {
  getMeasureDurationSec,
  insertPauseInSlices,
  shiftSliceAndFollowingByMeasures,
  reorderSlicesWithCascade,
  updatePauseMeasuresWithCascade,
  deleteSliceWithCascade,
} from '../src/utils/slicerCascadeHelper.ts';
import { buildOrganizadorSlices } from '../src/utils/slicerAlignmentHelper.ts';
import {
  parseStructureTxt,
} from '../../o-girador-organizador/src/utils/toadaTwoLineConverter.js';
import {
  computeSongStructure,
} from '../../o-girador-organizador/src/utils/toadaLineEditorHelper.js';

console.log('=== TEST 1 : ORGANIZADOR — COLLAGE MULTI-LIGNES & [PAUSE XM] SUR DE NORTE A SUL ===');
const rawPastedSong = `
*[3]De norte a [1]sul [3]deste pa[1]ís*
[3]De norte a [1]sul [3]deste pa[1]ís
[SILENCE 1M]
*[3]Trouxe [1]meu baque [3]de [1]roda*
[3]A ma[1]raca [3]e o gongu[1]ê
*[3]Mais [1]forte [3]do que [1]nunca*
[3]Estre[1]la [3]de [1]ouro
*[3]É [1]maraca[3]tu*
[3]Sou [1]norte e [3]sul
`;

const parsedLines = parseStructureTxt(rawPastedSong);
assert.equal(parsedLines.length, 9, 'Le collage multi-lignes doit produire 9 cartes (8 phrases + 1 Pause Baque)');
assert.equal(parsedLines[2], '[PAUSE 1M]', '[SILENCE 1M] doit être normalisé en [PAUSE 1M]');

const structWithoutPause = computeSongStructure(parsedLines.filter((l) => l !== '[PAUSE 1M]'), '4/4');
const structWithPauseAt3 = computeSongStructure(parsedLines, '4/4');
assert.equal(structWithPauseAt3.lineDetails[2].isPauseBaque, true, 'La carte #3 doit être reconnue comme Pause Baque');
assert.equal(structWithPauseAt3.lineDetails[2].pauseMeasures, 1, 'La Pause Baque doit durer 1 mesure');
const trouxeMeasureBefore = Object.values(structWithoutPause.lineDetails[2].charMeasureNums)[0];
const trouxeMeasureAfter = Object.values(structWithPauseAt3.lineDetails[3].charMeasureNums)[0];
assert.equal(trouxeMeasureAfter, trouxeMeasureBefore + 1, 'Après [PAUSE 1M] en #3, la phrase "Trouxe" doit reculer exactement de +1 mesure');
assert.equal(structWithPauseAt3.totalMeasures, structWithoutPause.totalMeasures + 1, 'Le total des mesures doit augmenter de +1M');
console.log('✓ Collage multi-lignes Organizador + [PAUSE 1M] + recalcul immédiat M1..M6 validés.');

console.log('\n=== TEST 2 : CANTADOR SLICER — INSERTION & DÉPLACEMENT EN CASCADE SUR DE NORTE A SUL ===');
const bpm = 88;
const gridOffsetSec = 0.8;
const measureDur = getMeasureDurationSec(bpm);

const deNortePatterns = [
  { id: 'pat_1_de_norte_pux', name: 'De norte a sul (Pux)', role: 'puxador', measuresCount: 2, hasAnacrusis: true, anacrusisBeats: 2 },
  { id: 'pat_2_de_norte_coro', name: 'De norte a sul (Coro)', role: 'coro', measuresCount: 2, hasAnacrusis: true, anacrusisBeats: 2 },
  { id: 'pat_3_trouxe', name: 'Trouxe', role: 'puxador', measuresCount: 2, hasAnacrusis: true, anacrusisBeats: 2 },
  { id: 'pat_4_a_maraca', name: 'A maraca', role: 'coro', measuresCount: 2, hasAnacrusis: true, anacrusisBeats: 2 },
  { id: 'pat_5_mais', name: 'Mais', role: 'puxador', measuresCount: 2, hasAnacrusis: true, anacrusisBeats: 2 },
  { id: 'pat_6_estrela', name: 'Estrela', role: 'coro', measuresCount: 2, hasAnacrusis: true, anacrusisBeats: 2 },
  { id: 'pat_7_e', name: 'É', role: 'puxador', measuresCount: 1, hasAnacrusis: true, anacrusisBeats: 2 },
  { id: 'pat_8_sou', name: 'Sou', role: 'coro', measuresCount: 1, hasAnacrusis: true, anacrusisBeats: 2 },
];

// Construire les 8 tranches initiales (sans pause) assignées aux 8 blocs
const initialSlices = deNortePatterns.map((p, idx) => {
  const prevMeasures = deNortePatterns.slice(0, idx).reduce((acc, item) => acc + item.measuresCount, 0);
  const t1 = Math.round((gridOffsetSec + prevMeasures * measureDur) * 100) / 100;
  const beatDur = 60 / bpm;
  return {
    id: `slice_${idx + 1}`,
    startSec: Math.round((t1 - 2 * beatDur) * 100) / 100,
    endSec: Math.round((t1 + p.measuresCount * measureDur + 0.5 * beatDur) * 100) / 100,
    metricT1Sec: t1,
    targetPatternId: p.id,
    role: p.role,
    name: p.name,
    measuresCount: p.measuresCount,
    hasAnacrusis: true,
    anacrusisBeats: 2,
    hasTailBeat: true,
  };
});

// 2.A — Insérer une [PAUSE 1M] directement entre #2 (index 1) et #3 Trouxe (index 2)
const withInsertedPause = insertPauseInSlices(initialSlices, 2, 1, bpm, gridOffsetSec);
assert.equal(withInsertedPause.length, 9, 'La liste doit contenir 9 éléments après insertion de la Pause 1M');
assert.equal(withInsertedPause[2].isPause, true, "L'élément à l'index 2 doit être la Pause Baque 1M");
assert.equal(withInsertedPause[2].measuresCount, 1);
assert.equal(withInsertedPause[2].targetPatternId, 'ignore');

// Vérifier que #1 et #2 n'ont pas bougé
assert.equal(withInsertedPause[0].metricT1Sec, initialSlices[0].metricT1Sec);
assert.equal(withInsertedPause[1].metricT1Sec, initialSlices[1].metricT1Sec);

// Vérifier que #3 Trouxe .. #8 Sou ont toutes reculé de +1M (+measureDur) et conservé leur targetPatternId !
for (let k = 2; k < initialSlices.length; k++) {
  const beforeSeg = initialSlices[k];
  const afterSeg = withInsertedPause[k + 1];
  const expectedT1 = Math.round((beforeSeg.metricT1Sec + measureDur) * 100) / 100;
  const expectedStart = Math.round((beforeSeg.startSec + measureDur) * 100) / 100;
  assert.equal(afterSeg.targetPatternId, beforeSeg.targetPatternId, `La tranche #${k + 1} (${beforeSeg.name}) doit conserver son targetPatternId`);
  assert.ok(Math.abs(afterSeg.metricT1Sec - expectedT1) <= 0.02, `La tranche #${k + 1} (${beforeSeg.name}) doit reculer de +1M sur son T1`);
  assert.ok(Math.abs(afterSeg.startSec - expectedStart) <= 0.02, `La tranche #${k + 1} (${beforeSeg.name}) doit reculer de +1M sur son startSec`);
}
console.log('✓ Insertion directe de [PAUSE 1M] avant #3 Trouxe : #3 à #8 décalées de +1M avec targetPatternId intacts.');

// 2.B — Ajouter [PAUSE 1M] tout en bas (index 8) puis la remonter entre #2 et #3 (index 2) par Drag & Drop ou flèche [▲]
const withPauseAtEnd = insertPauseInSlices(initialSlices, 8, 1, bpm, gridOffsetSec);
const movedByDragDrop = reorderSlicesWithCascade(withPauseAtEnd, 8, 2, bpm);

let movedByArrows = [...withPauseAtEnd];
for (let pos = 8; pos > 2; pos--) {
  movedByArrows = reorderSlicesWithCascade(movedByArrows, pos, pos - 1, bpm);
}

for (let i = 0; i < 9; i++) {
  assert.equal(movedByDragDrop[i].targetPatternId, withInsertedPause[i].targetPatternId, `Drag&Drop index ${i} targetPatternId`);
  assert.ok(Math.abs(movedByDragDrop[i].metricT1Sec - withInsertedPause[i].metricT1Sec) <= 0.02, `Drag&Drop index ${i} metricT1Sec`);
  assert.ok(Math.abs(movedByArrows[i].metricT1Sec - withInsertedPause[i].metricT1Sec) <= 0.02, `Flèches [▲] index ${i} metricT1Sec`);
}
console.log('✓ Remontée de [PAUSE 1M] du bas vers #2/#3 (Drag & Drop et flèches ▲) : cascade 100 % identique.');

// 2.C — Boutons rapides [◀ -1M] / [+1M ▶] sur une tranche
const shiftedPlus1M = shiftSliceAndFollowingByMeasures(initialSlices, 2, 1, bpm);
for (let k = 2; k < initialSlices.length; k++) {
  assert.ok(Math.abs(shiftedPlus1M[k].metricT1Sec - (initialSlices[k].metricT1Sec + measureDur)) <= 0.02);
  assert.equal(shiftedPlus1M[k].targetPatternId, initialSlices[k].targetPatternId);
}
const shiftedBackMinus1M = shiftSliceAndFollowingByMeasures(shiftedPlus1M, 2, -1, bpm);
for (let k = 2; k < initialSlices.length; k++) {
  assert.ok(Math.abs(shiftedBackMinus1M[k].metricT1Sec - initialSlices[k].metricT1Sec) <= 0.02);
}
console.log('✓ Boutons rapides [◀ -1M] / [+1M ▶] : décalage en cascade bidirectionnel validé.');

// 2.D — Modification 1M -> 2M et suppression de la Pause avec cascade
const pause2M = updatePauseMeasuresWithCascade(withInsertedPause, 2, 2, bpm);
assert.equal(pause2M[2].measuresCount, 2);
assert.ok(Math.abs(pause2M[3].metricT1Sec - (initialSlices[2].metricT1Sec + 2 * measureDur)) <= 0.02);

const afterDeletePause = deleteSliceWithCascade(pause2M, 2, bpm, true);
assert.equal(afterDeletePause.length, 8);
for (let k = 0; k < 8; k++) {
  assert.ok(Math.abs(afterDeletePause[k].metricT1Sec - initialSlices[k].metricT1Sec) <= 0.02);
  assert.equal(afterDeletePause[k].targetPatternId, initialSlices[k].targetPatternId);
}
console.log('✓ Changement 1M -> 2M et suppression de Pause Baque avec retour en cascade validés.');
