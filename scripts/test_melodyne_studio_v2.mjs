/**
 * test_melodyne_studio_v2.mjs
 * Suite de tests automatisés pour Melodyne Studio 2.0 :
 * 1. Résolution locale multi-briques (C4=60, E4=64, G4=67 + liaisons) sur [ Phrase entière ]
 * 2. Décomposition f0(t) à 3 DDL : élimination d'une dérive lente (+0.6 st) et préservation > 85% du vibrato 5.5 Hz
 * 3. Préservation bit-perfect 1:1 des consonnes non voisées (ZCR > 0.35, sans f0) entre deux voyelles
 * 4. Synthèse TD-PSOLA sur sinusoïde 220 Hz -> 246.94 Hz (+2 demi-tons) : stabilité RMS (±5%), 0 NaN, 0 clic
 */
import assert from 'node:assert/strict';
import {
  computeCorrectedPitchCurve,
  correctAudioPitchWithMelodyne,
  ensureRegionForMovedBrick,
} from '../src/audio/melodynePitchCorrector.ts';

console.log('🧪 Lancement de la suite de tests Melodyne Studio 2.0...');

// ============================================================================
// TEST 1 : Résolution locale multi-briques (C4=60, E4=64, G4=67) sur [ Phrase entière ]
// ============================================================================
{
  const stepDur = 0.25;
  // 12 pas = 3.0s : Brique 1 (pas 0..3 = C4 60), Brique 2 (pas 4..7 = E4 64), Brique 3 (pas 8..11 = G4 67)
  const makeBrickSteps = (startIdx, midi, noteName) => [
    { stepIndex: startIdx, active: true, note: noteName, midiNumber: midi, velocity: 100, decay: stepDur },
    { stepIndex: startIdx + 1, active: true, note: '───', isTie: true, midiNumber: midi, velocity: 90, decay: stepDur },
    { stepIndex: startIdx + 2, active: true, note: '───', isTie: true, midiNumber: midi, velocity: 90, decay: stepDur },
    { stepIndex: startIdx + 3, active: true, note: '───', isTie: true, midiNumber: midi, velocity: 90, decay: stepDur },
  ];
  const allSteps = [
    ...makeBrickSteps(0, 60, 'C4'),
    ...makeBrickSteps(4, 64, 'E4'),
    ...makeBrickSteps(8, 67, 'G4'),
  ];
  const totalDurationSec = 3.0;

  // Le chanteur chante 0.4 demi-ton trop bas sur chaque note (59.6, 63.6, 66.6)
  const rawPitchCurve = [];
  for (let t = 0.05; t <= 2.95; t = Math.round((t + 0.01) * 100) / 100) {
    const baseMidi = t < 1.0 ? 59.6 : t < 2.0 ? 63.6 : 66.6;
    rawPitchCurve.push({ timeSec: t, midiFloat: baseMidi });
  }

  const wholePhraseRegion = [{
    id: 'reg_whole',
    startSec: 0,
    endSec: totalDurationSec,
    pitchCenterPct: 100,
    driftCorrectionPct: 100,
    flattenPct: 100,
  }];

  const corrected = computeCorrectedPitchCurve(rawPitchCurve, allSteps, totalDurationSec, wholePhraseRegion, 0, 3.0);

  const b1Pts = corrected.filter((p) => p.timeSec >= 0.15 && p.timeSec <= 0.85);
  const b2Pts = corrected.filter((p) => p.timeSec >= 1.15 && p.timeSec <= 1.85);
  const b3Pts = corrected.filter((p) => p.timeSec >= 2.15 && p.timeSec <= 2.85);

  const avg = (arr) => arr.reduce((a, p) => a + p.midiFloat, 0) / arr.length;
  assert.ok(Math.abs(avg(b1Pts) - 60) < 0.05, `Brique 1 devrait être alignée sur C4=60, obtenu ${avg(b1Pts)}`);
  assert.ok(Math.abs(avg(b2Pts) - 64) < 0.05, `Brique 2 devrait être alignée sur E4=64, obtenu ${avg(b2Pts)}`);
  assert.ok(Math.abs(avg(b3Pts) - 67) < 0.05, `Brique 3 devrait être alignée sur G4=67, obtenu ${avg(b3Pts)}`);

  // Vérification de ensureRegionForMovedBrick lors du déplacement vertical d'une brique
  const syncedRegions = ensureRegionForMovedBrick([], allSteps, 4, totalDurationSec, 0, 3.0);
  assert.equal(syncedRegions.length, 1);
  assert.ok(Math.abs(syncedRegions[0].startSec - 1.0) < 0.01 && Math.abs(syncedRegions[0].endSec - 2.0) < 0.01);
  console.log('  ✅ Test 1 OK : [ Phrase entière ] aligne localement C4 (60), E4 (64), G4 (67) et les liaisons.');
}

