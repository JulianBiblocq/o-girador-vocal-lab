/**
 * test_scale_red_rows_and_triplets.mjs
 * Suite de tests automatisés pour :
 * - Volet 1 : Coloration en rouge des lignes hors-gamme sur le Piano Roll & Clavier gauche
 * - Volet 2 : Bouton Triolet Unique et Intelligent [ 3 ] (applySmartTripletToBeat & getTripletBeatLabel)
 *   * 3 notes (1-2-4 ou _2-3-4) + clic sur 3 -> 1-2-3 ([true, true, true]) avec les 3 syllabes préservées
 *   * 2 notes (1-2-_-_) + clic sur 3 -> 1-2-_ (attaques sur tiers 1 et 2, silence/tenue sur tiers 3)
 *   * 2 notes (1-_-_-4) + clic sur 3 -> 1-_-3 (attaques sur tiers 1 et 3, silence/tenue sur tiers 2)
 *   * 2 notes (_-_-3-4) + clic sur 3 -> _-2-3 (silence/tenue sur tiers 1, attaques sur tiers 2 et 3)
 *   * Re-clic sur 3 quand déjà en triolet à 2 notes -> rotation 1-2-_ -> 1-_-3 -> _-2-3 -> 1-2-_
 * - Ré-analyse des hauteurs par tiers de temps & retour propre en binaire sur 1-2-4
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
  applySmartTripletToBeat,
  getTripletBeatLabel,
  getStepTimeWindowSec,
  getStepHorizontalBoundsPx,
  resolveStepIndexAtXPx,
} = await import('../src/utils/tripletBeatHelper.ts');
const {
  applyBeatRhythmPreset,
} = await import('../src/components/livret-melodia/BeatRhythmPresetBar.tsx');
const {
  reanalyzeNotesOnAlignedSyllables,
} = await import('../src/audio/syllableGuidedPitchReanalyzer.ts');
const {
  drawPianoRollRows,
} = await import('../src/components/livret-melodia/pianoRollRowsDrawer.ts');

function makeBeatSteps(pattern) {
  return pattern.map((cfg, idx) => ({
    stepIndex: idx,
    active: cfg.active ?? false,
    isTie: cfg.isTie ?? false,
    note: cfg.isTie ? '───' : (cfg.note ?? 'C4'),
    midiNumber: cfg.active ? (cfg.midi ?? 60) : 0,
    syllable: cfg.syllable ?? '',
    velocity: 100,
    decay: 0.15,
  }));
}

function getTripletAttackSignature(steps, beatStartIdx = 0) {
  return [0, 1, 2].map((k) => Boolean(steps[beatStartIdx + k].active && !steps[beatStartIdx + k].isTie && steps[beatStartIdx + k].note !== '───'));
}

console.log('=== TEST 1 : VOLET 1 — LIGNES HORS-GAMME EN ROUGE (PIANO ROLL & CLAVIER 64PX) ===');
{
  const filledRows = [];
  const mockCtx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    fillRect(x, y, w) {
      if (w > 10) filledRows.push({ y, fillStyle: this.fillStyle });
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
  };

  const cMajorPitchClasses = new Set([0, 2, 4, 5, 7, 9, 11]);
  drawPianoRollRows({
    ctx: mockCtx,
    width: 600,
    minMidi: 60,
    maxMidi: 62,
    rowHeight: 22,
    playheadSec: -1,
    seekStartSec: 0,
    isPlaying: false,
    beatsPerMeasure: 4,
    beatDurationSec: 0.6,
    allowedPitchClasses: cMajorPitchClasses,
    tonic: 'C',
  });

  assert.equal(filledRows[1].fillStyle, 'rgba(185, 28, 28, 0.28)', 'En mode Nuit, une ligne hors-gamme (C#4) doit être colorée en rouge rgba(185, 28, 28, 0.28)');
  assert.equal(filledRows[0].fillStyle, 'rgba(16, 185, 129, 0.07)', 'Une ligne dans la gamme (D4) garde le fond vert émeraude léger');

  const kbSrc = fs.readFileSync(path.resolve('src/components/livret-melodia/PianoRollKeyboard.tsx'), 'utf8');
  assert.ok(kbSrc.includes('#ef4444') && kbSrc.includes('#b91c1c'), 'Le clavier gauche 64px affiche un indicateur rouge sur les touches hors-gamme');
}
console.log('✓ Test 1 validé : Lignes hors-gamme et touches du clavier colorées en rouge.');

console.log('\n=== TEST 2 : BOUTON TRIOLET INTELLIGENT [ 3 ] (CAS 3 NOTES, 2 NOTES & ROTATION CYCLIQUE) ===');
{
  // 1) 3 notes (1-2-4 ou _2-3-4) + clic sur 3 -> 1-2-3 ([true, true, true]) avec les 3 syllabes préservées
  const steps124 = makeBeatSteps([
    { active: true, midi: 60, syllable: 'Ma-' },
    { active: true, midi: 62, syllable: 'ra-' },
    { active: true, isTie: true, midi: 62 },
    { active: true, midi: 64, syllable: 'ca' },
  ]);
  assert.equal(getTripletBeatLabel(steps124, 0), '3', 'Au repos en binaire, le bouton affiche "3"');

  const tripFrom124 = applySmartTripletToBeat(steps124, 0);
  assert.equal(isBeatTriplet(tripFrom124, 0), true);
  assert.deepEqual(getTripletAttackSignature(tripFrom124, 0), [true, true, true]);
  assert.equal(getTripletBeatLabel(tripFrom124, 0), '³1-2-3');
  assert.deepEqual([tripFrom124[0].syllable, tripFrom124[1].syllable, tripFrom124[2].syllable], ['Ma-', 'ra-', 'ca']);
  assert.equal(tripFrom124[3].tripletSlot, 'unused');
  assert.equal(tripFrom124[3].active, false);

  const stepsRest234 = makeBeatSteps([
    { active: false },
    { active: true, midi: 55, syllable: 'Ba-' },
    { active: true, midi: 57, syllable: 'que-' },
    { active: true, midi: 60, syllable: 'bom' },
  ]);
  const tripFromRest234 = applySmartTripletToBeat(stepsRest234, 0);
  assert.deepEqual(getTripletAttackSignature(tripFromRest234, 0), [true, true, true]);
  assert.equal(getTripletBeatLabel(tripFromRest234, 0), '³1-2-3');
  assert.deepEqual([tripFromRest234[0].syllable, tripFromRest234[1].syllable, tripFromRest234[2].syllable], ['Ba-', 'que-', 'bom']);

  // 2) 2 notes (1-2-_-_) + clic sur 3 -> 1-2-_ (attaques sur tiers 1 et 2, silence sur tiers 3)
  const steps12Rest = makeBeatSteps([
    { active: true, midi: 60, syllable: 'Na-' },
    { active: true, midi: 62, syllable: 'ção' },
    { active: false },
    { active: false },
  ]);
  const trip12 = applySmartTripletToBeat(steps12Rest, 0);
  assert.deepEqual(getTripletAttackSignature(trip12, 0), [true, true, false]);
  assert.equal(getTripletBeatLabel(trip12, 0), '³1-2-_');
  assert.equal(trip12[0].syllable, 'Na-');
  assert.equal(trip12[1].syllable, 'ção');
  assert.equal(trip12[2].active, false, 'Le 3e tiers conserve le silence');

  // 3) 2 notes (1-_-_-4) + clic sur 3 -> 1-_-3 (attaques sur tiers 1 et 3, silence sur tiers 2)
  const steps14Rest = makeBeatSteps([
    { active: true, midi: 60, syllable: 'Vo-' },
    { active: false },
    { active: false },
    { active: true, midi: 64, syllable: 'vó' },
  ]);
  const trip13 = applySmartTripletToBeat(steps14Rest, 0);
  assert.deepEqual(getTripletAttackSignature(trip13, 0), [true, false, true]);
  assert.equal(getTripletBeatLabel(trip13, 0), '³1-_-3');
  assert.equal(trip13[0].syllable, 'Vo-');
  assert.equal(trip13[1].active, false, 'Le 2e tiers (milieu) conserve le silence');
  assert.equal(trip13[2].syllable, 'vó');

  // Vérifie aussi 1-_-_-4 avec tenue au milieu -> le 2e tiers conserve la tenue (───)
  const steps14Tie = makeBeatSteps([
    { active: true, midi: 60, syllable: 'Vo-' },
    { active: true, isTie: true, midi: 60 },
    { active: true, isTie: true, midi: 60 },
    { active: true, midi: 64, syllable: 'vó' },
  ]);
  const trip13Tie = applySmartTripletToBeat(steps14Tie, 0);
  assert.deepEqual(getTripletAttackSignature(trip13Tie, 0), [true, false, true]);
  assert.equal(trip13Tie[1].active, true);
  assert.equal(trip13Tie[1].isTie, true);
  assert.equal(trip13Tie[1].note, '───');

  // 4) 2 notes (_-_-3-4) + clic sur 3 -> _-2-3 (silence sur tiers 1, attaques sur tiers 2 et 3)
  const steps34Rest = makeBeatSteps([
    { active: false },
    { active: false },
    { active: true, midi: 57, syllable: 'Lu-' },
    { active: true, midi: 60, syllable: 'an' },
  ]);
  const trip23 = applySmartTripletToBeat(steps34Rest, 0);
  assert.deepEqual(getTripletAttackSignature(trip23, 0), [false, true, true]);
  assert.equal(getTripletBeatLabel(trip23, 0), '³_-2-3');
  assert.equal(trip23[0].active, false, 'Le 1er tiers conserve le silence de tête');
  assert.equal(trip23[1].syllable, 'Lu-');
  assert.equal(trip23[2].syllable, 'an');

  // 5) Re-clic sur 3 quand déjà en triolet à 2 notes -> fait tourner 1-2-_ -> 1-_-3 -> _-2-3 -> 1-2-_
  const cycle1 = applySmartTripletToBeat(trip12, 0); // depuis 1-2-_ -> 1-_-3
  assert.equal(getTripletBeatLabel(cycle1, 0), '³1-_-3');
  assert.deepEqual([cycle1[0].syllable, cycle1[2].syllable], ['Na-', 'ção']);

  const cycle2 = applySmartTripletToBeat(cycle1, 0); // depuis 1-_-3 -> _-2-3
  assert.equal(getTripletBeatLabel(cycle2, 0), '³_-2-3');
  assert.deepEqual([cycle2[1].syllable, cycle2[2].syllable], ['Na-', 'ção']);

  const cycle3 = applySmartTripletToBeat(cycle2, 0); // depuis _-2-3 -> 1-2-_
  assert.equal(getTripletBeatLabel(cycle3, 0), '³1-2-_');
  assert.deepEqual([cycle3[0].syllable, cycle3[1].syllable], ['Na-', 'ção']);
}
console.log('✓ Test 2 validé : Conversion intelligente Binaire -> Triolet (1-2-3, 1-2-_, 1-_-3, _-2-3) et rotation cyclique.');

console.log('\n=== TEST 3 : GÉOMÉTRIE (beatWidth / 3), RÉ-ANALYSE MÉLODIQUE SUR TRIOLET & RETOUR EN BINAIRE (1-2-4) ===');
{
  const beatDurSec = 0.60;
  const stepDurSec = beatDurSec / 4;
  const pitchCurve = [];
  for (let tMs = 0; tMs <= 600; tMs += 10) {
    const tSec = tMs / 1000;
    const midiFloat = tSec < 0.20 ? 55.0 : tSec < 0.40 ? 57.0 : 60.0;
    pitchCurve.push({ timeSec: tSec, midiFloat, confidence: 0.95, rms: 0.22 });
  }

  const initialSteps = makeBeatSteps([
    { active: true, midi: 60, syllable: 'ba-' },
    { active: true, midi: 60, syllable: 'que-' },
    { active: true, isTie: true, midi: 60 },
    { active: true, midi: 60, syllable: 'bom' },
  ]);

  const tripletSteps = applySmartTripletToBeat(initialSteps, 0);
  const w0 = getStepTimeWindowSec(tripletSteps, 0, 0, beatDurSec);
  const w1 = getStepTimeWindowSec(tripletSteps, 1, 0, beatDurSec);
  const w2 = getStepTimeWindowSec(tripletSteps, 2, 0, beatDurSec);
  assert.ok(Math.abs(w0.startSec - 0.0) < 1e-6 && Math.abs(w0.endSec - 0.2) < 1e-6);
  assert.ok(Math.abs(w1.startSec - 0.2) < 1e-6 && Math.abs(w1.endSec - 0.4) < 1e-6);
  assert.ok(Math.abs(w2.startSec - 0.4) < 1e-6 && Math.abs(w2.endSec - 0.6) < 1e-6);

  const b0 = getStepHorizontalBoundsPx(tripletSteps, 0, 300);
  const b1 = getStepHorizontalBoundsPx(tripletSteps, 1, 300);
  const b2 = getStepHorizontalBoundsPx(tripletSteps, 2, 300);
  const b3 = getStepHorizontalBoundsPx(tripletSteps, 3, 300);
  assert.ok(Math.abs(b0.xPx - 0) < 1e-6 && Math.abs(b0.widthPx - 100) < 1e-6);
  assert.ok(Math.abs(b1.xPx - 100) < 1e-6 && Math.abs(b1.widthPx - 100) < 1e-6);
  assert.ok(Math.abs(b2.xPx - 200) < 1e-6 && Math.abs(b2.widthPx - 100) < 1e-6);
  assert.equal(b3.hidden, true);
  assert.equal(resolveStepIndexAtXPx(tripletSteps, 150, 300), 1);

  const reanalyzed = reanalyzeNotesOnAlignedSyllables({
    steps: tripletSteps,
    pitchCurve,
    gridStartSec: 0,
    stepDurationSec: stepDurSec,
    tonic: 'C',
    scaleType: 'major',
    vocalBounds: { minMidi: 45, maxMidi: 68, comfortMidi: 57 },
  });

  assert.equal(reanalyzed[0].midiNumber, 55);
  assert.equal(reanalyzed[1].midiNumber, 57);
  assert.equal(reanalyzed[2].midiNumber, 60);

  const backToBinary = applyBeatRhythmPreset(reanalyzed, 0, '1-2-4', 4);
  assert.equal(isBeatTriplet(backToBinary, 0), false);
  assert.equal(getTripletBeatLabel(backToBinary, 0), '3');
  for (let s = 0; s < 4; s++) assert.equal(backToBinary[s].tripletSlot, undefined);
}
console.log('✓ Test 3 validé : Fenêtres temporelles, géométrie, ré-analyse mélodique par tiers et retour en binaire sur 1-2-4.');

console.log('\n🎉 TOUS LES TESTS (LIGNES ROUGES HORS-GAMME & BOUTON TRIOLET INTELLIGENT [ 3 ]) SONT PASSÉS AVEC SUCCÈS !');
