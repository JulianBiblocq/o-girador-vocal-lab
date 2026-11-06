/**
 * scripts/test_mestre_guided_workflow.mjs
 * Validation automatisée du parcours Mestre « Pris par la Main » (Volets 1, 2, 3 et 4) :
 * 1. conductorRoleTimelineBuilder : génération exacte des trous du Coro (prise Tout le Puxador)
 *    et du trou initial du Puxador (prise Tout le Coro).
 * 2. Slicer Livret 3 (buildOrganizadorSlices) : mode 'with_gaps' (🕳️ Avec les trous) vs 'chained' (🔗 Phrases à la suite).
 * 3. Livret 4 : Placement 3 syllabes sur [0, 1, 3] (1-2-4) et presets 1-clic BeatRhythmPresetBar ([1-2-4], [1-3], [2-4]).
 */
import assert from 'node:assert/strict';
import { buildConductorRoleTimeline } from '../src/utils/conductorRoleTimelineBuilder.ts';
import { buildOrganizadorSlices } from '../src/utils/slicerAlignmentHelper.ts';
import { computeVowelOnsetStrength, scoreMaracatuSubBeatPattern } from '../src/audio/maracatuSubBeatAligner.ts';
import { applyBeatRhythmPreset } from '../src/components/livret-melodia/BeatRhythmPresetBar.tsx';

console.log('=== TEST 1 : conductorRoleTimelineBuilder (Trous Puxador & Coro) ===');
const mockProject = {
  id: 'proj-test',
  title: 'Luanda',
  bpm: 90,
  timeSignature: '4/4',
  activePatternId: 'pux1',
  patterns: [
    { id: 'pux1', name: 'Puxador 1', role: 'puxador', measuresCount: 2, hasAnacrusis: true, assignedLyricsText: 'Negro vem de Luanda' },
    { id: 'cor1', name: 'Coro 1', role: 'coro', measuresCount: 2, hasAnacrusis: false, assignedLyricsText: 'Baque virado nação' },
    { id: 'pux2', name: 'Puxador 2', role: 'puxador', measuresCount: 2, hasAnacrusis: true, assignedLyricsText: 'Trazendo a boneca' },
    { id: 'cor2', name: 'Coro 2', role: 'coro', measuresCount: 2, hasAnacrusis: false, assignedLyricsText: 'Estrela Brilhante' },
  ],
  slots: [
    { slotId: 's1', puxadorPatternId: 'pux1', coroPatternId: null, advanceMeasures: 2 },
    { slotId: 's2', puxadorPatternId: null, coroPatternId: 'cor1', advanceMeasures: 2 },
    { slotId: 's3', puxadorPatternId: 'pux2', coroPatternId: null, advanceMeasures: 2 },
    { slotId: 's4', puxadorPatternId: null, coroPatternId: 'cor2', advanceMeasures: 2 },
  ],
};

{
  // Timeline Puxador : Chante M1..M2 (slot 0), Trou Coro M3..M4 (slot 1, gap=2M), Chante M5..M6 (slot 2), Trou Coro M7..M8 (slot 3, gap=2M)
  const puxTimeline = buildConductorRoleTimeline(mockProject, 'puxador', 0, 1);
  assert.equal(puxTimeline.length, 4);
  assert.equal(puxTimeline[0].isRoleGap, false);
  assert.equal(puxTimeline[0].patternId, 'pux1');
  assert.equal(puxTimeline[0].startMeasure, 1);

  assert.equal(puxTimeline[1].isRoleGap, true, 'Le créneau 2 (Coro 1) doit être un Trou de Rôle pour le Puxador');
  assert.equal(puxTimeline[1].gapMeasures, 2, 'Le trou du Coro dure 2 mesures');
  assert.equal(puxTimeline[1].nextEntryMeasure, 5, 'La prochaine entrée Puxador est à la mesure 5');

  assert.equal(puxTimeline[2].isRoleGap, false);
  assert.equal(puxTimeline[2].patternId, 'pux2');
  assert.equal(puxTimeline[2].startMeasure, 5);

  // Timeline Coro : Trou initial Puxador M1..M2 (slot 0, gap=2M), Chante M3..M4 (slot 1), Trou Puxador M5..M6 (slot 2, gap=2M), Chante M7..M8 (slot 3)
  const coroTimeline = buildConductorRoleTimeline(mockProject, 'coro', 0, 1);
  assert.equal(coroTimeline[0].isRoleGap, true, 'Le créneau 1 (Puxador 1) doit être un Trou initial pour le Coro');
  assert.equal(coroTimeline[0].gapMeasures, 2, 'Le trou initial du Puxador dure 2 mesures');
  assert.equal(coroTimeline[0].nextEntryMeasure, 3, 'La première entrée du Coro est à la mesure 3');

  assert.equal(coroTimeline[1].isRoleGap, false);
  assert.equal(coroTimeline[1].patternId, 'cor1');
  assert.equal(coroTimeline[1].startMeasure, 3);
  console.log('  ✅ Test 1 OK : Trous Puxador/Coro exacts dans conductorRoleTimelineBuilder.');
}

