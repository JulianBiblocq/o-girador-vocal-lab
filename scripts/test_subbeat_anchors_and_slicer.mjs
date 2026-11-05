import assert from 'node:assert/strict';
import { extractTimeAnchors } from '../src/utils/timeAnchorParser.ts';
import { alignSyllablesWithTimeAnchors, alignAudioStepsWithTimeAnchors } from '../src/utils/syllableAligner.ts';
import { computePatternVocalOffsetsBeats } from '../src/utils/subbeatAnchorHelper.ts';
import { buildOrganizadorSlices } from '../src/utils/slicerAlignmentHelper.ts';

console.log('--- TEST VOLET 1, 2 & 3 : Sub-beat Anchors, Syllables & Slicer ---');

// 1. Test #1: *[3]_ Negro _ [4]vem _ de _ Lu[M1•1]anda _ [2]Trazen[3]_ do _ o _ [4]baque _ vir[M2•1]ado _ [2]nação*
const raw1 = '*[3]_ Negro _ [4]vem _ de _ Lu[M1•1]anda _ [2]Trazen[3]_ do _ o _ [4]baque _ vir[M2•1]ado _ [2]nação*';
const { timeAnchors: anchors1, hasAnacrusis: hasAna1 } = extractTimeAnchors(raw1, 4, false);
assert.equal(hasAna1, true, '#1 hasAnacrusis === true');

// Note: in extractTimeAnchors, when hasAnacrusis === true:
// ELAN is measureOffset 0, M1 is measureOffset 1, M2 is measureOffset 2
const findAnchor = (list, m, b) => list.find((a) => a.measureOffset === m && a.beat === b);

// Verify Volet 1 sub-beat subdivisions on #1
assert.deepEqual(findAnchor(anchors1, 0, 3)?.syllableSubdivs, [1, 2], 'ELAN•T3 ([3]_ Negro _) => [1, 2]');
assert.deepEqual(findAnchor(anchors1, 0, 4)?.syllableSubdivs, [0, 2, 3], 'ELAN•T4 ([4]vem _ de _ Lu) => [0, 2, 3]');
assert.equal(findAnchor(anchors1, 0, 4)?.hasTrailingPickup, true, 'ELAN•T4 hasTrailingPickup');
assert.equal(findAnchor(anchors1, 1, 1)?.isDownbeatLocked, true, 'M1•T1 isDownbeatLocked');
assert.deepEqual(findAnchor(anchors1, 1, 1)?.syllableSubdivs, [0, 1], 'M1•T1 ([M1•1]anda _) => [0, 1]');
assert.deepEqual(findAnchor(anchors1, 1, 2)?.syllableSubdivs, [0, 2], 'M1•T2 ([2]Trazen) => [0, 2]');
assert.deepEqual(findAnchor(anchors1, 1, 3)?.syllableSubdivs, [1, 3], 'M1•T3 ([3]_ do _ o _) => [1, 3]');
assert.deepEqual(findAnchor(anchors1, 1, 4)?.syllableSubdivs, [0, 1, 3], 'M1•T4 ([4]baque _ vir) => [0, 1, 3]');
assert.equal(findAnchor(anchors1, 2, 1)?.isDownbeatLocked, true, 'M2•T1 isDownbeatLocked');
assert.deepEqual(findAnchor(anchors1, 2, 1)?.syllableSubdivs, [0, 1], 'M2•T1 ([M2•1]ado _) => [0, 1]');

// Verify Volet 2 syllable & MIDI brick alignment on #1
const baseSteps1 = Array.from({ length: 64 }, (_, i) => ({
  stepIndex: i,
  active: i >= 8 && i <= 39,
  midiNumber: 57,
  note: 'A3',
  velocity: 100,
  decay: 200,
  isTie: i > 8,
  syllable: '',
}));
const aligned1 = alignSyllablesWithTimeAnchors(baseSteps1, anchors1, 4, 4);

const syl = (st) => (st.syllable || '').trim();

// ELAN•T3 = steps 8..11: step 8 silent (leading rest at start of phrase), Ne at 9 (s=1), gro at 10 (s=2)
assert.equal(aligned1[8].active, false, 'ELAN•T3 s=0 must remain silent (leading rest at start of phrase)');
assert.equal(syl(aligned1[9]), 'Ne', 'Ne on ELAN•T3 s=1 (step 9)');
assert.equal(syl(aligned1[10]), 'gro', 'gro on ELAN•T3 s=2 (step 10)');

