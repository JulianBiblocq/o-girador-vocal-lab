import './resolve-ts.mjs';
import assert from 'node:assert/strict';

const {
  getPatternUsageCount,
  estimatePatternMemoryBytes,
  getUnusedPatternsSummary,
  purgeUnusedPatternsFromProject,
} = await import('../src/utils/unusedPatternsPurger.ts');

const {
  copyPatternElements,
  copyPatternElementsInProject,
} = await import('../src/utils/patternModularCopier.ts');

console.log('=== TEST: Unused Patterns Purger & Modular Pattern Copier ===');

function makeStep(stepIndex, note, midiNumber, active, isTie, syllable, tripletSlot) {
  return {
    stepIndex,
    note,
    midiNumber,
    frequency: 440,
    active,
    isTie,
    syllable,
    lyric: syllable,
    tripletSlot,
  };
}

// ---------------------------------------------------------------------------
// 1. Test Unused Patterns Detection, MB Estimation & Purge
// ---------------------------------------------------------------------------
{
  // 262,144 samples * 4 bytes = 1,048,576 bytes = exactly 1.00 MB per buffer
  const oneMbPcmA = new Float32Array(262144);
  const oneMbPcmB = new Float32Array(262144);
  const twoMbPcmUnused1 = new Float32Array(524288); // 2.00 MB
  const oneMbPcmUnused2 = new Float32Array(262144); // 1.00 MB

  const project = {
    id: 'toada-test-purge',
    title: 'Nação Nagô',
    bpm: 92,
    timeSignature: '4/4',
    activePatternId: 'pat-unused-1',
    patterns: [
      {
        id: 'pat-1',
        name: '#1 Vovó falou (Prise 1)',
        role: 'puxador',
        assignedLyricsText: 'Vovó falou e o barão assinou',
        measuresCount: 1,
        recordingResult: { pcm: oneMbPcmA, sampleRate: 44100, recordedBpm: 92, t1OffsetSec: 0.5 },
        rawAudioSamples: oneMbPcmA,
      },
      {
        id: 'pat-2',
        name: '#2 Vovó falou (Prise 2)',
        role: 'puxador',
        assignedLyricsText: 'Vovó falou e o barão assinou',
        measuresCount: 1,
        recordingResult: { pcm: oneMbPcmB, sampleRate: 44100, recordedBpm: 92, t1OffsetSec: 0.6 },
        rawAudioSamples: oneMbPcmB,
      },
      {
        id: 'pat-unused-1',
        name: '#5 Vovó falou (Doublon inutilisé)',
        role: 'puxador',
        assignedLyricsText: 'Vovó falou e o barão assinou',
        measuresCount: 1,
        recordingResult: { pcm: twoMbPcmUnused1, sampleRate: 44100, recordedBpm: 92, t1OffsetSec: 0.5 },
        rawAudioSamples: twoMbPcmUnused1,
      },
      {
        id: 'pat-unused-2',
        name: '#6 Vovó falou (Doublon inutilisé 2)',
        role: 'puxador',
        assignedLyricsText: 'Vovó falou e o barão assinou',
        measuresCount: 1,
        recordingResult: { pcm: oneMbPcmUnused2, sampleRate: 44100, recordedBpm: 92, t1OffsetSec: 0.5 },
      },
    ],
    slots: [
      { slotIndex: 0, puxadorPatternId: 'pat-1', coroPatternId: null },
      { slotIndex: 1, puxadorPatternId: 'pat-2', coroPatternId: null },
      { slotIndex: 2, puxadorPatternId: 'pat-1', coroPatternId: null },
      { slotIndex: 3, puxadorPatternId: 'pat-2', coroPatternId: null },
    ],
  };

  assert.equal(getPatternUsageCount(project, 'pat-1'), 2, 'pat-1 is used 2x in slots');
  assert.equal(getPatternUsageCount(project, 'pat-2'), 2, 'pat-2 is used 2x in slots');
  assert.equal(getPatternUsageCount(project, 'pat-unused-1'), 0, 'pat-unused-1 has usageCount === 0');
  assert.equal(getPatternUsageCount(project, 'pat-unused-2'), 0, 'pat-unused-2 has usageCount === 0');

  assert.equal(estimatePatternMemoryBytes(project.patterns[2]), 524288 * 4, 'Deduplicates shared PCM pointer and returns exact byte length');

  const summary = getUnusedPatternsSummary(project);
  assert.equal(summary.count, 2, 'Should detect 2 unused patterns');
  assert.deepEqual(summary.unusedPatternIds, ['pat-unused-1', 'pat-unused-2']);
  assert.equal(summary.totalMegabytes, 3, '2 MB + 1 MB = 3.00 MB recoverable');
  assert.equal(summary.formattedMegabytes, '3.0');

  const purged = purgeUnusedPatternsFromProject(project);
  assert.equal(purged.updatedProject.patterns.length, 2, 'Only the 2 used patterns remain after purge');
  assert.deepEqual(purged.updatedProject.patterns.map((p) => p.id), ['pat-1', 'pat-2']);
  assert.equal(purged.updatedProject.activePatternId, 'pat-1', 'Active pattern switches to a kept pattern if previous active was purged');
  console.log('✓ 1. Unused patterns detection (usageCount === 0), MB calculation (3.0 Mo) & purge verified');
}

