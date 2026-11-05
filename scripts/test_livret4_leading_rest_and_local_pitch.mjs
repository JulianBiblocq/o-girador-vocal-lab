/**
 * test_livret4_leading_rest_and_local_pitch.mjs
 * Test de non-régression pour les 2 bugs critiques d'extraction MIDI & Syllabes au Livret 4 :
 * - BUG 1 : Temps commençant par '_' après le badge ([3]_ Negro _, [3]_ do _ o _, [1]_ Mais, [2]_ Trouxe)
 * - BUG 2 : Médiane tronquée locale à 20 % par brique (1:1 avec pitchCurve) sans écrasement mélodique
 */
import assert from 'node:assert/strict';
import { extractTimeAnchors, buildBeatLyricsMap, resolveFreshTimeAnchors } from '../src/utils/timeAnchorParser.ts';
import { extractInlineLineDirectives } from '../src/utils/toadaCardParser.ts';
import { computeTrimmedMedianMidi, recalibrateBricksToLocalPitchCurve } from '../src/audio/pitchStepSegmentation.ts';
import { quantizePitchToSteps } from '../src/audio/pitchToStepsQuantizer.ts';
import { applyLyricsSyllablesToSteps, reconstructWordsFromSteps } from '../src/utils/syllableAligner.ts';
import { upgradeStalePatternStepsIfNeeded } from '../src/audio/livretResetHelper.ts';

console.log('=== TEST LIVRET 4 : LEADING REST ([b]_) & LOCAL TRIMMED MEDIAN PITCH ===');

const rawLine = '*[3]_ Negro _ [4]vem _ de _ Lu[M1•1]anda _ [2]Trazen[3]_ do _ o _ [4]baque _ vir[M2•1]ado _ [2]nação*';
const dir = extractInlineLineDirectives(rawLine, 4);

assert.equal(dir.hasAnacrusis, true, 'La phrase doit avoir hasAnacrusis = true');
assert.equal(dir.anacrusisBeats, 2, 'La phrase commençant sur [3]_ doit avoir anacrusisBeats = 2');
assert.equal(dir.measuresCount, 2, 'La phrase doit compter 2 mesures principales (M1 et M2)');
assert.ok(dir.timeAnchors && dir.timeAnchors.length === 8, '8 ancres de temps doivent être extraites');

const aElanT3 = dir.timeAnchors.find((a) => a.measureOffset === 0 && a.beat === 3);
assert.ok(aElanT3, 'Ancre ELAN • T3 (measureOffset=0, beat=3) présente');
assert.equal(aElanT3.hasLeadingRest, true, 'ELAN • T3 ([3]_ Negro _) doit avoir hasLeadingRest = true');
assert.equal(aElanT3.isRest, false, 'ELAN • T3 ne doit pas être marquée comme silence complet');
assert.equal(aElanT3.isInitialRest, false, 'ELAN • T3 ne doit pas être marquée comme isInitialRest');
assert.deepEqual(aElanT3.syllables, ['Ne', 'gro '], 'Syllabes de ELAN • T3 = ["Ne", "gro "]');

const aM1T3 = dir.timeAnchors.find((a) => a.measureOffset === 1 && a.beat === 3);
assert.ok(aM1T3, 'Ancre M1 • T3 (measureOffset=1, beat=3) présente');
assert.equal(aM1T3.hasLeadingRest, true, 'M1 • T3 ([3]_ do _ o _) doit avoir hasLeadingRest = true');
assert.equal(aM1T3.isRest, false, 'M1 • T3 ne doit pas être isRest');
assert.equal(aM1T3.isSustainedHold, false, 'M1 • T3 ne doit pas être isSustainedHold');
assert.deepEqual(aM1T3.syllables, ['do ', 'o '], 'Syllabes de M1 • T3 = ["do ", "o "]');

