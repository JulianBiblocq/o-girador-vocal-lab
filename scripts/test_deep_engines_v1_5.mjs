import assert from 'node:assert/strict';
import { quantizePitchToSteps } from '../src/audio/pitchToStepsQuantizer.ts';
import { applyLyricsSyllablesToSteps } from '../src/utils/syllableAligner.ts';
import { extractTimeAnchors } from '../src/utils/timeAnchorParser.ts';
import { computeVowelCoreMidi, estimateGlobalTuningOffset } from '../src/audio/pitchStepSegmentation.ts';
import { analyzeVoicingAndEpochs } from '../src/audio/tdPsolaEpochDetector.ts';
import { applyTdPsolaPitchCorrection } from '../src/audio/tdPsolaPitchShifter.ts';
import { alignT1ByAnchorCrossCorrelation } from '../src/utils/slicerAlignmentHelper.ts';

console.log('--- TEST DES 4 MOTEURS HAUTE-PRÉCISION v1.5 (First-Try Lock) ---');

// ============================================================================
// TEST 1 : Placement Sub-Temps Maracatu (3 syllabes + pics sur doubles 1, 2 et 4 => s = [0, 1, 3])
// ============================================================================
{
  const bpm = 60; // 1 beat = 1.0s, 1 double-croche (sub-beat) = 0.25s
  const sampleRate = 4000;
  const pcm = new Float32Array(sampleRate * 4);
  // Beat 1 [0.00s .. 1.00s] : 3 impulsions vocales sur s=0 (0.00..0.22s), s=1 (0.26..0.48s) et s=3 (0.76..0.98s)
  const fillBurst = (t0, t1, amp = 0.5) => {
    for (let i = Math.floor(t0 * sampleRate); i < Math.floor(t1 * sampleRate); i++) {
      pcm[i] = amp * Math.sin((2 * Math.PI * 261.63 * i) / sampleRate);
    }
  };
  fillBurst(0.01, 0.21, 0.6); // s = 0 (1re double)
  fillBurst(0.27, 0.70, 0.55); // s = 1 tenue sur s = 2 (2e double)
  fillBurst(0.77, 0.98, 0.65); // s = 3 (4e double)

  const pitchCurve = [];
  for (let t = 0.0; t <= 1.0; t += 0.01) {
    pitchCurve.push({ timeSec: Math.round(t * 1000) / 1000, midiFloat: 60.0, confidence: 0.95, rms: 0.4 });
  }

  const timeAnchors = [{
    beat: 1,
    measureOffset: 0,
    isRest: false,
    isInitialRest: false,
    isSustainedHold: false,
    hasLeadingRest: false,
    textSlice: 'maraca',
    syllables: ['ma', 'ra', 'ca '],
  }];

  const q = quantizePitchToSteps({
    pitchCurve,
    bpm,
    beatsPerMeasure: 4,
    measuresCount: 1,
    beatResolutions: [4, 4, 4, 4],
    trimStartSec: 0,
    trimEndSec: 1.0,
    hasAnacrusis: false,
    t1OffsetSec: 0,
    pcm,
    sampleRate,
    timeAnchors,
  });

  const aligned = applyLyricsSyllablesToSteps(q.gridSteps, 'maraca', timeAnchors, 4, 4);
  const beat1 = aligned.slice(0, 4);
  const attackSubBeats = beat1
    .map((st, idx) => (st.active && !st.isTie && st.note !== '───' ? idx : -1))
    .filter((idx) => idx !== -1);

  assert.deepEqual(attackSubBeats, [0, 1, 3], 'Moteur 1 : 3 syllabes avec pics sur 1, 2 et 4 doivent tomber sur s = [0, 1, 3] et jamais [0, 1, 2]');
  assert.equal(beat1[0].syllable, 'ma', 's=0 -> "ma"');
  assert.equal(beat1[1].syllable, 'ra', 's=1 -> "ra"');
  assert.equal(beat1[2].note, '───', 's=2 -> liaison tenue "───"');
  assert.equal(beat1[3].syllable?.trim(), 'ca', 's=3 -> "ca"');
  console.log('✅ Test 1 OK : Placement Sub-Temps Maracatu s = [0, 1, 3] validé.');
}

