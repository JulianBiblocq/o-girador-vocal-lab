import assert from 'node:assert';
import {
  calculateSliceMetricT1Sec,
  splitSliceSegment,
  mergeAdjacentSliceSegments,
} from '../src/utils/slicerAlignmentHelper.ts';
import { createPaddedPreviewBuffer } from '../src/utils/wavEncoder.ts';
import { quantizePitchToSteps } from '../src/audio/pitchToStepsQuantizer.ts';
import { applyLyricsSyllablesToSteps, reconstructWordsFromSteps } from '../src/utils/syllableAligner.ts';
import { extractTimeAnchors } from '../src/utils/timeAnchorParser.ts';
import { findTargetMidiForRegion, computeCorrectedPitchCurve } from '../src/audio/melodynePitchCorrector.ts';
import { findRegionHandleAt } from '../src/components/livret-melodia/melodyneRegionInteractions.ts';

console.log('🧪 Test Étape 4 — Slicer Multi-Blocs, Alignement cleanPCM, Quantification MIDI/Syllabes & Géométrie Piano Roll / Melodyne...');

// ============================================================================
// 1. Stabilité de metricT1Sec, Scission splitSliceSegment & Fusion mergeAdjacentSliceSegments
// ============================================================================
const bpm = 88;
const beatDur = 60 / bpm; // ~0.6818s
const measureDur = 4 * beatDur; // ~2.7273s
const gridOffsetSec = 0.8;

// Bloc #2 avec T1 initial sur la mesure 3 (0.8 + 2 * measureDur = 6.2545s) et anacrouse de 2 temps
const initialT1 = gridOffsetSec + 2 * measureDur;
const initialStart = initialT1 - 2 * beatDur; // ~4.8909s

// Un micro-ajustement du point de coupe lié • de ±200ms ne doit PAS faire sauter metricT1Sec d'une mesure entière
const nudgedStartEarly = initialStart - 0.22;
const nudgedStartLate = initialStart + 0.25;
const t1Early = calculateSliceMetricT1Sec(nudgedStartEarly, bpm, gridOffsetSec, true, 2, initialT1);
const t1Late = calculateSliceMetricT1Sec(nudgedStartLate, bpm, gridOffsetSec, true, 2, initialT1);
assert.strictEqual(t1Early, initialT1, 'Un ajustement fin (-220ms) du point de coupe lié doit préserver metricT1Sec');
assert.strictEqual(t1Late, initialT1, 'Un ajustement fin (+250ms) du point de coupe lié doit préserver metricT1Sec');

// Test Scission [ ✂️ ] puis Fusion [ 🔗 ]
const baseSeg = {
  id: 'slice_test_1',
  startSec: initialStart,
  endSec: initialT1 + 2 * measureDur,
  targetPatternId: 'pat_1',
  role: 'puxador',
  name: 'Negro',
  hasAnacrusis: true,
  anacrusisBeats: 2,
  measuresCount: 2,
  metricT1Sec: initialT1,
};

const cutSec = initialT1 + measureDur;
const [partA, partB] = splitSliceSegment(baseSeg, cutSec, bpm, gridOffsetSec);
assert.strictEqual(partA.metricT1Sec, initialT1, 'La 1re moitié scindée doit conserver son metricT1Sec original');
assert.strictEqual(partA.endSec, Math.round(cutSec * 100) / 100, 'La 1re moitié doit finir au point de coupe');
assert.strictEqual(partB.startSec, Math.round(cutSec * 100) / 100, 'La 2e moitié doit commencer au point de coupe');
assert.strictEqual(partB.targetPatternId, 'new', 'La 2e moitié scindée doit cibler un nouveau bloc par défaut');
assert.ok(partB.metricT1Sec >= partB.startSec, 'La 2e moitié scindée doit avoir un metricT1Sec recalibré cohérent');

