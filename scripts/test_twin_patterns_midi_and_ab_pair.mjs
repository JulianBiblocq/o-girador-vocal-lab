import './resolve-ts.mjs';
import assert from 'node:assert/strict';

const {
  normalizePatternLyricKey,
  findTwinPatterns,
  findTwinSlotIndices,
  assignSingleBestTwinToAll,
  assignTwinPairAB,
  copyMidiAndSyllablesToTwins,
} = await import('../src/utils/twinPatternsHelper.ts');

console.log('=== TEST: Twin Patterns Detection, Pair A/B Assignment & 1-Click MIDI/Syllable Copy ===');

function createDummyStep(stepIndex, note, active, isTie, syllable, tripletSlot) {
  return {
    stepIndex,
    note,
    midiNumber: 69,
    frequency: 440,
    active,
    isTie,
    syllable,
    lyric: syllable,
    tripletSlot,
  };
}

function createMockProject() {
  const pcm1 = new Float32Array([0.1, 0.2, 0.3]);
  const pcm2 = new Float32Array([0.9, 0.8, 0.7]);

  const pat1 = {
    id: 'pat-1',
    name: '#1 Vovó falou e o barão assinou',
    role: 'puxador',
    assignedLyricsText: '[1]Vo-vó [2]fa-lou [3]e o ba-[4]rão as-si-nou',
    measuresCount: 1,
    hasAnacrusis: true,
    anacrusisBeats: 1,
    hasTailBeat: true,
    foldNotesView: true,
    recordingResult: { pcm: pcm1, sampleRate: 44100, recordedBpm: 92, t1OffsetSec: 0.65 },
    rawAudioSamples: pcm1,
    t1OffsetSec: 0.65,
    trimStartSec: 0.05,
    trimEndSec: 3.2,
    rawPitchCurve: [{ timeSec: 0.1, frequency: 440, midi: 69, confidence: 0.95 }],
    anacrusisSteps: [
      createDummyStep(0, 'A4', true, false, 'Vo'),
      createDummyStep(1, 'A4', true, true, ''),
      createDummyStep(2, 'B4', true, false, 'vó'),
      createDummyStep(3, 'B4', true, true, ''),
    ],
    mainSteps: [
      createDummyStep(0, 'C#5', true, false, 'fa', 1),
      createDummyStep(1, 'D5', true, false, 'lou', 2),
      createDummyStep(2, 'E5', true, false, "e'o", 3),
      createDummyStep(3, '───', false, false, '', 'unused'),
    ],
  };

  const pat2 = {
    id: 'pat-2',
    name: '#2 Vovó falou e o barão assinou',
    role: 'puxador',
    assignedLyricsText: 'Vovó falou e o barão assinou!',
    measuresCount: 1,
    hasAnacrusis: false,
    recordingResult: { pcm: pcm2, sampleRate: 44100, recordedBpm: 92, t1OffsetSec: 0.78 },
    rawAudioSamples: pcm2,
    t1OffsetSec: 0.78,
    trimStartSec: 0.12,
    trimEndSec: 3.45,
    rawPitchCurve: [{ timeSec: 0.2, frequency: 445, midi: 69, confidence: 0.91 }],
    anacrusisSteps: [createDummyStep(0, '───', false, false, '')],
    mainSteps: [createDummyStep(0, 'G4', true, false, 'old')],
  };

  const pat3Coro = {
    id: 'pat-3',
    name: '#3 Estrela brilhante é Nação Nagô',
    role: 'coro',
    assignedLyricsText: 'Estrela brilhante é Nação Nagô',
    measuresCount: 1,
    hasAnacrusis: true,
    anacrusisSteps: [],
    mainSteps: [],
  };

  const pat4Coro = {
    id: 'pat-4',
    name: '#4 Estrela brilhante é Nação Nagô',
    role: 'coro',
    assignedLyricsText: 'Estrela brilhante é Nação Nagô',
    measuresCount: 1,
    hasAnacrusis: true,
    anacrusisSteps: [],
    mainSteps: [],
  };

  const pat5 = {
    id: 'pat-5',
    name: '#5 Vovó falou e o barão assinou',
    role: 'puxador',
    assignedLyricsText: '<u>Vovó</u> falou e o barão assinou',
    measuresCount: 1,
    hasAnacrusis: true,
    anacrusisSteps: [],
    mainSteps: [],
  };

  const pat6 = {
    id: 'pat-6',
    name: '#6 Vovó falou e o barão assinou',
    role: 'puxador',
    assignedLyricsText: 'vovó falou e o barão assinou',
    measuresCount: 1,
    hasAnacrusis: true,
    anacrusisSteps: [],
    mainSteps: [],
  };

  const slots = [
    { slotIndex: 0, puxadorPatternId: 'pat-1', coroPatternId: null }, // M1
    { slotIndex: 1, puxadorPatternId: 'pat-2', coroPatternId: null }, // M2
    { slotIndex: 2, puxadorPatternId: null, coroPatternId: 'pat-3' }, // M3
    { slotIndex: 3, puxadorPatternId: null, coroPatternId: 'pat-4' }, // M4
    { slotIndex: 4, puxadorPatternId: 'pat-5', coroPatternId: null }, // M5
    { slotIndex: 5, puxadorPatternId: 'pat-6', coroPatternId: null }, // M6
  ];

  return {
    id: 'proj-nago',
    title: 'Nação Nagô',
    bpm: 92,
    timeSignature: '4/4',
    activePatternId: 'pat-1',
    patterns: [pat1, pat2, pat3Coro, pat4Coro, pat5, pat6],
    slots,
  };
}

