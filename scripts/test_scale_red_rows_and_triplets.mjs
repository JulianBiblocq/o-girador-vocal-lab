/**
 * test_scale_red_rows_and_triplets.mjs
 * Suite de tests automatisés pour :
 * - Volet 1 : Coloration en rouge des lignes hors-gamme sur le Piano Roll & Clavier gauche
 * - Volet 2 : Support complet des Triolets (³1-2-3 & ³_2-3) par temps (Grille, Syllabes, Audio & Analyse Mélodique)
 * - Retour propre en binaire lors du clic sur 1-2-4
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import './resolve-ts.mjs';

const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  clear: () => memStore.clear(),
};

const {
  isBeatTriplet,
  getStepTimeWindowSec,
  getStepHorizontalBoundsPx,
  resolveStepIndexAtXPx,
} = await import('../src/utils/tripletBeatHelper.ts');
const {
  MARACATU_BEAT_PRESETS,
  applyBeatRhythmPreset,
} = await import('../src/components/livret-melodia/BeatRhythmPresetBar.tsx');
const {
  reanalyzeNotesOnAlignedSyllables,
} = await import('../src/audio/syllableGuidedPitchReanalyzer.ts');
const {
  drawPianoRollRows,
} = await import('../src/components/livret-melodia/pianoRollRowsDrawer.ts');

console.log('=== TEST 1 : VOLET 1 — LIGNES HORS-GAMME EN ROUGE (PIANO ROLL & CLAVIER 64PX) ===');
{
  const filledRows = [];
  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect(x, y, w, h) {
      if (w > 10) filledRows.push({ y, fillStyle: this.fillStyle });
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
  };

  // Gamme de Do Majeur : [0, 2, 4, 5, 7, 9, 11] -> Do# (1) est hors-gamme, Do (0) et Ré (2) sont dans la gamme
  const cMajorPitchClasses = new Set([0, 2, 4, 5, 7, 9, 11]);
  drawPianoRollRows({
    ctx: mockCtx,
    width: 600,
    minMidi: 60, // C4 (in scale, tonic)
    maxMidi: 62, // D4 (62, in scale), C#4 (61, out of scale), C4 (60, in scale)
    rowHeight: 22,
    playheadSec: -1,
    seekStartSec: 0,
    isPlaying: false,
    beatsPerMeasure: 4,
    beatDurationSec: 0.6,
    allowedPitchClasses: cMajorPitchClasses,
    tonic: 'C',
  });

  // L'ordre de tracé va de maxMidi (62) à minMidi (60)
  const d4Row = filledRows[0];  // MIDI 62 (in scale)
  const cs4Row = filledRows[1]; // MIDI 61 (out of scale -> red!)
  const c4Row = filledRows[2];  // MIDI 60 (in scale, tonic)

  assert.equal(cs4Row.fillStyle, 'rgba(185, 28, 28, 0.28)', 'En mode Nuit, une ligne hors-gamme doit être colorée en rouge rgba(185, 28, 28, 0.28)');
  assert.equal(d4Row.fillStyle, 'rgba(16, 185, 129, 0.07)', 'Une ligne dans la gamme doit garder le fond vert émeraude léger rgba(16, 185, 129, 0.07)');
  assert.equal(c4Row.fillStyle, 'rgba(16, 185, 129, 0.14)', 'La tonique de la gamme est marquée discrètement');

  const kbSrc = fs.readFileSync(path.resolve('src/components/livret-melodia/PianoRollKeyboard.tsx'), 'utf8');
  assert.ok(kbSrc.includes('#ef4444') && kbSrc.includes('#b91c1c'), 'Le clavier gauche 64px affiche un indicateur rouge (#b91c1c / #ef4444) sur les touches hors-gamme');
}
console.log('✓ Test 1 validé : Lignes hors-gamme et touches du clavier colorées en rouge.');

console.log('\n=== TEST 2 : VOLET 2 — FENÊTRES TEMPORELLES (0, 1/3, 2/3) & COORDONNÉES HORIZONTALES (beatWidth / 3) POUR ³1-2-3 ET ³_2-3 ===');
{
  const presetLabels = MARACATU_BEAT_PRESETS.map((p) => p.label);
  assert.ok(presetLabels.includes('³1-2-3'), 'Le preset ³1-2-3 doit être présent dans MARACATU_BEAT_PRESETS');
  assert.ok(presetLabels.includes('³_2-3'), 'Le preset ³_2-3 doit être présent dans MARACATU_BEAT_PRESETS');

  // Création de 2 temps (8 pas au total)
  const baseSteps = Array.from({ length: 8 }, (_, idx) => ({
    stepIndex: idx,
    active: idx < 4,
    isTie: false,
    note: 'C4',
    midiNumber: 60,
    syllable: ['Ma-', 'ra-', 'ca-', 'tu', 'Na-', 'ção', '', ''][idx] || '',
    velocity: 100,
    decay: 0.15,
  }));

  const beatDurSec = 0.60; // 100 BPM
  const gridWidthPx = 600; // 2 temps -> beatWidthPx = 300px, tiers = 100px, quart = 75px

  // 1) Application de ³1-2-3 sur le 1er temps (beatIndex = 0)
  const stepsTripletFull = applyBeatRhythmPreset(baseSteps, 0, '³1-2-3', 4);
  assert.equal(stepsTripletFull.length, 8, 'Le tableau steps conserve exactement 4 entrées par temps (8 pour 2 temps)');
  assert.equal(isBeatTriplet(stepsTripletFull, 0), true, 'Le temps 0 doit être détecté en triolet');
  assert.equal(isBeatTriplet(stepsTripletFull, 4), false, 'Le temps 1 voisin reste binaire');

  assert.equal(stepsTripletFull[0].tripletSlot, 1);
  assert.equal(stepsTripletFull[1].tripletSlot, 2);
  assert.equal(stepsTripletFull[2].tripletSlot, 3);
  assert.equal(stepsTripletFull[3].tripletSlot, 'unused');
  assert.equal(stepsTripletFull[3].active, false);
  assert.equal(stepsTripletFull[3].syllable, '');

  // Les 4 syllabes du temps 0 ont été réparties sur les 3 notes du triolet sans toucher au temps 1
  assert.equal(stepsTripletFull[0].syllable, 'Ma-');
  assert.equal(stepsTripletFull[1].syllable, 'ra-');
  assert.equal(stepsTripletFull[2].syllable, 'ca-tu');
  assert.equal(stepsTripletFull[4].syllable, 'Na-', 'Le temps voisin ne doit pas être décalé');

  // Fenêtres temporelles exactes (0, 1/3, 2/3 du temps)
  const w0 = getStepTimeWindowSec(stepsTripletFull, 0, 0, beatDurSec);
  const w1 = getStepTimeWindowSec(stepsTripletFull, 1, 0, beatDurSec);
  const w2 = getStepTimeWindowSec(stepsTripletFull, 2, 0, beatDurSec);
  const w3 = getStepTimeWindowSec(stepsTripletFull, 3, 0, beatDurSec);

  assert.ok(Math.abs(w0.startSec - 0.0) < 1e-6 && Math.abs(w0.endSec - 0.2) < 1e-6 && Math.abs(w0.durationSec - 0.2) < 1e-6);
  assert.ok(Math.abs(w1.startSec - 0.2) < 1e-6 && Math.abs(w1.endSec - 0.4) < 1e-6 && Math.abs(w1.durationSec - 0.2) < 1e-6);
  assert.ok(Math.abs(w2.startSec - 0.4) < 1e-6 && Math.abs(w2.endSec - 0.6) < 1e-6 && Math.abs(w2.durationSec - 0.2) < 1e-6);
  assert.equal(w3.durationSec, 0, 'Le 4e pas unused a une durée nulle');

  // Coordonnées horizontales exactes (beatWidth / 3 = 100px)
  const b0 = getStepHorizontalBoundsPx(stepsTripletFull, 0, gridWidthPx);
  const b1 = getStepHorizontalBoundsPx(stepsTripletFull, 1, gridWidthPx);
  const b2 = getStepHorizontalBoundsPx(stepsTripletFull, 2, gridWidthPx);
  const b3 = getStepHorizontalBoundsPx(stepsTripletFull, 3, gridWidthPx);

  assert.ok(Math.abs(b0.xPx - 0) < 1e-6 && Math.abs(b0.widthPx - 100) < 1e-6 && b0.hidden === false);
  assert.ok(Math.abs(b1.xPx - 100) < 1e-6 && Math.abs(b1.widthPx - 100) < 1e-6 && b1.hidden === false);
  assert.ok(Math.abs(b2.xPx - 200) < 1e-6 && Math.abs(b2.widthPx - 100) < 1e-6 && b2.hidden === false);
  assert.equal(b3.hidden, true);
  assert.equal(b3.widthPx, 0);

  // Résolution du clic souris aux tiers du temps
  assert.equal(resolveStepIndexAtXPx(stepsTripletFull, 20, gridWidthPx), 0);
  assert.equal(resolveStepIndexAtXPx(stepsTripletFull, 150, gridWidthPx), 1);
  assert.equal(resolveStepIndexAtXPx(stepsTripletFull, 250, gridWidthPx), 2);

  // 2) Application de ³_2-3 (soupir sur le 1er tiers + notes sur 2e et 3e tiers)
  const stepsTripletRest = applyBeatRhythmPreset(stepsTripletFull, 0, '³_2-3', 4);
  assert.equal(isBeatTriplet(stepsTripletRest, 0), true);
  assert.equal(stepsTripletRest[0].tripletSlot, 1);
  assert.equal(stepsTripletRest[0].active, false, 'Le 1er tiers de ³_2-3 doit être un soupir (inactif)');
  assert.equal(stepsTripletRest[1].tripletSlot, 2);
  assert.equal(stepsTripletRest[1].active, true, 'Le 2e tiers de ³_2-3 doit être actif');
  assert.equal(stepsTripletRest[2].tripletSlot, 3);
  assert.equal(stepsTripletRest[2].active, true, 'Le 3e tiers de ³_2-3 doit être actif');
  assert.equal(stepsTripletRest[3].tripletSlot, 'unused');
  assert.equal(stepsTripletRest[3].active, false);

  const br1 = getStepHorizontalBoundsPx(stepsTripletRest, 1, gridWidthPx);
  const br2 = getStepHorizontalBoundsPx(stepsTripletRest, 2, gridWidthPx);
  assert.ok(Math.abs(br1.xPx - 100) < 1e-6 && Math.abs(br1.widthPx - 100) < 1e-6);
  assert.ok(Math.abs(br2.xPx - 200) < 1e-6 && Math.abs(br2.widthPx - 100) < 1e-6);
}
console.log('✓ Test 2 validé : Fenêtres temporelles (0, 1/3, 2/3) et coordonnées (beatWidth / 3) exactes pour ³1-2-3 et ³_2-3.');

console.log('\n=== TEST 3 : RÉ-ANALYSE MÉLODIQUE SUR UN TEMPS EN TRIOLET ³1-2-3 & RETOUR PROPRE EN BINAIRE (1-2-4) ===');
{
  const beatDurSec = 0.60; // 1er tiers = 0..0.20s, 2e tiers = 0.20..0.40s, 3e tiers = 0.40..0.60s
  const stepDurSec = beatDurSec / 4; // 0.15s

  // Courbe verte synthétique :
  // - [0.00..0.20s] : Sol3 (MIDI 55)
  // - [0.20..0.40s] : La3  (MIDI 57)
  // - [0.40..0.60s] : Do4  (MIDI 60)
  const pitchCurve = [];
  for (let tMs = 0; tMs <= 600; tMs += 10) {
    const tSec = tMs / 1000;
    const midiFloat = tSec < 0.20 ? 55.0 : tSec < 0.40 ? 57.0 : 60.0;
    pitchCurve.push({
      timeSec: tSec,
      midiFloat,
      confidence: 0.95,
      rms: 0.22,
    });
  }

  const initialSteps = Array.from({ length: 4 }, (_, idx) => ({
    stepIndex: idx,
    active: idx < 3,
    isTie: false,
    note: 'C4',
    midiNumber: 60,
    syllable: ['ba-', 'que-', 'bom', ''][idx],
    velocity: 100,
    decay: stepDurSec,
  }));

  const tripletSteps = applyBeatRhythmPreset(initialSteps, 0, '³1-2-3', 4);
  const reanalyzed = reanalyzeNotesOnAlignedSyllables({
    steps: tripletSteps,
    pitchCurve,
    gridStartSec: 0,
    stepDurationSec: stepDurSec,
    tonic: 'C',
    scaleType: 'major',
    vocalBounds: { minMidi: 45, maxMidi: 68, comfortMidi: 57 },
  });

  assert.equal(reanalyzed[0].midiNumber, 55, 'Le 1er tiers du triolet [0..0.20s] doit lire Sol3 (MIDI 55)');
  assert.equal(reanalyzed[0].note, 'G3');
  assert.equal(reanalyzed[1].midiNumber, 57, 'Le 2e tiers du triolet [0.20..0.40s] doit lire La3 (MIDI 57)');
  assert.equal(reanalyzed[1].note, 'A3');
  assert.equal(reanalyzed[2].midiNumber, 60, 'Le 3e tiers du triolet [0.40..0.60s] doit lire Do4 (MIDI 60)');
  assert.equal(reanalyzed[2].note, 'C4');
  assert.equal(reanalyzed[3].tripletSlot, 'unused');
  assert.equal(reanalyzed[3].active, false);

  // Retour propre en binaire lors du clic sur 1-2-4
  const backToBinary = applyBeatRhythmPreset(reanalyzed, 0, '1-2-4', 4);
  assert.equal(isBeatTriplet(backToBinary, 0), false, 'Après clic sur 1-2-4, le temps ne doit plus être en triolet');
  for (let s = 0; s < 4; s++) {
    assert.equal(backToBinary[s].tripletSlot, undefined, `Le pas ${s} doit avoir tripletSlot === undefined après retour en binaire`);
  }
  assert.equal(backToBinary[0].active, true);
  assert.equal(backToBinary[1].active, true);
  assert.equal(backToBinary[2].active, true);
  assert.equal(backToBinary[2].isTie, true, 'En 1-2-4, la 3e double-croche est liée à la 2e');
  assert.equal(backToBinary[3].active, true);
  assert.equal(backToBinary[3].isTie, false);

  const binBounds0 = getStepHorizontalBoundsPx(backToBinary, 0, 300);
  const binBounds3 = getStepHorizontalBoundsPx(backToBinary, 3, 300);
  assert.ok(Math.abs(binBounds0.widthPx - 75) < 1e-6, 'En binaire, un pas simple retrouve sa largeur beatWidth / 4 (75px)');
  assert.ok(Math.abs(binBounds3.xPx - 225) < 1e-6 && Math.abs(binBounds3.widthPx - 75) < 1e-6);
}
console.log('✓ Test 3 validé : Ré-analyse des 3 tiers de la courbe verte et retour propre en binaire sur 1-2-4.');

console.log('\n🎉 TOUS LES TESTS (LIGNES HORS-GAMME ROUGES & TRIOLETS ³1-2-3 / ³_2-3) SONT PASSÉS AVEC SUCCÈS !');
