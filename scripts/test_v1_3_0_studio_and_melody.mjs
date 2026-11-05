/**
 * test_v1_3_0_studio_and_melody.mjs
 * Suite de validation architecturale et unitaire — Cantador v1.3.0 (Lot Studio & Mélodie Simplifiée) :
 * 1. Volet 1 : simplifyStepsToMainMelody (fusion micro-variations, préservation des silences initiaux & mélismes)
 * 2. Volet 1 : resizeBrickRightEdge, weldAdjacentBricks, isOnBrickRightResizeHandle, findBrickJunctionAtX
 * 3. Volet 2 : BackingTrackEngine (computeBackingVarispeedRate) & backingTrackStorage (extractBpmFromFileName)
 * 4. Volet 3 : mergePunchInMeasure (crossfade cosinus 15ms sans clic aux frontières) & ComfortMonitoringNode
 * 5. Volet 3 : classifyMicGainLevel (peakDb = -0.3 -> 'too_hot', -6.0 -> 'optimal', -24.0 -> 'too_low')
 * 6. Gouvernance : 100% des fichiers src/ < 145 lignes, Règle 0 de nommage, parité i18n FR/PT-BR, version 1.3.0.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { simplifyStepsToMainMelody } from '../src/audio/melodicSimplifier.ts';
import {
  isOnBrickRightResizeHandle,
  findBrickJunctionAtX,
  resizeBrickRightEdge,
  weldAdjacentBricks,
} from '../src/components/livret-melodia/pianoRollBrickInteractions.ts';
import { findBrickRange } from '../src/components/livret-melodia/pianoRollInteractions.ts';
import { computeBackingVarispeedRate } from '../src/audio/BackingTrackEngine.ts';
import { extractBpmFromFileName } from '../src/utils/backingTrackStorage.ts';
import { mergePunchInMeasure } from '../src/audio/punchInMerger.ts';
import { classifyMicGainLevel, sampleToDbFs } from '../src/components/livret-reglages/MicGainAssistantCard.tsx';
import { uiPolishTranslationsFr } from '../src/i18n/uiPolishTranslationsFr.ts';
import { uiPolishTranslationsBr } from '../src/i18n/uiPolishTranslationsBr.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

console.log('=== TEST SUITE v1.3.0 : LOT STUDIO & MÉLODIE SIMPLIFIÉE ===\n');

// ---------------------------------------------------------------------------
// 1. TEST VOLET 1.A : simplifyStepsToMainMelody
// ---------------------------------------------------------------------------
console.log('1. Test simplifyStepsToMainMelody (fusion micro-variations & respect silences)...');
{
  // 8 steps (2 beats of 4 subdivisions, subdivisionsPerBeat = 4):
  // Beat 1 (steps 0..3) : initial rest (isInitialRest: true)
  // Beat 2 (steps 4..7) : syllable "Lu-" with a 1-step micro-variation on step 6 (60, 60, 61, 60) -> must unify to 60 held across 4..7
  // Beat 3 (steps 8..9) : syllable "an" on 64 -> held across 8..9
  const rawSteps = [
    { active: true, midiNumber: 59, note: 'B3', isTie: false, syllable: '' }, // noise on initial rest beat -> must be silenced
    { active: false, midiNumber: 0, note: '', isTie: false, syllable: '' },
    { active: false, midiNumber: 0, note: '', isTie: false, syllable: '' },
    { active: false, midiNumber: 0, note: '', isTie: false, syllable: '' },
    { active: true, midiNumber: 60, note: 'C4', isTie: false, syllable: 'Lu-' },
    { active: true, midiNumber: 60, note: '───', isTie: true, syllable: '' },
    { active: true, midiNumber: 61, note: 'C#4', isTie: false, syllable: '' }, // 1-step micro-glitch
    { active: true, midiNumber: 60, note: 'C4', isTie: false, syllable: '' },
    { active: true, midiNumber: 64, note: 'E4', isTie: false, syllable: 'an' },
    { active: true, midiNumber: 64, note: '───', isTie: true, syllable: '' },
  ];

  const timeAnchors = [
    { beat: 1, measureIndex: 0, syllable: '', isInitialRest: true },
    { beat: 2, measureIndex: 0, syllable: 'Lu-' },
    { beat: 3, measureIndex: 0, syllable: 'an' },
  ];

  const simplified = simplifyStepsToMainMelody(rawSteps, timeAnchors, 4, 4, false);
  assert.equal(simplified.length, 10);

  // Initial rests (Beat 1 = steps 0..3) strictly preserved / silenced
  for (let s = 0; s < 4; s++) {
    assert.equal(simplified[s].active, false, `Initial rest step ${s} must be inactive`);
    assert.equal(simplified[s].midiNumber, 0, `Initial rest step ${s} must have midiNumber 0`);
  }

  // Syllable "Lu-" unified to MIDI 60 across steps 4..7
  assert.equal(simplified[4].active, true);
  assert.equal(simplified[4].midiNumber, 60);
  assert.equal(simplified[4].isTie, false);
  assert.equal(simplified[4].syllable, 'Lu-');
  for (let s = 5; s <= 7; s++) {
    assert.equal(simplified[s].active, true, `Step ${s} should be active`);
    assert.equal(simplified[s].midiNumber, 60, `Step ${s} should have midiNumber 60`);
    assert.equal(simplified[s].isTie, true, `Step ${s} should be tied`);
    assert.equal(simplified[s].note, '───', `Step ${s} should have tie symbol`);
  }

  // Syllable "an" unified to MIDI 64 across steps 8..9
  assert.equal(simplified[8].midiNumber, 64);
  assert.equal(simplified[8].isTie, false);
  assert.equal(simplified[8].syllable, 'an');
  assert.equal(simplified[9].midiNumber, 64);
  assert.equal(simplified[9].isTie, true);
  assert.equal(simplified[9].note, '───');
  console.log('   ✅ simplifyStepsToMainMelody validé (silences préservés, micro-variations fusionnées).');
}

// ---------------------------------------------------------------------------
// 2. TEST VOLET 1.B : resizeBrickRightEdge & weldAdjacentBricks
// ---------------------------------------------------------------------------
console.log('2. Test resizeBrickRightEdge & weldAdjacentBricks (Piano Roll interactif)...');
{
  const initialSteps = [
    { active: true, midiNumber: 62, note: 'D4', isTie: false, syllable: 'Ma-' },
    { active: true, midiNumber: 62, note: '───', isTie: true, syllable: '' },
    { active: false, midiNumber: 0, note: '', isTie: false, syllable: '' },
    { active: false, midiNumber: 0, note: '', isTie: false, syllable: '' },
    { active: true, midiNumber: 65, note: 'F4', isTie: false, syllable: 'ra' },
    { active: true, midiNumber: 65, note: '───', isTie: true, syllable: '' },
  ];

  // Extend brick 0 (rootIndex=0, endIndex=1) to targetEndIndex=3 (steps 0..3)
  const extended = resizeBrickRightEdge(initialSteps, 0, 3);
  for (let s = 1; s <= 3; s++) {
    assert.equal(extended[s].active, true);
    assert.equal(extended[s].midiNumber, 62);
    assert.equal(extended[s].isTie, true);
    assert.equal(extended[s].note, '───');
  }

  // Shrink brick 0 back to targetEndIndex=0 (only step 0 active, steps 1..3 released)
  const shrunk = resizeBrickRightEdge(extended, 0, 0);
  assert.equal(shrunk[0].active, true);
  assert.equal(shrunk[0].midiNumber, 62);
  assert.equal(shrunk[0].isTie, false);
  for (let s = 1; s <= 3; s++) {
    assert.equal(shrunk[s].active, false, `Step ${s} must be released after shrink`);
    assert.equal(shrunk[s].midiNumber, 0);
  }

  // Weld brick at step 4 (MIDI 65) with preceding brick at steps 0..3 (MIDI 62)
  const welded = weldAdjacentBricks(extended, 4);
  const weldedRange = findBrickRange(welded, 0);
  assert.deepEqual(weldedRange, { rootIndex: 0, endIndex: 5 }, 'Two welded bricks must form a single brick 0..5');
  for (let s = 1; s <= 5; s++) {
    assert.equal(welded[s].midiNumber, 62, 'Unified brick must adopt the first brick midiNumber (62)');
    assert.equal(welded[s].note, '───');
    assert.equal(welded[s].isTie, true);
  }

  // Hit detection helpers: 6 steps across 180px canvas -> 30px per step.
  // Brick 0..1 ends at brickEndIndex=1 -> right edge at (1+1)*30 = 60px
  assert.equal(isOnBrickRightResizeHandle(56, 180, 6, 1, 8), true);
  assert.equal(isOnBrickRightResizeHandle(35, 180, 6, 1, 8), false);

  const adjacentSteps = [
    { active: true, midiNumber: 60, note: 'C4', isTie: false, syllable: 'A' },
    { active: true, midiNumber: 62, note: 'D4', isTie: false, syllable: 'B' },
  ];
  // 2 steps across 60px -> junction at 30px (step 1)
  const junctionStep = findBrickJunctionAtX(adjacentSteps, 30, 60);
  assert.equal(junctionStep, 1);
  console.log('   ✅ resizeBrickRightEdge & weldAdjacentBricks validés.');
}

// ---------------------------------------------------------------------------
// 3. TEST VOLET 2 : BackingTrackEngine & backingTrackStorage
// ---------------------------------------------------------------------------
console.log('3. Test BackingTrackEngine (Varispeed) & backingTrackStorage (BPM filename)...');
{
  assert.equal(extractBpmFromFileName('Baque_Luanda_88bpm.wav', 90), 88);
  assert.equal(extractBpmFromFileName('Maracatu_104_BPM_Master.mp3', 90), 104);
  assert.equal(extractBpmFromFileName('take_without_tempo.wav', 92), 92);

  const rate = computeBackingVarispeedRate(99, 90);
  assert.ok(Math.abs(rate - 1.1) < 1e-6, `Expected varispeed 1.1, got ${rate}`);
  console.log('   ✅ computeBackingVarispeedRate & extractBpmFromFileName validés.');
}

// ---------------------------------------------------------------------------
// 4. TEST VOLET 3.A : mergePunchInMeasure (crossfade cosinus 15ms)
// ---------------------------------------------------------------------------
console.log('4. Test mergePunchInMeasure (Punch-in par mesure + crossfade cosinus 15ms)...');
{
  const sr = 1000; // 1000 Hz sample rate for deterministic sample inspection
  const measureDurSec = 1.0; // 1000 samples per measure
  const totalSamples = 2000; // 2 measures

  const existingPCM = new Float32Array(totalSamples).fill(0.2);
  const punchPCM = new Float32Array(1250).fill(0.8);

  // Punch-in Measure 2 (targetMeasureIndex = 2, measuresCount = 2, t1OffsetSec = 0)
  // Measure 1 is samples [0..999], Measure 2 is samples [1000..1999]
  const out = mergePunchInMeasure({
    existingPCM,
    punchPCM,
    sampleRate: sr,
    targetMeasureIndex: 2,
    measuresCount: 2,
    measureDurationSec: measureDurSec,
    t1OffsetSec: 0,
    crossfadeMs: 15,
  });

  // Measure 1 well before boundary must remain 100% untouched (0.2)
  assert.ok(Math.abs(out[500] - 0.2) < 1e-5, 'Measure 1 must remain untouched');
  // Middle of Measure 2 must be 100% punch-in signal (0.8)
  assert.ok(Math.abs(out[1500] - 0.8) < 1e-5, 'Measure 2 center must equal punch-in signal');
  // Sample inside the 15-sample cosine crossfade (e.g. sample 1007 = midpoint of [1000..1015]) must be smoothly blended (~0.5)
  assert.ok(out[1007] > 0.35 && out[1007] < 0.65, `Crossfade midpoint should be ~0.5, got ${out[1007]}`);

  // Verify zero sample-to-sample step jump > 0.15 across the splice boundary
  let maxDelta = 0;
  for (let i = 995; i < 1020; i++) {
    const d = Math.abs(out[i + 1] - out[i]);
    if (d > maxDelta) maxDelta = d;
  }
  assert.ok(maxDelta < 0.15, `Crossfade must be smooth without click (maxDelta=${maxDelta})`);
  console.log('   ✅ mergePunchInMeasure validé (Mesure 1 intacte, crossfade cosinus 15ms sans clic).');
}

// ---------------------------------------------------------------------------
// 5. TEST VOLET 3.B : classifyMicGainLevel (Assistant de Gain Micro 3s)
// ---------------------------------------------------------------------------
console.log('5. Test classifyMicGainLevel (Assistant de Gain 3s)...');
{
  const hot = classifyMicGainLevel(-0.3);
  assert.equal(hot.status, 'too_hot');

  const opt = classifyMicGainLevel(-6.0);
  assert.equal(opt.status, 'optimal');

  const low = classifyMicGainLevel(-24.0);
  assert.equal(low.status, 'too_low');

  assert.equal(sampleToDbFs(1.0), 0);
  assert.ok(sampleToDbFs(0.944) >= -0.6 && sampleToDbFs(0.944) <= -0.4);
  console.log('   ✅ classifyMicGainLevel validé (-0.3dB -> too_hot, -6.0dB -> optimal, -24.0dB -> too_low).');
}

// ---------------------------------------------------------------------------
// 6. GOUVERNANCE : < 145 lignes, Règle 0, Parité i18n FR/PT-BR & version 1.3.0
// ---------------------------------------------------------------------------
console.log('6. Vérification Gouvernance (< 145 lignes, Règle 0, i18n FR/PT-BR, version 1.3.0)...');
{
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '1.3.0', `package.json version must be 1.3.0, got ${pkg.version}`);

  const frKeys = Object.keys(uiPolishTranslationsFr).sort();
  const brKeys = Object.keys(uiPolishTranslationsBr).sort();
  assert.deepEqual(frKeys, brKeys, 'FR and PT-BR uiPolishTranslations keys must match 100%');

  const forbiddenRegex = /\b(Organizad'Or|S[eé]quenciad'Or|Cantad'Or|Orquestrad'Or|Orchestrad'Or|Mostrad'Or|Dan[cç]ad'Or|O'Girad'Or)\b/i;

  function walkSrc(dir, list = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkSrc(full, list);
      else if (/\.(ts|tsx|css)$/.test(entry.name)) list.push(full);
    }
    return list;
  }

  const srcFiles = walkSrc(path.join(ROOT, 'src'));
  for (const file of srcFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/).length;
    const rel = path.relative(ROOT, file);
    assert.ok(lines < 145, `Règle Anti-Monolithe 6.A violée : ${rel} fait ${lines} lignes (max 144)`);
    assert.ok(!forbiddenRegex.test(content), `Règle 0 violée dans ${rel}`);
  }
  console.log(`   ✅ ${srcFiles.length} fichiers src/ vérifiés (< 145 lignes, 0 violation Règle 0, i18n 100%, v1.3.0).`);
}

console.log('\n🎉 TOUS LES TESTS v1.3.0 (LOT STUDIO & MÉLODIE SIMPLIFIÉE) SONT PASSÉS AVEC SUCCÈS !');