// Vérification des autres cas ([1]_ Mais, [2]_ Trouxe _ a _, [1]_ Es[2]trela)
const dirMais = extractTimeAnchors('[1]_ Mais _ [2]forte', 4);
assert.equal(dirMais.timeAnchors[0].hasLeadingRest, true);
assert.deepEqual(dirMais.timeAnchors[0].syllables, ['Mais ']);

const dirEstrela = extractTimeAnchors('[1]_ Es[2]trela', 4);
assert.equal(dirEstrela.timeAnchors[0].hasLeadingRest, true);
assert.deepEqual(dirEstrela.timeAnchors[0].syllables, ['Es ']);
assert.equal(dirEstrela.timeAnchors[1].hasLeadingRest, false);
assert.deepEqual(dirEstrela.timeAnchors[1].syllables, ['tre', 'la ']);

// Construction d'une courbe de pitch verte fidèle à De Norte a Sul (BPM = 120 => beatDur = 0.5s, stepDur = 0.125s)
const bpm = 120;
const beatDur = 60 / bpm; // 0.5s
const stepDur = beatDur / 4; // 0.125s
const t1OffsetSec = 4 * beatDur; // 2.0s (fin de ELAN, début de M1•T1)
const totalDurationSec = 14 * beatDur;

// Table de hauteurs MIDI cibles par pas (0..43) sur la courbe verte :
// ELAN•T1..T2 (0..7) : muet
// ELAN•T3 (8..11) : s=0 (8) muet, s=1 (9) = B3(59), s=2..3 (10..11) = B3(59)
// ELAN•T4 (12..15) : s=0 (12) = C4(60), s=1 (13) = B3(59), s=2..3 (14..15) = B3(59)
// M1•T1 (16..19) : s=0..1 (16..17) = A3(57), s=2..3 (18..19) = G#3(56)
// M1•T2 (20..23) : s=0..1 (20..21) = G#3(56), s=2..3 (22..23) = G#3(56)
// M1•T3 (24..27) : s=0 (24) = G#3(56, tenue de zen), s=1 (25) = G3(55, do), s=2..3 (26..27) = G3(55, o)
// M1•T4 (28..31) : s=0 (28) = G3(55, ba-), s=1 (29) = G3(55, que), s=2..3 (30..31) = G3(55, vir)
// M2•T1 (32..35) : s=0..1 (32..33) = A3(57, a-), s=2..3 (34..35) = F3(53, do)
// M2•T2 (36..39) : s=0..1 (36..37) = E3(52, na-), s=2..3 (38..39) = E3(52, ção)
const stepMidiMap = new Map([
  [9, 59], [10, 59], [11, 59],
  [12, 60], [13, 59], [14, 59], [15, 59],
  [16, 57], [17, 57], [18, 56], [19, 56],
  [20, 56], [21, 56], [22, 56], [23, 56],
  [24, 56], [25, 55], [26, 55], [27, 55],
  [28, 55], [29, 55], [30, 55], [31, 55],
  [32, 57], [33, 57], [34, 53], [35, 53],
  [36, 52], [37, 52], [38, 52], [39, 52],
]);

const pitchCurve = [];
for (const [sIdx, midi] of stepMidiMap.entries()) {
  const sStart = sIdx * stepDur;
  // 10 points par pas (toutes les 12.5 ms) avec scoop d'attaque aux extrémités pour vérifier la médiane tronquée 20%
  for (let p = 0; p < 10; p++) {
    const t = sStart + (p + 0.5) * (stepDur / 10);
    const outlier = p === 0 ? -1.8 : p === 9 ? +1.6 : 0;
    pitchCurve.push({ timeSec: t, freqHz: 440 * Math.pow(2, (midi + outlier - 69) / 12), midiFloat: midi + outlier, confidence: 0.95 });
  }
}