// ELAN•T4 = steps 12..15: vem at 12 (s=0), de at 14 (s=2), Lu at 15 (s=3)
assert.equal(syl(aligned1[12]), 'vem', 'vem on ELAN•T4 s=0 (step 12)');
assert.equal(syl(aligned1[14]), 'de', 'de on ELAN•T4 s=2 (step 14)');
assert.equal(syl(aligned1[15]), 'Lu', 'Lu on ELAN•T4 s=3 (step 15)');

// M1•T1 = steps 16..19: an at 16 (s=0), da at 17 (s=1)
assert.equal(syl(aligned1[16]), 'an', 'an on M1•T1 s=0 (step 16)');
assert.equal(syl(aligned1[17]), 'da', 'da on M1•T1 s=1 (step 17)');

// M1•T2 = steps 20..23: Tra at 20 (s=0), zen at 22 (s=2), tie at 23
assert.equal(syl(aligned1[20]), 'Tra', 'Tra on M1•T2 s=0 (step 20)');
assert.equal(syl(aligned1[22]), 'zen', 'zen on M1•T2 s=2 (step 22)');
assert.equal(aligned1[23].isTie, true, 'M1•T2 s=3 (step 23) tied from zen');

// M1•T3 = steps 24..27: step 24 (s=0) prolongs tie from zen! do at 25 (s=1), o at 27 (s=3)
assert.equal(aligned1[24].active, true, 'M1•T3 s=0 (step 24) stays active (tied from zen)');
assert.equal(aligned1[24].isTie, true, 'M1•T3 s=0 (step 24) isTie=true');
assert.equal(aligned1[24].note, '───', 'M1•T3 s=0 (step 24) note="───"');
assert.equal(syl(aligned1[25]), 'do', 'do on M1•T3 s=1 (step 25)');
assert.equal(syl(aligned1[27]), 'o', 'o on M1•T3 s=3 (step 27)');

// M1•T4 = steps 28..31: ba at 28 (s=0), que at 29 (s=1), vir at 31 (s=3)
assert.equal(syl(aligned1[28]), 'ba', 'ba on M1•T4 s=0 (step 28)');
assert.equal(syl(aligned1[29]), 'que', 'que on M1•T4 s=1 (step 29)');
assert.equal(syl(aligned1[31]), 'vir', 'vir on M1•T4 s=3 (step 31)');

// M2•T1 = steps 32..35: a at 32 (s=0), do at 33 (s=1)
assert.equal(syl(aligned1[32]), 'a', 'a on M2•T1 s=0 (step 32)');
assert.equal(syl(aligned1[33]), 'do', 'do on M2•T1 s=1 (step 33)');

// Also check alignAudioStepsWithTimeAnchors produces identical exact placement
const audioAligned1 = alignAudioStepsWithTimeAnchors(baseSteps1, anchors1, 4, 4);
assert.equal(syl(audioAligned1[15]), 'Lu', 'Audio aligner: Lu on step 15');
assert.equal(syl(audioAligned1[16]), 'an', 'Audio aligner: an on step 16');
assert.equal(audioAligned1[24].isTie, true, 'Audio aligner: zen tie prolonged on step 24');
assert.equal(audioAligned1[24].note, '───', 'Audio aligner: zen tie note === "───" on step 24');
assert.equal(syl(audioAligned1[25]), 'do', 'Audio aligner: do on step 25');
assert.equal(syl(audioAligned1[27]), 'o', 'Audio aligner: o on step 27');
assert.equal(syl(audioAligned1[31]), 'vir', 'Audio aligner: vir on step 31');
assert.equal(syl(audioAligned1[32]), 'a', 'Audio aligner: a on step 32');

// 2. Test #6: *[1]_ Es[2]trela _ Bri[3]lhante* (without anacrusis)
const raw6 = '*[1]_ Es[2]trela _ Bri[3]lhante*';
const { timeAnchors: anchors6 } = extractTimeAnchors(raw6, 4, true);
assert.deepEqual(findAnchor(anchors6, 0, 1)?.syllableSubdivs, [3], 'M1•T1 ([1]_ Es) => [3]');
assert.deepEqual(findAnchor(anchors6, 0, 2)?.syllableSubdivs, [0, 1, 3], 'M1•T2 ([2]trela _ Bri) => [0, 1, 3]');