// ============================================================================
// TEST 2 : Syllabe mangée / élidée (2 syllabes écrites sur T1 mais 1 seule impulsion vocale
//          => fusion sur 1 seule brique sans décaler T2)
// ============================================================================
{
  const bpm = 60; // 1 beat = 1.0s
  const sampleRate = 4000;
  const pcm = new Float32Array(sampleRate * 4);
  // Temps 1 [0.00..1.00s] : 1 seule impulsion continue et plate ("baque" chanté d'un bloc)
  for (let i = Math.floor(0.02 * sampleRate); i < Math.floor(0.95 * sampleRate); i++) {
    pcm[i] = 0.5 * Math.sin((2 * Math.PI * 261.63 * i) / sampleRate);
  }
  // Temps 2 [1.00..2.00s] : 2 impulsions franches ("vi" sur s=0 et "ou" sur s=2)
  for (let i = Math.floor(1.02 * sampleRate); i < Math.floor(1.45 * sampleRate); i++) {
    pcm[i] = 0.5 * Math.sin((2 * Math.PI * 293.66 * i) / sampleRate);
  }
  for (let i = Math.floor(1.52 * sampleRate); i < Math.floor(1.95 * sampleRate); i++) {
    pcm[i] = 0.55 * Math.sin((2 * Math.PI * 329.63 * i) / sampleRate);
  }

  const pitchCurve = [];
  for (let t = 0.02; t <= 0.95; t += 0.01) pitchCurve.push({ timeSec: t, midiFloat: 60.0, confidence: 0.95, rms: 0.4 });
  for (let t = 1.02; t <= 1.45; t += 0.01) pitchCurve.push({ timeSec: t, midiFloat: 62.0, confidence: 0.95, rms: 0.4 });
  for (let t = 1.52; t <= 1.95; t += 0.01) pitchCurve.push({ timeSec: t, midiFloat: 64.0, confidence: 0.95, rms: 0.45 });

  const { timeAnchors } = extractTimeAnchors('[1]baque [2]virou', 4, true);
  const q = quantizePitchToSteps({
    pitchCurve,
    bpm,
    beatsPerMeasure: 4,
    measuresCount: 1,
    beatResolutions: [4, 4, 4, 4],
    trimStartSec: 0,
    trimEndSec: 2.0,
    hasAnacrusis: false,
    t1OffsetSec: 0,
    pcm,
    sampleRate,
    timeAnchors,
  });

  const aligned = applyLyricsSyllablesToSteps(q.gridSteps, 'baque virou', timeAnchors, 4, 4);
  const beat1Attacks = aligned.slice(0, 4).filter((s) => s.active && !s.isTie && s.note !== '───');
  assert.equal(beat1Attacks.length, 1, 'Moteur 1 : 2 syllabes écrites mais 1 seule impulsion vocale => 1 seule brique sur le Temps 1');
  assert.equal(aligned[0].syllable?.trim(), 'baque', 'Moteur 1 : Les 2 syllabes ["ba", "que "] sont fusionnées en "baque" sur la brique du Temps 1');
  assert.equal(aligned[4].syllable?.trim(), 'vi', 'Moteur 1 : Le Temps 2 démarre exactement sur "vi" (aucun décalage inter-temps)');
  assert.equal(aligned[6].syllable?.trim(), 'rou', 'Moteur 1 : La 2e syllabe du Temps 2 ("rou") reste parfaitement à sa place');
  console.log('✅ Test 2 OK : Fusion auto de syllabe mangée sur 1 brique sans décalage du temps suivant.');
}

