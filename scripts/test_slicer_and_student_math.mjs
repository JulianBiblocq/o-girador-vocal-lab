/**
 * scripts/test_slicer_and_student_math.mjs
 * Validation mathématique et DSP Haute Précision :
 * 1. Slicer Livret 3 : findOptimalAcousticCutSec (coupe dans le silence post-+1T + passage à zéro),
 *    findOptimalMasterGridOffsetSec et detectVocalPhrases (hystérésis adaptative P15/P85).
 * 2. Studio Élève Livret 5 : Prise élève décalée de +110 ms (latence Bluetooth) avec 45 ms de scoop
 *    d'attaque sur chaque syllabe -> > 92 % en Justesse (pitchAccuracyPct) et > 90 % en Attaque (attackPrecisionPct).
 * 3. Validation d'Ambitus & Détection H1/H2 anti-saut d'octave.
 */
import assert from 'node:assert/strict';
import {
  findOptimalAcousticCutSec,
  findOptimalMasterGridOffsetSec,
  snapToNearestZeroCrossing,
} from '../src/utils/slicerBoundaryOptimizer.ts';
import { detectVocalPhrases } from '../src/audio/silenceDetector.ts';
import { analyzeStudentTake } from '../src/audio/studentPitchAnalyzer.ts';
import { CausalStudentPitchTracker } from '../src/audio/studentPerformanceMatcher.ts';
import { detectRealtimePitch } from '../src/audio/realtimePitchDetector.ts';
import { validateAmbitusNote } from '../src/audio/ambitusValidator.ts';
import { midiToFrequency, midiToNoteName } from '../src/utils/noteUtils.ts';

console.log('=== TEST 1 : Slicer Boundary Optimizer (Tenue +1T + Silence + Zero-Crossing) ===');
{
  const sr = 44100;
  const durSec = 6.0;
  const pcm = new Float32Array(sr * durSec);
  // Pattern A tient sa note sur +1T de 2.00s à 2.42s, puis silence [2.44s .. 2.72s],
  // puis l'anacrouse du Pattern B démarre à 2.74s
  const fA = 261.63; // C4
  const fB = 329.63; // E4
  for (let i = 0; i < pcm.length; i++) {
    const t = i / sr;
    if (t >= 0.50 && t <= 2.42) {
      const env = t > 2.35 ? Math.max(0, (2.42 - t) / 0.07) : 1.0;
      pcm[i] = 0.45 * env * Math.sin(2 * Math.PI * fA * t);
    } else if (t >= 2.74 && t <= 4.50) {
      const env = t < 2.79 ? (t - 2.74) / 0.05 : 1.0;
      pcm[i] = 0.50 * env * Math.sin(2 * Math.PI * fB * t);
    } else {
      // Léger bruit de fond résiduel avec passages à zéro
      pcm[i] = 0.0004 * Math.sin(2 * Math.PI * 180 * t);
    }
  }

  const minCutSec = 2.15;
  const maxCutSec = 2.85;
  const idealCutSec = 2.50;
  const cutSec = findOptimalAcousticCutSec(pcm, sr, idealCutSec, minCutSec, maxCutSec);
  console.log(`  -> Point de coupe optimal • trouvé à t = ${cutSec.toFixed(4)}s (silence attendu [2.43s .. 2.73s])`);
  assert.ok(
    cutSec >= 2.42 && cutSec <= 2.74,
    `Le point de coupe (${cutSec.toFixed(3)}s) doit tomber dans le silence entre la tenue +1T (<=2.42s) et l'attaque suivante (>=2.74s)`
  );

  const idx = Math.floor(cutSec * sr);
  const isZeroCross = Math.abs(pcm[idx]) < 1e-3 || (idx + 1 < pcm.length && pcm[idx] * pcm[idx + 1] <= 0);
  console.log(`  -> Échantillon au point de coupe : pcm[${idx}] = ${pcm[idx].toFixed(6)}, zeroCross=${isZeroCross}`);
  assert.ok(isZeroCross, 'Le point de coupe doit être calé sur un passage à zéro (Zero-Crossing)');

  // Vérification de detectVocalPhrases (Hystérésis P15/P85 + Zero-Crossing)
  const phrases = detectVocalPhrases(pcm, sr, { minPhraseDurationSec: 0.5, minSilenceDurationSec: 0.25, marginSec: 0.05 });
  console.log(`  -> Phrases détectées par hystérésis P15/P85 : ${phrases.length}`);
  assert.equal(phrases.length, 2, 'Doit détecter exactement les 2 phrases vocales');
}