const mergedSeg = mergeAdjacentSliceSegments(partA, partB, bpm, gridOffsetSec);
assert.strictEqual(mergedSeg.startSec, partA.startSec, 'Le segment fusionné doit commencer au début de A');
assert.strictEqual(mergedSeg.endSec, partB.endSec, 'Le segment fusionné doit finir à la fin de B');
assert.strictEqual(mergedSeg.metricT1Sec, initialT1, 'Le segment fusionné doit conserver le metricT1Sec de A');
console.log('  ✅ 1. Stabilité metricT1Sec, Scission [ ✂️ ] et Fusion [ 🔗 ] validées.');

// ============================================================================
// 2. Alignement à l'échantillon près de rawT1OffsetSec ➔ cleanT1OffsetSec (destStartSec < 0)
// ============================================================================
const sr = 44100;
const rawDurationSec = 4.0;
const rawPCM = new Float32Array(sr * rawDurationSec);
const rawT1OffsetSec = 1.0; // Dans rawPCM, T1 est à t = 1.000s (échantillon 44100)
const trimStartSec = 0.50;  // Le trim commence 0.50s avant T1
const trimEndSec = 3.20;
const cleanT1OffsetSec = 0.15; // Sans anacrouse, T1 canonique est à 0.150s (échantillon 6615)
// destStartSec = 0.15 + (0.50 - 1.00) = -0.35s (< 0 !)

// On place une impulsion unique reconnaissable exactement sur l'échantillon T1 dans rawPCM
const rawT1Sample = Math.round(rawT1OffsetSec * sr);
rawPCM[rawT1Sample] = 0.95;

const cleanPCM = createPaddedPreviewBuffer(
  rawPCM, sr, 3.5, trimStartSec, trimEndSec, 0,
  false, false, false, // filtres désactivés pour vérifier l'échantillon exact
  rawT1OffsetSec, cleanT1OffsetSec
);

const expectedCleanT1Sample = Math.round(cleanT1OffsetSec * sr);
assert.ok(
  Math.abs(cleanPCM[expectedCleanT1Sample] - 0.95) < 1e-4,
  `L'échantillon T1 doit atterrir exactement à cleanT1OffsetSec (${expectedCleanT1Sample}), valeur lue=${cleanPCM[expectedCleanT1Sample]}`
);
console.log('  ✅ 2. Alignement sample-accurate rawT1OffsetSec ➔ cleanT1OffsetSec (destStartSec < 0) validé.');

// ============================================================================
// 3. Quantification MIDI + Alignement Syllabique guidé par timeAnchors (Silences, Multi-syllabes, Mélismes)
// ============================================================================
// Phrase test sans anacrouse (1 mesure 4/4) :
// Temps 1 : silence [1] _
// Temps 2 : 1 syllabe [2] Boi (chantée avec un mélisme de 2 notes : A4 puis G4)
// Temps 3 : 4 syllabes [3] o ba-que vir (chantées recto-tono sur une seule hauteur F4 = MIDI 65)
// Temps 4 : tenue [4] _ (prolongation sur F4 = MIDI 65)
const testLine = '[1] _ [2] Boi [3] o ba-que vir [4] _';
const anchorRes = extractTimeAnchors(testLine, 4);
assert.strictEqual(anchorRes.timeAnchors.length, 4);
assert.strictEqual(anchorRes.timeAnchors[0].isInitialRest, true, 'Temps 1 doit être un silence initial');
assert.deepStrictEqual(anchorRes.timeAnchors[1].syllables, ['Boi '], 'Temps 2 doit avoir 1 syllabe ["Boi "]');
assert.deepStrictEqual(anchorRes.timeAnchors[2].syllables, ['o ', 'ba', 'que ', 'vir '], 'Temps 3 doit avoir 4 syllabes');
assert.strictEqual(anchorRes.timeAnchors[3].isSustainedHold, true, 'Temps 4 doit être une tenue déclarée');

