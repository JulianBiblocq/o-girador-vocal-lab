/**
 * test_unified_pitch_dial_and_forced_align.mjs
 * Suite de validation automatisée Phase E :
 * 1. Masquage d'une trame sibilante synthétique (6 kHz bruitée) par sibilantBreathMasker (0 fausse note MIDI).
 * 2. Alignement forcé forcedMelodyAligner : 5 syllabes avec referenceMidiNotes = [67, 65, 64, 62, 60] et saut d'octave parasite à 79 sur Sol ➔ [67, 65, 64, 62, 60].
 * 3. Génération syllabe par syllabe StudentStepByStepTrainer : 2 syllabes consécutives sur même note (« Vo-vó ») = 2 étapes distinctes + validation mod 12.
 * 4. Gel anti-repisse slowNoteDetectorEngine (freezeForMs + 120 ms) + connexion dynamique maracatuVocalGameEngine (BPM, troupeKey, notes Toada active).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analyzeFrameSibilantBreath, maskSibilantsInPitchCurve } from '../src/audio/sibilantBreathMasker.ts';
import { quantizePitchToSteps } from '../src/audio/pitchToStepsQuantizer.ts';
import { alignStepsWithReferenceMidiNotes, formatPaperNoteCode, formatSolfegeNoteWithOctave } from '../src/audio/forcedMelodyAligner.ts';
import { reanalyzeNotesOnAlignedSyllables } from '../src/audio/syllableGuidedPitchReanalyzer.ts';
import { buildStudentStepByStepTargets, SamePitchReImpulseGate } from '../src/components/livret-treino/studentStepByStepHelper.ts';
import { SlowNoteStabilizer } from '../src/audio/slowNoteDetectorEngine.ts';
import { extractToadaVocalGameContext } from '../src/audio/maracatuVocalGameEngine.ts';
import { analyzeTirFranc, computeMaxHealthyEnduranceSec } from '../src/audio/vocalGameAnalyzers.ts';
import { mapCentsToDualScaleUnit, resolvePitchZoneColor } from '../src/components/common/unifiedPitchDialDrawer.ts';
import { createDefaultToadaProject, createDefaultVocalPattern } from '../src/utils/toadaProjectDefaults.ts';
import { pitchDialTranslationsFr } from '../src/i18n/pitchDialTranslationsFr.ts';
import { pitchDialTranslationsBr } from '../src/i18n/pitchDialTranslationsBr.ts';

const ROOT = path.resolve(import.meta.dirname, '..');

console.log('=== TEST SUITE PHASE E : CHERCHE-NOTES UNIFIÉ, ALIGNEMENT FORCÉ & PAS-À-PAS ===\n');

// ---------------------------------------------------------------------------
// 1. Masquage d'une trame sibilante synthétique (6 kHz bruitée) -> 0 fausse note MIDI
// ---------------------------------------------------------------------------
{
  const sr = 48000;
  const durSec = 2.4;
  const len = Math.floor(sr * durSec);
  const sibilantPcm = new Float32Array(len);
  let seed = 1337;
  const pseudoRand = () => { seed = (seed * 16807) % 2147483647; return (seed / 1073741823.5) - 1; };

  for (let i = 0; i < len; i++) {
    const t = i / sr;
    sibilantPcm[i] = 0.14 * Math.sin(2 * Math.PI * 6000 * t) + 0.06 * Math.sin(2 * Math.PI * 7100 * t) * pseudoRand();
  }

  const diag = analyzeFrameSibilantBreath(sibilantPcm, sr, 0, 1024);
  assert.equal(diag.isSibilantOrBreath, true, 'La trame synthétique à 6 kHz bruitée doit être classée sibilante/souffle');
  assert.ok(diag.hfToVocalRatio > 1.25, `Ratio HF/Corps attendu > 1.25, reçu ${diag.hfToVocalRatio}`);

  // Courbe brute simulée avec fausses détections de hauteur sur le souffle/sibilante
  const bogusCurve = Array.from({ length: 40 }, (_, idx) => ({
    timeSec: 0.2 + idx * 0.03,
    midiFloat: 68,
    confidence: 0.85,
  }));

  const maskedCurve = maskSibilantsInPitchCurve(bogusCurve, sibilantPcm, sr);
  assert.ok(maskedCurve.every((pt) => pt.midiFloat === 0), 'Toutes les trames sibilantes doivent avoir midiFloat === 0');

  const q = quantizePitchToSteps({
    pitchCurve: bogusCurve,
    pcm: sibilantPcm,
    sampleRate: sr,
    bpm: 100,
    beatsPerMeasure: 4,
    measuresCount: 1,
    beatResolutions: [4, 4, 4, 4],
    trimStartSec: 0,
    trimEndSec: durSec,
    hasAnacrusis: false,
    t1OffsetSec: 0.1,
  });

  const activeMidiSteps = q.gridSteps.filter((s) => s.active && (s.midiNumber ?? 0) > 0);
  assert.equal(activeMidiSteps.length, 0, `0 fausse note MIDI attendue sur trame sibilante 6 kHz, reçu ${activeMidiSteps.length}`);
  console.log('✓ 1. Masquage sibilante synthétique 6 kHz validé (0 fausse note MIDI générée).');
}

// ---------------------------------------------------------------------------
// 2. Alignement forcé forcedMelodyAligner : [67, 65, 64, 62, 60] malgré saut d'octave à 79 sur Sol crié
// ---------------------------------------------------------------------------
{
  assert.equal(formatPaperNoteCode(60), 'C', 'C4 implicite -> C');
  assert.equal(formatPaperNoteCode(66), 'F#', 'F#4 implicite -> F#');
  assert.equal(formatPaperNoteCode(57), 'A3', 'Hors octave 4 -> A3');
  assert.equal(formatPaperNoteCode(72), 'C5', 'Hors octave 4 -> C5');
  assert.equal(formatSolfegeNoteWithOctave(60, 'fr'), 'Do4');
  assert.equal(formatSolfegeNoteWithOctave(57, 'br'), 'Lá3');

  const syllables = ['Sol', 'Fa', 'Mi', 'Ré', 'Do'];
  const steps = Array.from({ length: 10 }, (_, idx) => {
    const isRoot = idx % 2 === 0;
    const sylIdx = Math.floor(idx / 2);
    return {
      stepIndex: idx,
      active: true,
      note: isRoot ? 'C4' : '───',
      midiNumber: 60,
      isTie: !isRoot,
      syllable: isRoot ? syllables[sylIdx] : '',
      syllableAttack: isRoot,
      velocity: isRoot ? 100 : 90,
      decay: 0.15,
    };
  });

  // Courbe brute simulée avec saut d'octave parasite à 79 (G5) sur la 1re syllabe criée ('Sol'), puis 65, 64, 62, 60
  const rawShoutedCurve = [];
  const simulatedRawMidis = [79, 65, 64, 62, 60];
  for (let b = 0; b < 5; b++) {
    const tStart = b * 0.30;
    for (let k = 0; k < 8; k++) {
      rawShoutedCurve.push({
        timeSec: tStart + 0.02 + k * 0.03,
        midiFloat: simulatedRawMidis[b],
        confidence: 0.92,
        rms: 0.18,
      });
    }
  }

  const referenceMidiNotes = [67, 65, 64, 62, 60];
  const aligned = alignStepsWithReferenceMidiNotes({
    steps,
    referenceMidiNotes,
    pitchCurve: rawShoutedCurve,
    gridStartSec: 0,
    beatDurationSec: 0.60,
  });

  const rootBricks = aligned.filter((s) => s.active && !s.isTie && s.note !== '───');
  assert.equal(rootBricks.length, 5);
  assert.deepEqual(
    rootBricks.map((s) => s.midiNumber),
    [67, 65, 64, 62, 60],
    'Les 5 briques doivent ressortir exactement à [67, 65, 64, 62, 60] malgré le saut parasite à 79'
  );
  assert.ok(rootBricks.every((s) => s.isUncertain === false), '0 doute en bijection 1:1 forcée');

  // Vérifie également le passage via reanalyzeNotesOnAlignedSyllables
  const viaReanalyzer = reanalyzeNotesOnAlignedSyllables({
    steps,
    pitchCurve: rawShoutedCurve,
    gridStartSec: 0,
    beatDurationSec: 0.60,
    referenceMidiNotes,
  });
  assert.deepEqual(
    viaReanalyzer.filter((s) => s.active && !s.isTie && s.note !== '───').map((s) => s.midiNumber),
    [67, 65, 64, 62, 60]
  );
  console.log('✓ 2. Alignement forcé forcedMelodyAligner validé ([67, 65, 64, 62, 60] exact malgré attaque criée à 79).');
}

// ---------------------------------------------------------------------------
// 3. Pas-à-pas Élève : 2 syllabes consécutives sur même note (« Vo-vó ») -> 2 étapes distinctes + mod 12
// ---------------------------------------------------------------------------
{
  const pat = createDefaultVocalPattern({ id: 'pat_vovo', name: 'Vovó falou', role: 'coro', hasAnacrusis: false, measuresCount: 1 });
  pat.mainSteps = [
    { stepIndex: 0, active: true, note: 'G4', midiNumber: 67, syllable: 'Vo-', syllableAttack: true, velocity: 100, decay: 0.15 },
    { stepIndex: 1, active: true, note: '───', midiNumber: 67, isTie: true, syllable: '', velocity: 90, decay: 0.15 },
    { stepIndex: 2, active: true, note: 'G4', midiNumber: 67, syllable: 'vó', syllableAttack: true, velocity: 100, decay: 0.15 },
    { stepIndex: 3, active: true, note: 'E4', midiNumber: 64, syllable: '_', isMelisma: true, syllableAttack: false, velocity: 95, decay: 0.15 },
  ];

  // Avec transposition troupeKey de -2 demi-tons : G4(67) -> F4(65), E4(64) -> D4(62)
  const targets = buildStudentStepByStepTargets(pat, -2, 'fr');
  assert.equal(targets.length, 3, 'Vo-, vó et le mélisme _ doivent produire 3 étapes séquentielles distinctes');
  assert.equal(targets[0].syllable, 'Vo-');
  assert.equal(targets[0].targetMidi, 65);
  assert.equal(targets[0].requiresReImpulseFromPrev, false);

  assert.equal(targets[1].syllable, 'vó');
  assert.equal(targets[1].targetMidi, 65);
  assert.equal(targets[1].requiresReImpulseFromPrev, true, 'La 2e syllabe consécutive sur la même note doit exiger un micro-relâchement/ré-impulsion');

  assert.equal(targets[2].isMelisma, true);
  assert.equal(targets[2].targetMidi, 62);

  // Vérifie le gate de ré-impulsion + validation octaveInvariant (mod 12 : élève chante F3 = 53 ~ 174.61 Hz face à cible F4 = 65)
  const gate = new SamePitchReImpulseGate();
  gate.prepareNextTarget(true);
  assert.equal(gate.isArmed(), false);
  gate.observeTick({ isVoiced: false, isFrozen: false, rawMidiFloat: 0, stabilizedMidiFloat: 0, displayedMidiNote: 0, centsDelta: 0, semitonesDelta: 0, holdProgress01: 0, holdDurationMs: 0, justValidatedMidi: null, rms: 0.002 }, 40);
  assert.equal(gate.isArmed(), true, 'Un bref micro-relâchement (40 ms) doit réarmer la 2e syllabe de même note');

  const stab = new SlowNoteStabilizer();
  const sr = 48000;
  const f3Hz = 440 * Math.pow(2, (53 - 69) / 12); // F3 (1 octave sous F4 = 65)
  const sineFrame = new Float32Array(2048);
  for (let i = 0; i < sineFrame.length; i++) sineFrame[i] = 0.15 * Math.sin((2 * Math.PI * f3Hz * i) / sr);

  let validatedMidi = null;
  for (let step = 0; step < 18; step++) {
    const tk = stab.processFrame(sineFrame, sr, 1000 + step * 40, {
      targetMidi: 65,
      octaveInvariant: true,
      requiredHoldMs: 500,
      toleranceCents: 35,
      minMidi: 36,
      maxMidi: 84,
    });
    if (tk.justValidatedMidi != null) validatedMidi = tk.justValidatedMidi;
  }
  assert.equal(validatedMidi, 65, 'La voix en F3 (53) doit valider la cible F4 (65) grâce à octaveInvariant (mod 12)');
  console.log('✓ 3. Pas-à-pas syllabe par syllabe (« Vo-vó » = 2 étapes distinctes + ré-impulsion + mod 12) validé.');
}

// ---------------------------------------------------------------------------
// 4. Gel anti-repisse (freezeForMs) + Connexion dynamique maracatuVocalGameEngine à la Toada active
// ---------------------------------------------------------------------------
{
  const stab = new SlowNoteStabilizer();
  const sr = 48000;
  const a4Frame = new Float32Array(2048);
  for (let i = 0; i < a4Frame.length; i++) a4Frame[i] = 0.16 * Math.sin((2 * Math.PI * 440 * i) / sr);

  // Déclenche un ping sonore de 500 ms à t = 2000 ms -> gel actif jusqu'à 2000 + 500 + 120 = 2620 ms
  stab.freezeForMs(500, 2000);
  const frozenTick = stab.processFrame(a4Frame, sr, 2580, { requiredHoldMs: 300 });
  assert.equal(frozenTick.isFrozen, true, 'Le détecteur doit rester gelé pendant le ping + 120 ms de queue');
  assert.equal(frozenTick.justValidatedMidi, null, '0 note validée par repisse haut-parleur pendant le gel');

  const resumedTick1 = stab.processFrame(a4Frame, sr, 2650, { requiredHoldMs: 300 });
  const resumedTick2 = stab.processFrame(a4Frame, sr, 2690, { requiredHoldMs: 300 });
  assert.equal(resumedTick2.isFrozen, false, 'Le détecteur doit reprendre normalement après la fin du gel');
  assert.equal(resumedTick2.displayedMidiNote, 69);

  // Connexion dynamique de maracatuVocalGameEngine au BPM, troupeKey et notes de la Toada active
  const proj = createDefaultToadaProject();
  proj.bpm = 114;
  proj.sungScaleRoot = 'A';
  proj.sungScaleMode = 'natural_minor';
  proj.transpositionSemitones = 3; // troupeKey = C (Do mineur), +3 demi-tons
  proj.referencePitchHz = 442;
  proj.patterns[0].bpm = 116;
  proj.patterns[0].hasAnacrusis = false;
  proj.patterns[0].mainSteps = [
    { stepIndex: 0, active: true, note: 'A3', midiNumber: 57, syllable: 'Nagô', syllableAttack: true, velocity: 100, decay: 0.15 },
    { stepIndex: 1, active: true, note: 'E4', midiNumber: 64, syllable: 'Ô───', syllableAttack: true, velocity: 100, decay: 0.15 },
    { stepIndex: 2, active: true, note: '───', midiNumber: 64, isTie: true, syllable: '', velocity: 90, decay: 0.15 },
    { stepIndex: 3, active: true, note: '───', midiNumber: 64, isTie: true, syllable: '', velocity: 90, decay: 0.15 },
  ];

  const gameCtx = extractToadaVocalGameContext(proj, proj.patterns[0]);
  assert.equal(gameCtx.bpm, 116, 'Le BPM du jeu doit suivre dynamiquement la Toada/phrase active');
  assert.equal(gameCtx.troupeKeyRoot, 'C', 'La tonalité du jeu doit suivre troupeKey (A + 3 st = C)');
  assert.equal(gameCtx.referencePitchHz, 442);
  assert.equal(gameCtx.attackNote, 60, 'A3 (57) transposé +3 st -> C4 (60)');
  assert.equal(gameCtx.holdNote, 67, 'La voyelle longue E4 (64, tenue 3 pas) transposée +3 st -> G4 (67)');
  assert.equal(gameCtx.hasToadaNotes, true);

  // Vérification Jeu de la Flèche (150 ms attaque <= 35c sans scoop > 60c + tenue >= 1.0s) & Chrono Endurance
  const cleanArrowSamples = Array.from({ length: 24 }, (_, i) => ({
    timeSec: i * 0.05,
    pitchMidi: 60.12, // +12 cents (<= 35c) dès t=0 jusqu'à 1.15s
    rms: 0.09,
    brillianceRatio: 0.8,
    projectionScorePct: 58,
    projectionStatus: 'roda_optimal',
  }));
  const arrowOk = analyzeTirFranc(60, cleanArrowSamples);
  assert.equal(arrowOk.isSuccess, true);
  assert.equal(arrowOk.arrowPlanted, true);

  const scoopedArrowSamples = cleanArrowSamples.map((s, i) => ({
    ...s,
    pitchMidi: i <= 2 ? 59.2 : 60.0, // Scoop montant de 80 cents dans les 150 premières ms
  }));
  const arrowScooped = analyzeTirFranc(60, scoopedArrowSamples);
  assert.equal(arrowScooped.isSuccess, false, 'Un scoop > 60 cents doit invalider la flèche');
  assert.ok(computeMaxHealthyEnduranceSec(60, cleanArrowSamples) >= 1.1);

  // Vérification double échelle cadran + parité i18n Phase E
  assert.ok(Math.abs(mapCentsToDualScaleUnit(45) - 0.52) < 1e-6);
  assert.ok(Math.abs(mapCentsToDualScaleUnit(-1200) - (-1)) < 1e-6);
  assert.equal(resolvePitchZoneColor(20, true), '#10b981');
  assert.equal(resolvePitchZoneColor(55, true), '#f59e0b');
  assert.equal(resolvePitchZoneColor(95, true), '#ef4444');
  assert.deepEqual(Object.keys(pitchDialTranslationsFr).sort(), Object.keys(pitchDialTranslationsBr).sort());

  // 0 emoji couleur 3D dans les fichiers créés en Phase E
  const phaseEFiles = [
    'src/audio/tonicDroneSynth.ts',
    'src/audio/sibilantBreathMasker.ts',
    'src/audio/slowNoteDetectorEngine.ts',
    'src/audio/forcedMelodyAligner.ts',
    'src/audio/toadaGameContextExtractor.ts',
    'src/components/common/UnifiedPitchDialCanvas.tsx',
    'src/components/common/unifiedPitchDialDrawer.ts',
    'src/components/dictation/DictationNoteRibbon.tsx',
    'src/components/dictation/MestreNoteDictationModal.tsx',
    'src/components/livret-treino/StudentStepByStepTrainer.tsx',
    'src/i18n/pitchDialTranslationsFr.ts',
    'src/i18n/pitchDialTranslationsBr.ts',
  ];
  const emoji3DRegex = /\p{Extended_Pictographic}/u;
  for (const rel of phaseEFiles) {
    const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.equal(emoji3DRegex.test(content), false, `Emoji couleur 3D interdit détecté dans ${rel}`);
  }
  console.log('✓ 4. Gel anti-repisse (freezeForMs), connexion dynamique Toada, Flèche 150ms+1s & i18n/0-emoji validés.');
}

console.log('\nTOUS LES TESTS PHASE E (CHERCHE-NOTES UNIFIÉ, ALIGNEMENT FORCÉ & PAS-À-PAS) SONT PASSÉS AVEC SUCCÈS !');