// ============================================================================
// TEST 2 : Décomposition f0(t) : correction de dérive lente (+0.6 st) & vibrato 5.5 Hz (> 85%)
// ============================================================================
{
  const totalDurationSec = 1.6;
  const allSteps = [
    { stepIndex: 0, active: true, note: 'C4', midiNumber: 60, velocity: 100, decay: 0.4 },
    { stepIndex: 1, active: true, note: '───', isTie: true, midiNumber: 60, velocity: 90, decay: 0.4 },
    { stepIndex: 2, active: true, note: '───', isTie: true, midiNumber: 60, velocity: 90, decay: 0.4 },
    { stepIndex: 3, active: true, note: '───', isTie: true, midiNumber: 60, velocity: 90, decay: 0.4 },
  ];

  // Note chantée autour de 60 avec une dérive linéaire de -0.3 à +0.3 (amplitude totale +0.6 demi-ton)
  // + un vibrato sinusoïdal à 5.5 Hz d'amplitude A_vib = 0.35 demi-ton
  const vibAmp = 0.35;
  const vibFreq = 5.5;
  const rawPitchCurve = [];
  for (let i = 0; i <= 160; i++) {
    const t = i * 0.01;
    const drift = -0.3 + 0.6 * (t / totalDurationSec);
    const vib = vibAmp * Math.sin(2 * Math.PI * vibFreq * t);
    rawPitchCurve.push({ timeSec: t, midiFloat: 60 + drift + vib });
  }

  const regions = [{
    id: 'reg_drift_vib',
    startSec: 0,
    endSec: totalDurationSec,
    pitchCenterPct: 100,
    driftCorrectionPct: 100,
    flattenPct: 0,
  }];

  const corrected = computeCorrectedPitchCurve(rawPitchCurve, allSteps, totalDurationSec, regions, 0, totalDurationSec);

  // Vérifie que la dérive lente entre le début (0.15..0.50s) et la fin (1.10..1.45s) a été éliminée
  const headPts = corrected.filter((p) => p.timeSec >= 0.15 && p.timeSec <= 0.514);
  const tailPts = corrected.filter((p) => p.timeSec >= 1.05 && p.timeSec <= 1.414);
  const avgHead = headPts.reduce((a, p) => a + p.midiFloat, 0) / headPts.length;
  const avgTail = tailPts.reduce((a, p) => a + p.midiFloat, 0) / tailPts.length;
  assert.ok(Math.abs(avgTail - avgHead) < 0.06, `Dérive lente non éliminée: head=${avgHead}, tail=${avgTail}`);

  // Vérifie que l'amplitude RMS du vibrato résiduel à 5.5 Hz est conservée à > 85%
  const corePts = corrected.filter((p) => p.timeSec >= 0.2 && p.timeSec <= 1.4);
  const rmsCorrectedVib = Math.sqrt(corePts.reduce((a, p) => a + Math.pow(p.midiFloat - 60, 2), 0) / corePts.length);
  const expectedVibRms = vibAmp / Math.SQRT2;
  const preservedRatio = rmsCorrectedVib / expectedVibRms;
  assert.ok(preservedRatio > 0.85, `Vibrato 5.5 Hz devait être préservé à > 85%, obtenu ${(preservedRatio * 100).toFixed(1)}%`);
  console.log(`  ✅ Test 2 OK : Dérive lente +0.6 st éliminée, vibrato 5.5 Hz préservé à ${(preservedRatio * 100).toFixed(1)}%.`);
}