// Construction d'une courbe de pitch synthétique (t1 = 0.15s, bpm = 120 -> beatDur = 0.5s, stepDur = 0.125s)
const qBpm = 120;
const qT1 = 0.15;
const qBeatDur = 0.5;
const pitchCurve = [];
for (let t = 0; t <= 2.9; t += 0.01) {
  const rel = t - qT1;
  let midi = 0;
  if (rel >= 0 && rel < 0.5) {
    // Temps 1 : bruit résiduel qui doit être ignoré grâce à isInitialRest
    midi = 60;
  } else if (rel >= 0.5 && rel < 0.75) {
    // Temps 2 (1re moitié) : A4 (69)
    midi = 69;
  } else if (rel >= 0.75 && rel < 1.0) {
    // Temps 2 (2e moitié) : G4 (67) -> mélisme sur "Boi"
    midi = 67;
  } else if (rel >= 1.0 && rel < 2.0) {
    // Temps 3 et Temps 4 : F4 (65) continu recto-tono
    midi = 65;
  }
  if (midi > 0) pitchCurve.push({ timeSec: Math.round(t * 1000) / 1000, midiFloat: midi });
}

const qRes = quantizePitchToSteps({
  pitchCurve,
  bpm: qBpm,
  beatsPerMeasure: 4,
  measuresCount: 1,
  beatResolutions: [4, 4, 4, 4],
  trimStartSec: 0,
  trimEndSec: 2.9,
  hasAnacrusis: false,
  t1OffsetSec: qT1,
  timeAnchors: anchorRes.timeAnchors,
});

const alignedSteps = applyLyricsSyllablesToSteps(
  qRes.gridSteps,
  anchorRes.cleanText,
  anchorRes.timeAnchors,
  4,
  4
);

// Vérification Temps 1 (pas 0..3) : aucun pas ne doit être activé !
for (let s = 0; s < 4; s++) {
  assert.strictEqual(alignedSteps[s].active, false, `Le pas ${s} du Temps 1 ([1] _) doit rester silencieux`);
}

// Vérification Temps 2 (pas 4..7) : pas 4 = A4 ("Boi "), pas 6 = G4 ("-")
assert.strictEqual(alignedSteps[4].active, true);
assert.strictEqual(alignedSteps[4].midiNumber, 69);
assert.strictEqual(alignedSteps[4].syllable, 'Boi ', 'La 1re note du Temps 2 doit porter "Boi "');
assert.strictEqual(alignedSteps[6].active, true);
assert.strictEqual(alignedSteps[6].midiNumber, 67);
assert.strictEqual(alignedSteps[6].syllable, '-', 'La 2e note (mélisme) du Temps 2 doit porter "-"');

// Vérification Temps 3 (pas 8..11) : 4 attaques distinctes F4 pour "o ", "ba", "que ", "vir "
const expectedBeat3Syls = ['o ', 'ba', 'que ', 'vir '];
for (let k = 0; k < 4; k++) {
  const st = alignedSteps[8 + k];
  assert.strictEqual(st.active, true);
  assert.notStrictEqual(st.note, '───', `Le pas ${8 + k} du Temps 3 doit être scindé en tête de note`);
  assert.strictEqual(st.syllable, expectedBeat3Syls[k], `Le pas ${8 + k} doit porter la syllabe "${expectedBeat3Syls[k]}"`);
}

// Vérification Temps 4 (pas 12..15) : tenue liée '───' sans nouvelle attaque
for (let s = 12; s < 16; s++) {
  assert.strictEqual(alignedSteps[s].active, true);
  assert.strictEqual(alignedSteps[s].note, '───', `Le pas ${s} du Temps 4 ([4] _) doit être lié en tenue '───'`);
}

// Vérification reconstruction des mots
const reconstructed = reconstructWordsFromSteps(alignedSteps).trim();
assert.strictEqual(reconstructed, 'Boi o baque vir', `Mots reconstruits attendus: "Boi o baque vir", reçu: "${reconstructed}"`);
console.log('  ✅ 3. Quantification MIDI & Alignement Syllabique guidé par timeAnchors validés.');