// 1. Test detection of the 4 "Vovó falou" twin patterns
const proj = createMockProject();
const twins = findTwinPatterns(proj, 'pat-1');
assert.equal(twins.length, 4, 'Should detect all 4 "Vovó falou" puxador twin patterns');
assert.deepEqual(
  twins.map((t) => t.id),
  ['pat-1', 'pat-2', 'pat-5', 'pat-6'],
  'Twins should be ordered according to conductor strip appearance'
);
const slotIndices = findTwinSlotIndices(proj, 'pat-1');
assert.deepEqual(slotIndices, [0, 1, 4, 5], 'Twin slots should be M1 (0), M2 (1), M5 (4), M6 (5)');
assert.equal(normalizePatternLyricKey(twins[0]), 'vovó falou e o barão assinou');
console.log('✓ 1. Detection of 4 "Vovó falou" twin patterns verified');

// 2. Test Pair A/B assignment: M1 = #1, M2 = #2, M5 = #1, M6 = #2
const projAB = assignTwinPairAB(proj, 'pat-1', 'pat-2');
assert.equal(projAB.slots[0].puxadorPatternId, 'pat-1', 'M1 should be assigned pat-1 (A)');
assert.equal(projAB.slots[1].puxadorPatternId, 'pat-2', 'M2 should be assigned pat-2 (B)');
assert.equal(projAB.slots[4].puxadorPatternId, 'pat-1', 'M5 should be assigned pat-1 (A)');
assert.equal(projAB.slots[5].puxadorPatternId, 'pat-2', 'M6 should be assigned pat-2 (B)');
console.log('✓ 2. Pair A/B assignment (M1=#1, M2=#2, M5=#1, M6=#2) verified');

// 3. Test Single Best Take assignment: all 4 occurrences use pat-1 and unused duplicates are cleaned
const projSingle = assignSingleBestTwinToAll(proj, 'pat-1');
assert.equal(projSingle.slots[0].puxadorPatternId, 'pat-1');
assert.equal(projSingle.slots[1].puxadorPatternId, 'pat-1');
assert.equal(projSingle.slots[4].puxadorPatternId, 'pat-1');
assert.equal(projSingle.slots[5].puxadorPatternId, 'pat-1');
assert.equal(
  projSingle.patterns.filter((p) => p.role === 'puxador').length,
  1,
  'Unused duplicate puxador patterns should be removed when keeping single best take'
);
console.log('✓ 3. Single best take assignment & duplicate cleanup verified');