console.log('=== TEST 2 : Prise Élève décalée de +110 ms (Bluetooth) + 45 ms de Scoop d’Attaque ===');
{
  const sr = 44100;
  const bpm = 90; // 1 beat = 0.6667s, 1 step = 0.1667s
  const stepDurSec = (60 / bpm) / 4;
  // Construisons 4 notes cibles franches de 4 steps (1 temps = 0.667s) chacune, séparées par 1 step de respiration :
  // Note 1: C4 (60) steps 0..3
  // Note 2: D4 (62) steps 5..8
  // Note 3: E4 (64) steps 10..13
  // Note 4: G4 (67) steps 15..18
  const totalSteps = 20;
  const targetSteps = Array.from({ length: totalSteps }, (_, idx) => ({
    stepIndex: idx,
    active: false,
    note: 'C4',
    midiNumber: 0,
    lyric: '',
  }));

  const specs = [
    { start: 0, len: 4, midi: 60 },
    { start: 5, len: 4, midi: 62 },
    { start: 10, len: 4, midi: 64 },
    { start: 15, len: 4, midi: 67 },
  ];

  for (const sp of specs) {
    targetSteps[sp.start] = {
      stepIndex: sp.start,
      active: true,
      note: midiToNoteName(sp.midi),
      midiNumber: sp.midi,
      lyric: 'la',
    };
    for (let k = 1; k < sp.len; k++) {
      targetSteps[sp.start + k] = {
        stepIndex: sp.start + k,
        active: true,
        note: '───',
        midiNumber: sp.midi,
        lyric: '',
      };
    }
  }

  const totalDurationSec = totalSteps * stepDurSec + 0.4;
  const pcm = new Float32Array(Math.floor(totalDurationSec * sr));
  const bluetoothLagSec = 0.110; // +110 ms de latence système simulée
  const scoopDurSec = 0.045; // 45 ms de scoop ascendant (-1.5 demi-ton -> cible) sur chaque syllabe

  let phase = 0;
  for (const sp of specs) {
    const tNoteStart = sp.start * stepDurSec + bluetoothLagSec;
    const tNoteEnd = (sp.start + sp.len) * stepDurSec + bluetoothLagSec;
    const iStart = Math.max(0, Math.floor(tNoteStart * sr));
    const iEnd = Math.min(pcm.length, Math.floor(tNoteEnd * sr));

    for (let i = iStart; i < iEnd; i++) {
      const tInNote = (i - iStart) / sr;
      // Scoop de -1.5 demi-ton sur les 45 premières ms, puis cœur de voyelle stable sur sp.midi
      const scoopOffsetSt = tInNote < scoopDurSec
        ? -1.5 * (1 - tInNote / scoopDurSec)
        : 0;
      const instMidi = sp.midi + scoopOffsetSt;
      const instFreq = midiToFrequency(instMidi);
      phase += (2 * Math.PI * instFreq) / sr;
      // Timbre vocal réaliste (fondamentale + harmoniques)
      pcm[i] = 0.45 * Math.sin(phase) + 0.18 * Math.sin(2 * phase) + 0.08 * Math.sin(3 * phase);
    }
  }

  const analysis = analyzeStudentTake({
    rawPCM: pcm,
    sampleRate: sr,
    totalDurationSec,
    targetSteps,
    bpm,
    shouldAnalyzeNotes: true,
  });

  console.log(
    `  -> Scores Élève (+110ms lag + 45ms scoop) : Justesse=${analysis.pitchAccuracyPct}%, Attaque=${analysis.attackPrecisionPct}%, Stabilité=${analysis.stabilityPct}%, Délai résiduel=${analysis.avgAttackDelayMs}ms`
  );
  assert.ok(
    analysis.pitchAccuracyPct > 92,
    `La Justesse (${analysis.pitchAccuracyPct}%) doit être > 92% grâce à l'évaluation sur le Cœur de Voyelle`
  );
  assert.ok(
    analysis.attackPrecisionPct > 90,
    `La Précision d'Attaque (${analysis.attackPrecisionPct}%) doit être > 90% grâce à la soustraction automatique de latence (+110ms)`
  );
}

console.log('=== TEST 3 : CausalStudentPitchTracker (Gate Consonantique) & Ambitus Anti-Octave ===');
{
  const tracker = new CausalStudentPitchTracker();
  // Trame voisée stable sur C4 (60)
  const pt1 = tracker.update(0.10, 60.0, 0.12, 0.92, 0.05, 60);
  assert.ok(pt1 && Math.abs(pt1.midiFloat - 60) < 0.1);
  // Trame consonantique sibilante (ZCR = 0.35 > 0.22) 20 ms plus tard avec pitch aberrant (71) -> maintient ~60 sans fausse note
  const pt2 = tracker.update(0.12, 71.0, 0.04, 0.45, 0.35, 60);
  assert.ok(pt2 && Math.abs(pt2.midiFloat - 60) < 0.15, 'Le gate consonantique doit maintenir la dernière hauteur stable sans émettre de fausse note');

  // Test Ambitus avec un saut d'octave parasite isolé (+12 demi-tons) au milieu d'une tenue de 1.7s
  const samples = [];
  for (let i = 0; i <= 34; i++) {
    const t = i * 0.05;
    const isGlitch = i === 15 || i === 22;
    samples.push({
      timeSec: t,
      pitchMidi: isGlitch ? 72.0 : 60.05,
      rms: 0.08,
      clarity: isGlitch ? 0.68 : 0.94,
    });
  }
  const ambRes = validateAmbitusNote(60, samples, 1.6);
  console.log(`  -> Validation Ambitus avec 2 glitches d'octave isolés : isSolid=${ambRes.isSolid}, status=${ambRes.status}`);
  assert.equal(ambRes.isSolid, true, 'Le filtre médian glissant 120ms anti-octave doit valider la tenue solide');
}

console.log('✅ TOUS LES TESTS MATHÉMATIQUES SLICER (LIVRET 3) & STUDIO ÉLÈVE (LIVRET 5) SONT PASSÉS AVEC SUCCÈS !');