console.log('=== TEST 2 : Slicer Livret 3 (Mode 🕳️ Avec les trous vs 🔗 Phrases à la suite) ===');
{
  const bpm = 90;
  const beatDur = 60 / bpm;
  const measureDur = beatDur * 4;
  const gridOffsetSec = 0.8;

  // 1) Puxador avec les trous ('with_gaps') : Pux1 à M1 (0.8s), Pause 2M à M3, Pux2 à M5 (0.8 + 4*measureDur)
  const puxSlicesWithGaps = buildOrganizadorSlices(
    mockProject.patterns, 'puxador', bpm, [], gridOffsetSec, mockProject.slots, null, 44100, 'with_gaps'
  );
  const puxVocalSlices = puxSlicesWithGaps.filter((s) => !s.isPause);
  const puxPauseSlices = puxSlicesWithGaps.filter((s) => s.isPause);
  assert.equal(puxVocalSlices.length, 2, '2 boîtes vocales Puxador');
  assert.equal(puxPauseSlices.length, 1, '1 boîte de trou du Chœur entre Puxador 1 et Puxador 2');
  assert.ok(Math.abs(puxVocalSlices[0].metricT1Sec - gridOffsetSec) < 0.02, 'Puxador 1 calé sur M1');
  assert.ok(
    Math.abs(puxVocalSlices[1].metricT1Sec - (gridOffsetSec + 4 * measureDur)) < 0.02,
    `Puxador 2 calé sur M5 après les 2M de Pux1 + 2M de trou Coro (attendu ${(gridOffsetSec + 4 * measureDur).toFixed(2)}s, obtenu ${puxVocalSlices[1].metricT1Sec.toFixed(2)}s)`
  );

  // 2) Coro avec les trous ('with_gaps') : Trou initial Puxador 2M à M1, Coro 1 à M3 (0.8 + 2*measureDur), Trou Puxador 2M à M5, Coro 2 à M7 (0.8 + 6*measureDur)
  const coroSlicesWithGaps = buildOrganizadorSlices(
    mockProject.patterns, 'coro', bpm, [], gridOffsetSec, mockProject.slots, null, 44100, 'with_gaps'
  );
  const coroVocalSlices = coroSlicesWithGaps.filter((s) => !s.isPause);
  assert.equal(coroVocalSlices.length, 2, '2 boîtes vocales Coro');
  assert.ok(
    Math.abs(coroVocalSlices[0].metricT1Sec - (gridOffsetSec + 2 * measureDur)) < 0.02,
    `Coro 1 calé sur M3 après le trou initial de 2M du Puxador (attendu ${(gridOffsetSec + 2 * measureDur).toFixed(2)}s, obtenu ${coroVocalSlices[0].metricT1Sec.toFixed(2)}s)`
  );
  assert.ok(
    Math.abs(coroVocalSlices[1].metricT1Sec - (gridOffsetSec + 6 * measureDur)) < 0.02,
    'Coro 2 calé sur M7 après le trou de 2M du Puxador 2'
  );

  // 3) Puxador en mode 'chained' (Phrases chantées à la suite sans attendre le Chœur)
  const puxSlicesChained = buildOrganizadorSlices(
    mockProject.patterns, 'puxador', bpm, [], gridOffsetSec, mockProject.slots, null, 44100, 'chained'
  );
  assert.equal(puxSlicesChained.filter((s) => s.isPause).length, 0, 'Aucun trou intermédiaire en mode chained');
  assert.ok(
    Math.abs(puxSlicesChained[1].metricT1Sec - (gridOffsetSec + 2 * measureDur)) < 0.02,
    'En mode chained, Puxador 2 suit directement Puxador 1 à M3'
  );
  console.log('  ✅ Test 2 OK : Slicer mode Avec les trous vs Phrases à la suite validé.');
}