const q = quantizePitchToSteps({
  pitchCurve,
  bpm,
  beatsPerMeasure: 4,
  measuresCount: 2,
  beatResolutions: [4, 4, 4, 4],
  trimStartSec: 0,
  trimEndSec: totalDurationSec,
  hasAnacrusis: true,
  t1OffsetSec,
  smoothingLevel: 0.15,
  tonic: 'C',
  scaleType: 'chromatic',
  timeAnchors: dir.timeAnchors,
});

const rawSteps = [...q.anacrusisSteps, ...q.gridSteps];
const aligned = applyLyricsSyllablesToSteps(rawSteps, dir.cleanText, dir.timeAnchors, 4, 4);
const finalSteps = recalibrateBricksToLocalPitchCurve(aligned, pitchCurve, 0, stepDur, 'C', 'chromatic');

// 1. Vérification ELAN • T3 (pas 8..11) : [3]_ Negro _
assert.equal(finalSteps[8].active, false, 'ELAN•T3 s=0 (pas 8) doit être en silence (_)');
assert.equal(finalSteps[9].active, true, 'ELAN•T3 s=1 (pas 9) doit être actif');
assert.equal(finalSteps[9].syllable, 'Ne', 'ELAN•T3 s=1 doit porter la syllabe "Ne"');
assert.equal(finalSteps[9].note, 'B3', 'ELAN•T3 s=1 ("Ne") doit suivre la courbe verte à B3');
assert.equal(finalSteps[10].active, true, 'ELAN•T3 s=2 (pas 10) doit être actif');
assert.equal(finalSteps[10].syllable, 'gro ', 'ELAN•T3 s=2 doit porter la syllabe "gro "');
assert.equal(finalSteps[10].note, 'B3', 'ELAN•T3 s=2 ("gro ") doit suivre la courbe verte à B3');
assert.equal(finalSteps[11].note, '───', 'ELAN•T3 s=3 (pas 11) doit prolonger "gro " en liaison ───');

// 2. Vérification ELAN • T4 (pas 12..15) : [4]vem _ de _ Lu
assert.equal(finalSteps[12].syllable, 'vem ', 'ELAN•T4 s=0 doit porter "vem "');
assert.equal(finalSteps[12].note, 'C4', 'ELAN•T4 s=0 ("vem ") doit être à C4');
assert.equal(finalSteps[13].syllable, 'de ', 'ELAN•T4 s=1 doit porter "de "');
assert.equal(finalSteps[13].note, 'B3', 'ELAN•T4 s=1 ("de ") doit être à B3');
assert.equal(finalSteps[14].syllable, 'Lu ', 'ELAN•T4 s=2 doit porter "Lu "');
assert.equal(finalSteps[14].note, 'B3', 'ELAN•T4 s=2 ("Lu ") doit être à B3');

// 3. Vérification M1 • T1 (pas 16..19) : [M1•1]anda _
assert.equal(finalSteps[16].syllable, 'an', 'M1•T1 s=0 doit porter "an"');
assert.equal(finalSteps[16].note, 'A3', 'M1•T1 s=0 ("an") doit suivre la descente à A3 (et non rester bloqué à A#3)');
assert.equal(finalSteps[18].syllable, 'da ', 'M1•T1 s=2 doit porter "da "');
assert.equal(finalSteps[18].note, 'G#3', 'M1•T1 s=2 ("da ") doit suivre la descente à G#3');

// 4. Vérification M1 • T2 (pas 20..23) & M1 • T3 (pas 24..27) : [2]Trazen[3]_ do _ o _
assert.equal(finalSteps[20].syllable, 'Tra', 'M1•T2 s=0 doit porter "Tra"');
assert.equal(finalSteps[22].syllable, 'zen ', 'M1•T2 s=2 doit porter "zen "');
assert.equal(finalSteps[24].active, true, 'M1•T3 s=0 (pas 24) doit être actif en tenue de "zen"');
assert.equal(finalSteps[24].note, '───', 'M1•T3 s=0 ([3]_) doit être une liaison ─── prolongeant "zen"');
assert.equal(finalSteps[25].syllable, 'do ', 'M1•T3 s=1 (pas 25) doit attaquer "do "');
assert.equal(finalSteps[25].note, 'G3', 'M1•T3 s=1 ("do ") doit être à G3');
assert.equal(finalSteps[26].syllable, 'o ', 'M1•T3 s=2 (pas 26) doit attaquer "o "');
assert.equal(finalSteps[26].note, 'G3', 'M1•T3 s=2 ("o ") doit être à G3');
assert.equal(finalSteps[27].note, '───', 'M1•T3 s=3 (pas 27) doit prolonger "o " en liaison ───');