// ============================================================================
// 4. Géométrie Unifiée du Piano Roll (tGridStart, gridDur) & Melodyne Target Resolution
// ============================================================================
// Pour 1 mesure 4/4 sans anacrouse à 120 BPM :
// tGridStart = 0.15s, totalSteps = (4 + 1) * 4 = 20 pas de 0.125s -> gridDur = 2.50s, totalDurationSec = 2.90s
const totalDurationSec = 0.15 + 2.50 + 0.25; // 2.90s
const regionOnBeat3 = {
  id: 'reg_b3',
  startSec: 0.15 + 1.05, // Au cœur du Temps 3 (t = 1.20s..1.60s, F4 = MIDI 65)
  endSec: 0.15 + 1.45,
  pitchCenterPct: 100,
  flattenPct: 100,
};

const targetMidi = findTargetMidiForRegion(regionOnBeat3, alignedSteps, totalDurationSec, 60);
assert.strictEqual(targetMidi, 65, `Melodyne doit cibler la brique F4 (65) sous la région, reçu: ${targetMidi}`);

const correctedCurve = computeCorrectedPitchCurve(
  [{ timeSec: 0.15 + 1.25, midiFloat: 65.4 }],
  alignedSteps,
  totalDurationSec,
  [regionOnBeat3]
);
assert.strictEqual(correctedCurve[0].midiFloat, 65, 'Avec pitchCenter=100% et flatten=100%, la courbe doit être centrée sur 65.00');

// Vérification hit-test des poignées Melodyne dans le référentiel (tGridStart = 0.15, gridDur = 2.50)
const canvasWidth = 1000;
const expectedXIn = ((regionOnBeat3.startSec - 0.15) / 2.50) * canvasWidth;
const hitIn = findRegionHandleAt(expectedXIn, canvasWidth, 2.50, [regionOnBeat3], 8, 0.15);
assert.ok(hitIn && hitIn.handle === 'in', 'findRegionHandleAt doit détecter la poignée IN à la coordonnée exacte (tGridStart, gridDur)');
console.log('  ✅ 4. Géométrie unifiée du Piano Roll (tGridStart, gridDur) & Melodyne validées.');

// ============================================================================
// 5. Aller-retour du découpeur rapide PianoRollSyllablesRow ('Boi bo-ni-to' <-> ['Boi ', 'bo', 'ni', 'to '])
// ============================================================================
const sampleNotes = [
  { syllable: 'Boi ' },
  { syllable: 'bo' },
  { syllable: 'ni' },
  { syllable: 'to ' },
];
const formattedCutter = sampleNotes.map((n, idx) => {
  const s = n.syllable || '-';
  if (idx === sampleNotes.length - 1) return s.trimEnd();
  return s.endsWith(' ') ? s : `${s}-`;
}).join('');
assert.strictEqual(formattedCutter, 'Boi bo-ni-to', `Formatage cutter attendu: "Boi bo-ni-to", reçu: "${formattedCutter}"`);

const words = formattedCutter.trim().split(/\s+/).filter(Boolean);
const parsedParts = [];
for (const word of words) {
  if (word === '-' || word === '~') { parsedParts.push('-'); continue; }
  const syls = word.split('-').filter(Boolean);
  syls.forEach((s, i) => parsedParts.push(i === syls.length - 1 ? `${s} ` : s));
}
assert.deepStrictEqual(parsedParts, ['Boi ', 'bo', 'ni', 'to '], 'La redistribution doit restaurer les espaces de fin de mot');
console.log('  ✅ 5. Aller-retour du découpeur rapide PianoRollSyllablesRow validé.');

console.log('🎉 TOUS LES TESTS DE L ÉTAPE 4 SONT PASSÉS AVEC SUCCÈS !');