// ============================================================================
// TEST 3 : Noyau Harmonique Stable + Auto-Diapason
//          (50 ms de scoop à -2 demi-tons suivi d'un plateau stable à Do4 MIDI 60 à +32 cents => MIDI 60)
// ============================================================================
{
  const curve = [];
  // 0..50 ms : scoop d'attaque de MIDI 58.0 (-2 demi-tons) vers 60.32
  for (let ms = 0; ms < 50; ms += 5) {
    const ratio = ms / 50;
    curve.push({
      timeSec: ms / 1000,
      midiFloat: 58.0 + ratio * 2.32,
      confidence: 0.72,
      rms: 0.15,
    });
  }
  // 50..400 ms : plateau vocal stable à Do4 (60) + 32 cents (60.32)
  for (let ms = 50; ms <= 400; ms += 10) {
    curve.push({
      timeSec: ms / 1000,
      midiFloat: 60.32,
      confidence: 0.96,
      rms: 0.50,
    });
  }

  const tuningOffset = estimateGlobalTuningOffset(curve);
  assert.ok(Math.abs(tuningOffset - 0.32) < 0.02, `Auto-diapason détecté (${tuningOffset}) proche de +0.32 st`);

  const core = computeVowelCoreMidi(curve, 0.0, 0.40, tuningOffset);
  assert.ok(core !== null, 'computeVowelCoreMidi retourne un résultat valide');
  assert.equal(core.midi, 60, 'Moteur 2 : Note avec 50ms de scoop (-2 st) + plateau à Do4 (+32 cents) quantifiée pile sur MIDI 60 (Do4)');
  assert.ok(Math.abs(core.midiFloat - 60.0) < 0.03, `Cœur de voyelle calibré (${core.midiFloat.toFixed(3)}) centré sur 60.00`);
  console.log('✅ Test 3 OK : Estimateur Cœur de Voyelle + Auto-Diapason pile sur MIDI 60 (Do4).');
}

// ============================================================================
// TEST 4 : Moteur TD-PSOLA 3.0 à Phase Glottique Pure
//          (100 % des consonnes non-voisées bit-perfect maxDiff === 0, signal continu sans clic)
// ============================================================================
{
  const sampleRate = 16000;
  const totalSec = 0.6;
  const n = Math.floor(sampleRate * totalSec);
  const rawAudio = new Float32Array(n);

  // 0.00..0.15s : Consonne fricative non-voisée haute fréquence (ZCR élevé)
  for (let i = 0; i < Math.floor(0.15 * sampleRate); i++) {
    rawAudio[i] = 0.18 * ((i % 2 === 0 ? 1 : -1) * (0.7 + 0.3 * Math.sin(i * 0.37)));
  }
  // 0.15..0.50s : Voyelle voisée harmonique riche (f0 = 200 Hz + formants F1=600 Hz, F2=1200 Hz)
  const f0 = 200;
  for (let i = Math.floor(0.15 * sampleRate); i < Math.floor(0.50 * sampleRate); i++) {
    const t = i / sampleRate;
    const env = Math.sin(Math.PI * ((t - 0.15) / 0.35));
    rawAudio[i] = env * (
      0.45 * Math.sin(2 * Math.PI * f0 * t) +
      0.25 * Math.sin(2 * Math.PI * (2 * f0) * t) +
      0.15 * Math.sin(2 * Math.PI * (3 * f0) * t)
    );
  }
  // 0.50..0.60s : Consonne finale non-voisée
  for (let i = Math.floor(0.50 * sampleRate); i < n; i++) {
    rawAudio[i] = 0.12 * (i % 2 === 0 ? 1 : -1);
  }

  const rawPitchCurve = [];
  for (let t = 0.16; t <= 0.49; t += 0.01) {
    rawPitchCurve.push({ timeSec: t, midiFloat: 55.35, confidence: 0.95, rms: 0.35 });
  }

  const analysis = analyzeVoicingAndEpochs(rawAudio, sampleRate, rawPitchCurve, []);
  const corrected = applyTdPsolaPitchCorrection(rawAudio, sampleRate, analysis, [
    { startSec: 0.0, endSec: totalSec, shiftSemitonesAt: () => 0.65 },
  ]);

  // Vérifier maxDiff === 0 sur la consonne non-voisée [0.00 .. 0.13s] et [0.52 .. 0.60s]
  let maxUnvoicedDiff = 0;
  for (let i = 0; i < Math.floor(0.13 * sampleRate); i++) {
    maxUnvoicedDiff = Math.max(maxUnvoicedDiff, Math.abs(corrected[i] - rawAudio[i]));
  }
  for (let i = Math.floor(0.52 * sampleRate); i < n; i++) {
    maxUnvoicedDiff = Math.max(maxUnvoicedDiff, Math.abs(corrected[i] - rawAudio[i]));
  }
  assert.equal(maxUnvoicedDiff, 0, 'Moteur 3 : 100 % des consonnes non-voisées doivent être préservées en bit-perfect (maxDiff === 0)');

  // Vérifier l'absence de clic ou NaN dans la zone voisée corrigée
  let maxStepJump = 0;
  for (let i = Math.floor(0.18 * sampleRate); i < Math.floor(0.47 * sampleRate); i++) {
    assert.ok(Number.isFinite(corrected[i]), 'Aucun NaN/Infinity dans le signal TD-PSOLA');
    maxStepJump = Math.max(maxStepJump, Math.abs(corrected[i] - corrected[i - 1]));
  }
  assert.ok(maxStepJump < 0.35, `Moteur 3 : Signal TD-PSOLA lisse et sans clic (maxStepJump=${maxStepJump.toFixed(4)} < 0.35)`);
  console.log('✅ Test 4 OK : TD-PSOLA 3.0 préserve 100 % des consonnes non-voisées (maxDiff === 0) sans clic.');
}