const baseSteps6 = Array.from({ length: 16 }, (_, i) => ({
  stepIndex: i,
  active: true,
  midiNumber: 60,
  note: 'C4',
  velocity: 100,
  decay: 200,
  isTie: true,
  syllable: '',
}));
const aligned6 = alignSyllablesWithTimeAnchors(baseSteps6, anchors6, 4, 4);
assert.equal(aligned6[0].active, false, '#6 step 0 silent');
assert.equal(aligned6[1].active, false, '#6 step 1 silent');
assert.equal(aligned6[2].active, false, '#6 step 2 silent');
assert.equal(syl(aligned6[3]), 'Es', 'Es on T1 s=3 (step 3)');
assert.equal(syl(aligned6[4]), 'tre', 'tre on T2 s=0 (step 4)');
assert.equal(syl(aligned6[5]), 'la', 'la on T2 s=1 (step 5)');
assert.equal(syl(aligned6[7]), 'Bri', 'Bri on T2 s=3 (step 7)');
assert.equal(syl(aligned6[8]), 'lhan', 'lhan on T3 s=0 (step 8)');

// 3. Test Volet 3: Vocal offsets & Slicer cut points (#4 -> #5 and #6 -> #7)
assert.equal(computePatternVocalOffsetsBeats(anchors1, true, 4, 2).firstVocalOffsetBeats, -1.75, '#1 firstVocalOffsetBeats == -1.75');

const raw5 = '*[1]_ Mais _ [2]_ Trouxe _ a _ [3]boneca _ [4]e _ o _ [M2•1]estandarte*';
const { timeAnchors: anchors5 } = extractTimeAnchors(raw5, 4, true);
assert.deepEqual(findAnchor(anchors5, 0, 1)?.syllableSubdivs, [2], '[1]_ Mais _ => [2]');
assert.deepEqual(findAnchor(anchors5, 0, 2)?.syllableSubdivs, [1, 2, 3], '[2]_ Trouxe _ a _ => [1, 2, 3]');
assert.equal(computePatternVocalOffsetsBeats(anchors5, false, 4, 2).firstVocalOffsetBeats, 0.5, '#5 firstVocalOffsetBeats == +0.50');

const raw7 = '*[1]_ [2]É _ a _ [3]nação _ [4]Estrela _ [M2•1]Brilhante*';
const { timeAnchors: anchors7 } = extractTimeAnchors(raw7, 4, true);
assert.equal(computePatternVocalOffsetsBeats(anchors7, false, 4, 2).firstVocalOffsetBeats, 1.0, '#7 firstVocalOffsetBeats == +1.00');

const bpm = 90; // beatDur = 0.6667s, measureDur = 2.6667s
const beatDur = 60 / bpm;
const sampleRate = 1000;
const pcm = new Float32Array(40 * sampleRate).fill(0.25);

const patterns = [
  { id: 'p4', name: '#4', role: 'coro', measuresCount: 2, hasAnacrusis: false, rawLineCode: '*[1]Baque _ [2]virado _ [3]nação _ [4]forte*' },
  { id: 'p5', name: '#5', role: 'coro', measuresCount: 2, hasAnacrusis: false, rawLineCode: raw5 },
  { id: 'p6', name: '#6', role: 'coro', measuresCount: 1, hasAnacrusis: false, rawLineCode: raw6 },
  { id: 'p7', name: '#7', role: 'coro', measuresCount: 2, hasAnacrusis: false, rawLineCode: raw7 },
];

// Carve an energy dip at +0.55 beats after p7's T1 (p4=2M, p5=2M, p6=1M => p7 T1 is at gridOffset + 5 measures)
const gridOffsetSec = 0.8;
const p7T1Sec = gridOffsetSec + 5 * (4 * beatDur);
const dipCenterSec = p7T1Sec + 0.55 * beatDur;
for (let s = Math.floor((dipCenterSec - 0.05) * sampleRate); s <= Math.ceil((dipCenterSec + 0.05) * sampleRate); s++) {
  if (s >= 0 && s < pcm.length) pcm[s] = 0.001;
}

const slices = buildOrganizadorSlices(patterns, 'coro', bpm, [], gridOffsetSec, undefined, pcm, sampleRate);
const seg4 = slices[0], seg5 = slices[1], seg6 = slices[2], seg7 = slices[3];

const cut45Beats = (seg4.endSec - seg5.metricT1Sec) / beatDur;
assert.ok(cut45Beats < 0.50, `Cut #4/#5 (${cut45Beats.toFixed(2)} beats) must fall before +0.50 beats`);
assert.equal(seg4.endSec, seg5.startSec, 'Linked cut point between #4 and #5');

const cut67Beats = (seg6.endSec - seg7.metricT1Sec) / beatDur;
assert.ok(cut67Beats >= 0.30 && cut67Beats <= 0.90, `Cut #6/#7 (${cut67Beats.toFixed(2)} beats) must fall between +0.30 and +0.90 beats`);
assert.equal(seg6.endSec, seg7.startSec, 'Linked cut point between #6 and #7');

console.log('✅ Tous les tests Volet 1, Volet 2 et Volet 3 sont validés avec succès !');