// ============================================================================
// TEST 3 : Préservation bit-perfect 1:1 des consonnes non voisées ([s]/[ch], ZCR > 0.35)
// ============================================================================
{
  const sampleRate = 44100;
  const totalDurationSec = 1.2;
  const n = Math.round(totalDurationSec * sampleRate);
  const rawAudio = new Float32Array(n);

  // 0.0..0.4s : Voyelle 220 Hz | 0.4..0.8s : Consonne fricative haute fréquence ZCR > 0.35 | 0.8..1.2s : Voyelle 220 Hz
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    if (t >= 0.4 && t <= 0.8) {
      // Bruit fricatif déterministe à fort taux de passage par zéro (ZCR ~ 0.5)
      rawAudio[i] = ((i % 2 === 0) ? 1 : -1) * (0.25 + 0.1 * Math.sin(i * 1.7));
    } else {
      rawAudio[i] = 0.6 * Math.sin(2 * Math.PI * 220 * t);
    }
  }

  // Courbe f0 présente uniquement sur les deux voyelles (aucun point entre 0.4s et 0.8s)
  const rawPitchCurve = [];
  for (let t = 0.02; t <= 0.38; t = Math.round((t + 0.01) * 100) / 100) rawPitchCurve.push({ timeSec: t, midiFloat: 57 });
  for (let t = 0.82; t <= 1.18; t = Math.round((t + 0.01) * 100) / 100) rawPitchCurve.push({ timeSec: t, midiFloat: 57 });

  const allSteps = [
    { stepIndex: 0, active: true, note: 'B3', midiNumber: 59, velocity: 100, decay: 0.6 },
    { stepIndex: 1, active: true, note: 'B3', midiNumber: 59, velocity: 100, decay: 0.6 },
  ];
  const regions = [{ id: 'reg_all', startSec: 0, endSec: totalDurationSec, pitchCenterPct: 100, driftCorrectionPct: 100, flattenPct: 100 }];

  const outAudio = correctAudioPitchWithMelodyne(rawAudio, sampleRate, totalDurationSec, rawPitchCurve, allSteps, regions, 0, totalDurationSec);

  // Au cœur de la consonne [0.45s .. 0.75s], chaque échantillon doit être bit-perfect 1:1 avec rawAudio
  const cStart = Math.floor(0.45 * sampleRate), cEnd = Math.floor(0.75 * sampleRate);
  let maxDiff = 0;
  for (let i = cStart; i <= cEnd; i++) {
    const d = Math.abs(outAudio[i] - rawAudio[i]);
    if (d > maxDiff) maxDiff = d;
  }
  assert.equal(maxDiff, 0, `La consonne non voisée devrait être bit-perfect 1:1 (maxDiff=${maxDiff})`);
  console.log('  ✅ Test 3 OK : Consonne fricative non voisée préservée en bit-perfect 1:1 (maxDiff = 0).');
}

// ============================================================================
// TEST 4 : Synthèse TD-PSOLA sur sinusoïde 220 Hz -> 246.94 Hz (+2 st) : RMS ±5%, 0 clic, 0 NaN
// ============================================================================
{
  const sampleRate = 44100;
  const totalDurationSec = 1.0;
  const n = Math.round(totalDurationSec * sampleRate);
  const rawAudio = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    rawAudio[i] = 0.7 * Math.sin(2 * Math.PI * 220 * (i / sampleRate));
  }

  const rawPitchCurve = [];
  for (let t = 0.01; t <= 0.99; t = Math.round((t + 0.01) * 100) / 100) {
    rawPitchCurve.push({ timeSec: t, midiFloat: 57 }); // A3 = 220 Hz
  }

  const allSteps = [
    { stepIndex: 0, active: true, note: 'B3', midiNumber: 59, velocity: 100, decay: 1.0 }, // B3 = 246.94 Hz (+2 demi-tons)
  ];
  const regions = [{ id: 'reg_sine', startSec: 0, endSec: totalDurationSec, pitchCenterPct: 100, driftCorrectionPct: 100, flattenPct: 100 }];

  const outAudio = correctAudioPitchWithMelodyne(rawAudio, sampleRate, totalDurationSec, rawPitchCurve, allSteps, regions, 0, totalDurationSec);

  const s0 = Math.floor(0.1 * sampleRate), s1 = Math.floor(0.9 * sampleRate);
  let sumInSq = 0, sumOutSq = 0, maxStepJump = 0, zeroCrossingsUp = 0;
  for (let i = s0; i < s1; i++) {
    assert.ok(Number.isFinite(outAudio[i]), `NaN ou Inf détecté à l'échantillon ${i}`);
    sumInSq += rawAudio[i] * rawAudio[i];
    sumOutSq += outAudio[i] * outAudio[i];
    const jump = Math.abs(outAudio[i + 1] - outAudio[i]);
    if (jump > maxStepJump) maxStepJump = jump;
    if (outAudio[i] < 0 && outAudio[i + 1] >= 0) zeroCrossingsUp++;
  }

  const rmsIn = Math.sqrt(sumInSq / (s1 - s0));
  const rmsOut = Math.sqrt(sumOutSq / (s1 - s0));
  const rmsDiffPct = (Math.abs(rmsOut - rmsIn) / rmsIn) * 100;
  const estFreqHz = zeroCrossingsUp / 0.8;

  assert.ok(rmsDiffPct <= 5.0, `Écart RMS trop élevé : ${rmsDiffPct.toFixed(2)}% (attendu <= 5%)`);
  assert.ok(maxStepJump < 0.12, `Discontinuité / clic détecté : maxStepJump=${maxStepJump.toFixed(4)}`);
  assert.ok(Math.abs(estFreqHz - 246.94) < 3.0, `Fréquence synthétisée incorrecte : ${estFreqHz.toFixed(2)} Hz (attendu ~246.94 Hz)`);
  console.log(`  ✅ Test 4 OK : TD-PSOLA 220 Hz ➔ ${estFreqHz.toFixed(2)} Hz, écart RMS = ${rmsDiffPct.toFixed(2)}% (<= 5%), 0 clic, 0 NaN.`);
}

console.log('🎉 Tous les tests Melodyne Studio 2.0 ont réussi à 100 % !');