// ============================================================================
// TEST 5 : Auto-Calage Acoustique du Temps 1 (t1OffsetSec) par Corrélation Croisée
// ============================================================================
{
  const bpm = 120; // beatDur = 0.50s
  const sampleRate = 2000;
  const pcm = new Float32Array(sampleRate * 6);
  const { timeAnchors } = extractTimeAnchors('[4]Vem [M1•1]Luanda [2]nossa', 4, false);
  // Nominal T1 = 2.00s, mais le chanteur a chanté avec un décalage réel de +0.14s (Vrai T1 = 2.14s, levée [4] à 1.64s)
  const trueT1 = 2.14;
  const addPulse = (t0, dur, amp) => {
    for (let i = Math.floor(t0 * sampleRate); i < Math.floor((t0 + dur) * sampleRate); i++) {
      if (i >= 0 && i < pcm.length) pcm[i] = amp * Math.sin((2 * Math.PI * 220 * i) / sampleRate);
    }
  };
  addPulse(trueT1 - 0.50, 0.20, 0.45); // Anacrouse [4]
  addPulse(trueT1, 0.25, 0.85);        // Attaque forte du Temps 1 [M1•1]
  addPulse(trueT1 + 0.50, 0.22, 0.55); // Temps [2]

  const alignedT1 = alignT1ByAnchorCrossCorrelation(pcm, sampleRate, 2.00, bpm, timeAnchors, true, 4, 0.30);
  assert.ok(Math.abs(alignedT1 - trueT1) <= 0.03, `Moteur 4 : T1 recalé par corrélation croisée (${alignedT1}s) sur le vrai T1 (${trueT1}s)`);
  console.log(`✅ Test 5 OK : Auto-calage T1 par corrélation croisée validé (${alignedT1}s vs ${trueT1}s).`);
}

console.log('\n🎉 TOUS LES TESTS DES 4 MOTEURS HAUTE-PRÉCISION v1.5 SONT VALIDÉS AVEC SUCCÈS !');