// 4. Test 1-click Copy MIDI + Rhythm + Syllables from #1 to #2 while preserving #2's Audio & Timing
const projCopied = copyMidiAndSyllablesToTwins(proj, 'pat-1', ['pat-2']);
const updatedPat2 = projCopied.patterns.find((p) => p.id === 'pat-2');
const origPat2 = proj.patterns.find((p) => p.id === 'pat-2');

// Verify audio & timing of #2 are strictly untouched
assert.strictEqual(updatedPat2.recordingResult, origPat2.recordingResult, '#2 recordingResult must remain strictly unchanged');
assert.strictEqual(updatedPat2.recordingResult.pcm, origPat2.recordingResult.pcm, '#2 PCM buffer must remain strictly unchanged');
assert.equal(updatedPat2.t1OffsetSec, 0.78, '#2 t1OffsetSec must remain strictly unchanged (0.78s)');
assert.equal(updatedPat2.trimStartSec, 0.12, '#2 trimStartSec must remain strictly unchanged');
assert.equal(updatedPat2.trimEndSec, 3.45, '#2 trimEndSec must remain strictly unchanged');
assert.strictEqual(updatedPat2.rawPitchCurve, origPat2.rawPitchCurve, '#2 rawPitchCurve must remain strictly unchanged');

// Verify MIDI notes, rhythm (ties & triplets), and syllables ("e'o") were deep-copied from #1
assert.equal(updatedPat2.anacrusisSteps.length, 4, '#2 anacrusisSteps should match #1');
assert.equal(updatedPat2.anacrusisSteps[0].note, 'A4');
assert.equal(updatedPat2.anacrusisSteps[0].syllable, 'Vo');
assert.equal(updatedPat2.anacrusisSteps[1].isTie, true);
assert.equal(updatedPat2.anacrusisSteps[2].syllable, 'vó');

assert.equal(updatedPat2.mainSteps.length, 4, '#2 mainSteps should match #1');
assert.equal(updatedPat2.mainSteps[0].note, 'C#5');
assert.equal(updatedPat2.mainSteps[0].syllable, 'fa');
assert.equal(updatedPat2.mainSteps[0].tripletSlot, 1);
assert.equal(updatedPat2.mainSteps[1].note, 'D5');
assert.equal(updatedPat2.mainSteps[1].syllable, 'lou');
assert.equal(updatedPat2.mainSteps[1].tripletSlot, 2);
assert.equal(updatedPat2.mainSteps[2].note, 'E5');
assert.equal(updatedPat2.mainSteps[2].syllable, "e'o", 'Merged syllable "e\'o" must be copied intact');
assert.equal(updatedPat2.mainSteps[2].tripletSlot, 3);
assert.equal(updatedPat2.mainSteps[3].tripletSlot, 'unused');

assert.equal(updatedPat2.hasAnacrusis, true);
assert.equal(updatedPat2.anacrusisBeats, 1);
assert.equal(updatedPat2.hasTailBeat, true);
assert.equal(updatedPat2.foldNotesView, true);
assert.equal(updatedPat2.isMidiInitialized, true);

// Verify deep clone independence (mutating #2 step does not mutate #1 step)
updatedPat2.mainSteps[2].syllable = 'mutated';
assert.equal(projCopied.patterns.find((p) => p.id === 'pat-1').mainSteps[2].syllable, "e'o");

console.log('✓ 4. 1-Click MIDI, Rhythm & Syllables ("e\'o") copy to twin while preserving target Audio & t1OffsetSec verified');
console.log('ALL TWIN PATTERNS TESTS PASSED SUCCESSFULLY!');