console.log('=== TEST 3 : Livret 4 Sub-Temps Maracatu (1-2-4) & BeatRhythmPresetBar 1-clic ===');
{
  const emptyProfile = computeVowelOnsetStrength(undefined, undefined, [], 0, 0.65, 4);
  const res3 = scoreMaracatuSubBeatPattern({ syllableCount: 3, profile: emptyProfile, hasLeadingRest: false });
  assert.deepEqual(res3.subdivs, [0, 1, 3], '3 syllabes sans soupir initial => [0, 1, 3] (1-2-4)');

  const res3Rest = scoreMaracatuSubBeatPattern({ syllableCount: 3, profile: emptyProfile, hasLeadingRest: true });
  assert.deepEqual(res3Rest.subdivs, [1, 2, 3], '3 syllabes avec soupir initial => [1, 2, 3] (_2-3-4)');

  // Test BeatRhythmPresetBar (applyBeatRhythmPreset) sur le Temps 1 (steps 0..3) avec 3 syllabes "ba", "que", "vir"
  const steps = Array.from({ length: 8 }, (_, idx) => ({
    stepIndex: idx,
    active: idx < 3,
    isTie: false,
    note: 'C4',
    midiNumber: 60,
    syllable: idx === 0 ? 'ba' : idx === 1 ? 'que' : idx === 2 ? 'vir' : '',
  }));

  // Appliquer [1-2-4] ([0, 1, 3]) sur le temps 0
  const after124 = applyBeatRhythmPreset(steps, 0, [0, 1, 3], 4);
  assert.equal(after124[0].syllable, 'ba');
  assert.equal(after124[1].syllable, 'que');
  assert.equal(after124[2].note, '───', 'Step 2 est une tenue prolongée de que');
  assert.equal(after124[3].syllable, 'vir', 'Step 3 porte la 3e syllabe vir (4e double)');

  // Appliquer [1-3] ([0, 2]) sur ce même temps -> fusionne les syllabes excédentaires sur la 2e croche
  const after13 = applyBeatRhythmPreset(after124, 0, [0, 2], 4);
  assert.equal(after13[0].syllable, 'ba');
  assert.equal(after13[1].note, '───');
  assert.equal(after13[2].syllable, 'quevir');
  assert.equal(after13[3].note, '───');

  // Appliquer [2-4] ([1, 3]) -> step 0 devient silence, attaques sur steps 1 et 3
  const after24 = applyBeatRhythmPreset(after13, 0, [1, 3], 4);
  assert.equal(after24[0].active, false, 'Step 0 est en silence sur le preset syncopé [2-4]');
  assert.equal(after24[1].active, true);
  assert.equal(after24[1].syllable, 'ba');
  assert.equal(after24[2].note, '───');
  assert.equal(after24[3].active, true);
  assert.equal(after24[3].syllable, 'quevir');
  console.log('  ✅ Test 3 OK : Placement Maracatu [0, 1, 3] et presets 1-clic [1-2-4], [1-3], [2-4] validés.');
}

console.log('🎉 TOUS LES TESTS DU PARCOURS MESTRE GUIDÉ SONT VALIDÉS AVEC SUCCÈS !');