// ---------------------------------------------------------------------------
// 2. Test Modular Copier: 4 Combinations of { audio, midi, rhythm, syllables }
// ---------------------------------------------------------------------------
{
  const srcPcm = new Float32Array([0.11, 0.22, 0.33]);
  const tgtPcm = new Float32Array([0.88, 0.77, 0.66]);

  const source = {
    id: 'src-pat',
    name: '#1 Source Pattern',
    role: 'puxador',
    assignedLyricsText: 'Vo-vó fa-lou e o',
    assignedPhoneticText: 'vo-vo fa-low i u',
    measuresCount: 2,
    hasAnacrusis: true,
    anacrusisBeats: 1,
    hasTailBeat: true,
    exitBeat: 1,
    recordingResult: { pcm: srcPcm, sampleRate: 44100, recordedBpm: 92, t1OffsetSec: 0.42 },
    rawAudioSamples: srcPcm,
    t1OffsetSec: 0.42,
    trimStartSec: 0.05,
    trimEndSec: 3.10,
    rawPitchCurve: [{ timeSec: 0.1, midiFloat: 69, confidence: 0.9 }],
    anacrusisSteps: [
      makeStep(0, 'A4', 69, true, false, 'Vo'),
      makeStep(1, '───', 69, true, true, ''),
    ],
    mainSteps: [
      makeStep(0, 'C5', 72, true, false, 'vó', 1),
      makeStep(1, 'D5', 74, true, false, 'fa', 2),
      makeStep(2, 'E5', 76, true, false, "e'o", 3),
      makeStep(3, '───', 0, false, false, '', 'unused'),
    ],
  };

  const target = {
    id: 'tgt-pat',
    name: '#2 Target Pattern',
    role: 'puxador',
    assignedLyricsText: 'Na-ção Na-gô',
    assignedPhoneticText: 'na-saw na-go',
    measuresCount: 1,
    hasAnacrusis: false,
    recordingResult: { pcm: tgtPcm, sampleRate: 44100, recordedBpm: 92, t1OffsetSec: 0.85 },
    rawAudioSamples: tgtPcm,
    t1OffsetSec: 0.85,
    trimStartSec: 0.18,
    trimEndSec: 2.95,
    rawPitchCurve: [{ timeSec: 0.2, midiFloat: 64, confidence: 0.95 }],
    anacrusisSteps: [],
    mainSteps: [
      makeStep(0, 'E4', 64, true, false, 'Na'),
      makeStep(1, '───', 64, true, true, ''),
      makeStep(2, 'G4', 67, true, false, 'ção'),
      makeStep(3, 'A4', 69, true, false, 'Nagô'),
    ],
  };

  // Combo A: [ ] Audio (false), [x] Midi, [x] Rhythm, [x] Syllables
  const comboA = copyPatternElements(source, target, {
    audio: false,
    midi: true,
    rhythm: true,
    syllables: true,
  });
  assert.strictEqual(comboA.recordingResult, target.recordingResult, 'Combo A: target recordingResult preserved intact');
  assert.strictEqual(comboA.recordingResult.pcm, tgtPcm, 'Combo A: target PCM buffer preserved intact');
  assert.equal(comboA.t1OffsetSec, 0.85, 'Combo A: target t1OffsetSec (0.85s) preserved intact');
  assert.equal(comboA.trimStartSec, 0.18, 'Combo A: target trimStartSec preserved intact');
  assert.equal(comboA.trimEndSec, 2.95, 'Combo A: target trimEndSec preserved intact');
  assert.equal(comboA.measuresCount, 2, 'Combo A: rhythm structure copied from source');
  assert.equal(comboA.hasAnacrusis, true);
  assert.equal(comboA.anacrusisSteps[0].note, 'A4');
  assert.equal(comboA.anacrusisSteps[0].syllable, 'Vo');
  assert.equal(comboA.mainSteps[0].note, 'C5');
  assert.equal(comboA.mainSteps[0].tripletSlot, 1);
  assert.equal(comboA.mainSteps[2].syllable, "e'o");
  assert.equal(comboA.assignedLyricsText, 'Vo-vó fa-lou e o');
  console.log('✓ 2A. [ ] Audio + [x] Midi + [x] Rythme + [x] Syllabes preserves target audio/t1OffsetSec intact');

  // Combo B: [x] Audio (true), [ ] Midi, [ ] Rhythm, [ ] Syllables
  const comboB = copyPatternElements(source, target, {
    audio: true,
    midi: false,
    rhythm: false,
    syllables: false,
  });
  assert.strictEqual(comboB.recordingResult.pcm, srcPcm, 'Combo B: source PCM copied');
  assert.equal(comboB.t1OffsetSec, 0.42, 'Combo B: source t1OffsetSec copied');
  assert.equal(comboB.mainSteps.length, 4, 'Combo B: target steps preserved');
  assert.equal(comboB.mainSteps[0].note, 'E4', 'Combo B: target MIDI preserved');
  assert.equal(comboB.mainSteps[0].syllable, 'Na', 'Combo B: target syllables preserved');
  assert.equal(comboB.assignedLyricsText, 'Na-ção Na-gô');
  console.log('✓ 2B. [x] Audio only copies audio & timing while keeping target MIDI/rhythm/syllables');

  // Combo C: [ ] Audio, [x] Midi (true), [ ] Rhythm (false), [ ] Syllables (false)
  const comboC = copyPatternElements(source, target, {
    audio: false,
    midi: true,
    rhythm: false,
    syllables: false,
  });
  assert.equal(comboC.measuresCount, 1, 'Combo C: keeps target rhythm measuresCount');
  assert.equal(comboC.mainSteps[0].note, 'A4', 'Combo C: 1st target attack receives 1st source attack pitch (A4)');
  assert.equal(comboC.mainSteps[0].syllable, 'Na', 'Combo C: keeps target 1st syllable (Na)');
  assert.equal(comboC.mainSteps[1].isTie, true, 'Combo C: keeps target tie at step 1');
  assert.equal(comboC.mainSteps[1].midiNumber, 69, 'Combo C: tie propagates new pitch 69 (A4)');
  assert.equal(comboC.mainSteps[2].note, 'C5', 'Combo C: 2nd target attack receives 2nd source attack pitch (C5)');
  assert.equal(comboC.mainSteps[2].syllable, 'ção', 'Combo C: keeps target 2nd syllable (ção)');
  assert.equal(comboC.mainSteps[3].note, 'D5', 'Combo C: 3rd target attack receives 3rd source attack pitch (D5)');
  console.log('✓ 2C. [x] Midi only applies source attack pitches onto target rhythm & propagates ties');

  // Combo D: [ ] Audio, [ ] Midi (false), [x] Rhythm (true), [ ] Syllables (false)
  const comboD = copyPatternElements(source, target, {
    audio: false,
    midi: false,
    rhythm: true,
    syllables: false,
  });
  assert.equal(comboD.measuresCount, 2, 'Combo D: copies source rhythm measuresCount');
  assert.equal(comboD.anacrusisSteps.length, 2, 'Combo D: copies source anacrusis rhythm');
  assert.equal(comboD.mainSteps[0].tripletSlot, 1, 'Combo D: copies source triplet structure');
  assert.equal(comboD.anacrusisSteps[0].syllable, 'Na', 'Combo D: preserves target syllables on new attacks');
  assert.equal(comboD.mainSteps[0].syllable, 'ção');
  assert.equal(comboD.mainSteps[1].syllable, 'Nagô');
  console.log('✓ 2D. [x] Rythme only copies source attacks/ties/triplets while keeping target pitches & syllables');

  // Project-level copy to ALL_TWINS
  const mockProj = {
    id: 'proj-1',
    title: 'Test',
    bpm: 90,
    timeSignature: '4/4',
    activePatternId: 'src-pat',
    patterns: [
      source,
      { ...target, id: 'twin-pat', assignedLyricsText: 'Vo-vó fa-lou e o' },
    ],
    slots: [],
  };
  const projRes = copyPatternElementsInProject(mockProj, 'src-pat', 'ALL_TWINS', {
    audio: false,
    midi: true,
    rhythm: true,
    syllables: true,
  });
  assert.equal(projRes.count, 1);
  assert.equal(projRes.updatedProject.patterns[1].mainSteps[2].syllable, "e'o");
  assert.equal(projRes.updatedProject.patterns[1].t1OffsetSec, 0.85);
}

console.log('ALL MODULAR COPY & UNUSED PURGE TESTS PASSED SUCCESSFULLY!');
