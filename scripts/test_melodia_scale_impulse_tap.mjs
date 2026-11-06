import assert from 'node:assert/strict';
import {
  buildAllowedPitchClasses,
  detectBestScaleFromPitchCurve,
  snapMidiToScale,
} from '../src/audio/scaleQuantizer.ts';
import {
  mergeSyllablesToImpulseCount,
  joinSyllableWithPrevious,
  splitBrickAndSyllableAt,
} from '../src/utils/syllableImpulseMerger.ts';
import {
  estimateTapLatencySec,
  convertTapsToSteps,
  shiftAllStepsBySubdivision,
} from '../src/audio/RhythmTapCaptureEngine.ts';

console.log('--- TEST VOLETS 1, 2 & 3 : Gamme Maracatu, Syllabes Mangées & Tap Rythmique ---');

// 1. Test Volet 1 : Gamme Maracatu & snapMidiToScale
const cMajorSet = buildAllowedPitchClasses('C', 'major');
assert.equal(cMajorSet.size, 7, 'C major has 7 pitch classes');
assert.equal(snapMidiToScale(60.8, cMajorSet), 60, '60.8 (near C#4) snaps to C4 (60) in C major');
assert.equal(snapMidiToScale(61.3, cMajorSet), 62, '61.3 (near C#4) snaps to D4 (62) in C major');

const curveSolm = [
  { timeSec: 0.1, midiFloat: 55.05, confidence: 0.9 }, // G3
  { timeSec: 0.2, midiFloat: 55.02, confidence: 0.9 },
  { timeSec: 0.3, midiFloat: 58.04, confidence: 0.9 }, // Bb3
  { timeSec: 0.4, midiFloat: 60.01, confidence: 0.9 }, // C4
  { timeSec: 0.5, midiFloat: 62.03, confidence: 0.9 }, // D4
  { timeSec: 0.6, midiFloat: 65.02, confidence: 0.9 }, // F4
];
const detScale = detectBestScaleFromPitchCurve(curveSolm, 'Solm');
assert.equal(detScale.tonic, 'G', 'Detected tonic is G (Sol)');
assert.equal(detScale.allowedPitchClasses.has(10), true, 'G minor includes Bb (10)');
assert.equal(detScale.allowedPitchClasses.has(11), false, 'G natural minor excludes B natural (11)');

// 2. Test Volet 2 : Syllabes mangées & Fusion/Scission 1-clic
assert.deepEqual(
  mergeSyllablesToImpulseCount(['ba', 'que '], 1),
  ['baque '],
  '["ba", "que "] sur 1 impulsion -> ["baque "]'
);
assert.deepEqual(
  mergeSyllablesToImpulseCount(['Trou', 'xe ', 'a '], 2),
  ['Trouxe ', 'a '],
  '["Trou", "xe ", "a "] sur 2 impulsions -> ["Trouxe ", "a "]'
);

const stepsForJoin = [
  { stepIndex: 0, active: true, midiNumber: 60, note: 'C4', isTie: false, syllable: 'ba', velocity: 100, decay: 0.15 },
  { stepIndex: 1, active: true, midiNumber: 60, note: 'C4', isTie: false, syllable: 'que ', velocity: 100, decay: 0.15 },
  { stepIndex: 2, active: true, midiNumber: 62, note: 'D4', isTie: false, syllable: 'vir ', velocity: 100, decay: 0.15 },
  { stepIndex: 3, active: true, midiNumber: 62, note: '───', isTie: true, syllable: '', velocity: 90, decay: 0.15 },
];
const joined = joinSyllableWithPrevious(stepsForJoin, 1, 4);
assert.equal(joined[0].syllable, 'baque ', 'Joined syllable on step 0 is "baque "');
assert.equal(joined[1].note, '───', 'Step 1 prolonged as tie ───');
assert.equal(joined[1].isTie, true, 'Step 1 isTie === true');
assert.equal(joined[2].syllable, 'vir ', 'Step 2 ("vir ") untouched');

const splitAgain = splitBrickAndSyllableAt(joined, 0, 'ba que ');
assert.equal(splitAgain[0].syllable, 'ba', 'Split left syllable is "ba"');
assert.equal(splitAgain[1].isTie, false, 'Split step 1 is a new attack');
assert.equal(splitAgain[1].syllable, 'que ', 'Split right syllable is "que "');
assert.equal(splitAgain[2].syllable, 'vir ', 'Step 2 ("vir ") still untouched');

// 3. Test Volet 3 : RhythmTapCaptureEngine (Auto-latence + Maintiens + MIDI pitches + Shift ±1 double)
const sr = 1000;
const pcm = new Float32Array(3 * sr).fill(0.001);
// Onsets vocaux réels à 0.50s et 1.00s
for (let i = 500; i < 700; i++) pcm[i] = 0.3;
for (let i = 1000; i < 1400; i++) pcm[i] = 0.35;

// L'utilisateur tape avec +65ms de latence humaine et maintient la 2e note pendant 0.45s
const taps = [
  { onsetSec: 0.565, releaseSec: 0.65, midiNote: 64 },
  { onsetSec: 1.065, releaseSec: 1.52, midiNote: 67 },
];
const estLat = estimateTapLatencySec(taps, pcm, sr);
assert.ok(estLat >= 0.04 && estLat <= 0.09, `Estimated tap latency (${(estLat * 1000).toFixed(0)}ms) in [40ms, 90ms]`);

const emptyGrid = Array.from({ length: 16 }, (_, i) => ({
  stepIndex: i, active: false, midiNumber: 0, note: '', isTie: false, syllable: '', velocity: 0, decay: 0.125,
}));
const { steps: tappedSteps } = convertTapsToSteps({
  taps,
  existingSteps: emptyGrid,
  pitchCurve: [],
  pcm,
  sampleRate: sr,
  gridStartSec: 0,
  stepDurationSec: 0.125, // 1 double = 0.125s -> 0.50s = step 4, 1.00s = step 8 (tenue jusqu'à step 11)
  stepsPerBeat: 4,
  useMidiPitches: true,
  allowedPitchClasses: cMajorSet,
  lyricsText: 'Na-ção',
});

assert.equal(tappedSteps[4].active, true, 'Tap 1 aligned on step 4 (0.50s after latency compensation)');
assert.equal(tappedSteps[4].midiNumber, 64, 'Tap 1 took MIDI note 64 from MIDI keyboard');
assert.equal(tappedSteps[4].syllable, 'Na', 'Tap 1 received first syllable "Na"');

assert.equal(tappedSteps[8].active, true, 'Tap 2 aligned on step 8 (1.00s after latency compensation)');
assert.equal(tappedSteps[8].midiNumber, 67, 'Tap 2 took MIDI note 67 from MIDI keyboard');
assert.equal(tappedSteps[8].syllable.trim(), 'ção', 'Tap 2 received second syllable "ção"');
assert.equal(tappedSteps[9].note, '───', 'Tap 2 held tie on step 9');
assert.equal(tappedSteps[10].note, '───', 'Tap 2 held tie on step 10');

const shiftedLeft = shiftAllStepsBySubdivision(tappedSteps, -1);
assert.equal(shiftedLeft[3].midiNumber, 64, 'Shifted -1 double moves Tap 1 from step 4 to step 3');
assert.equal(shiftedLeft[7].midiNumber, 67, 'Shifted -1 double moves Tap 2 from step 8 to step 7');

console.log('✅ Tous les tests des Volets 1, 2 et 3 sont validés avec succès !');