// 5. Vérification M1 • T4 (pas 28..31) : [4]baque _ vir
assert.equal(finalSteps[28].syllable, 'ba', 'M1•T4 s=0 doit porter "ba"');
assert.equal(finalSteps[29].syllable, 'que ', 'M1•T4 s=1 doit porter "que "');
assert.equal(finalSteps[30].syllable, 'vir ', 'M1•T4 s=2 doit porter "vir "');

// 6. Vérification M2 • T1 (pas 32..35) & M2 • T2 (pas 36..39) : [M2•1]ado _ [2]nação
assert.equal(finalSteps[32].syllable, 'a', 'M2•T1 s=0 doit porter "a"');
assert.equal(finalSteps[32].note, 'A3', 'M2•T1 s=0 ("a") doit monter à A3 (et non être écrasé à G3)');
assert.equal(finalSteps[34].syllable, 'do ', 'M2•T1 s=2 doit porter "do "');
assert.equal(finalSteps[34].note, 'F3', 'M2•T1 s=2 ("do ") doit descendre à F3');
assert.equal(finalSteps[36].syllable, 'na', 'M2•T2 s=0 doit porter "na"');
assert.equal(finalSteps[36].note, 'E3', 'M2•T2 s=0 ("na") doit être à E3');
assert.equal(finalSteps[38].syllable, 'ção ', 'M2•T2 s=2 doit porter "ção "');
assert.equal(finalSteps[38].note, 'E3', 'M2•T2 s=2 ("ção ") doit être à E3');

assert.equal(
  reconstructWordsFromSteps(finalSteps).trim(),
  'Negro vem de Lu anda Trazen do o baque vir ado nação',
  'La reconstruction complète des paroles doit être 100 % intègre'
);

// 7. Vérification de l'auto-réparation des anciens projets sauvegardés (upgradeStalePatternStepsIfNeeded)
const staleSteps = finalSteps.map((s, idx) => (idx >= 8 && idx <= 11 ? { ...s, active: false, note: '', midiNumber: 0, syllable: '' } : s));
const upgraded = upgradeStalePatternStepsIfNeeded({
  rawDefaultSteps: staleSteps,
  expectedStepsCount: finalSteps.length,
  rawPitchCurve: pitchCurve,
  activePattern: { rawLineCode: rawLine, assignedLyricsText: dir.cleanText, timeAnchors: dir.timeAnchors },
  initialPack: { metadata: { bpm, beatResolutions: [4, 4, 4, 4] } },
  beatsPerMeasure: 4,
  measuresCount: 2,
  hasAnac: true,
  t1OffsetSec,
  resPerBeat: 4,
  totalDurationSec,
  tonic: 'C',
  scaleType: 'chromatic',
  rawPCM: new Float32Array(0),
  sampleRate: 44100,
});
assert.equal(upgraded[9].syllable, 'Ne', 'upgradeStalePatternStepsIfNeeded doit restaurer "Ne" sur ELAN•T3 s=1');
assert.equal(upgraded[10].syllable, 'gro ', 'upgradeStalePatternStepsIfNeeded doit restaurer "gro " sur ELAN•T3 s=2');

console.log('✅ TOUS LES TESTS LIVRET 4 (LEADING REST & LOCAL TRIMMED MEDIAN PITCH) SONTVERTS !');
