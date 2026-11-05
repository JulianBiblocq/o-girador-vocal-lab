/**
 * test_v1_4_0_livret5_roda_and_steps.mjs
 * Suite de validation unitaire et architecturale — Cantador v1.4.0 :
 * 1. Volet 1 : analyzeVocalProjectionFrame & computeSessionProjectionSummary (roda_optimal, timide, forcage, anti-sibilance 6-8 kHz)
 * 2. Volet 2 : evaluateSpeedTierProgression & computeWeightedStudentScore (machine à états 75% ➔ 88% ➔ 100% + persistance étoiles)
 * 3. Volet 3 : analyzeAVozNaRoda (Défi 4 « 🔔 A Voz na Roda » : justesse ±35 cents & résonance >= 45%)
 * 4. Volet 4 : Gouvernance (< 145 lignes sur 100% de src/, 0 violation Règle 0, parité i18n FR/PT-BR, version 1.4.0).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  analyzeVocalProjectionFrame,
  computeSessionProjectionSummary,
} from '../src/audio/rodaResonanceAnalyzer.ts';
import {
  computeWeightedStudentScore,
  evaluateSpeedTierProgression,
  createEmptyPatternMastery,
} from '../src/utils/progressiveSpeedMastery.ts';
import { analyzeAVozNaRoda } from '../src/audio/vocalGameAnalyzers.ts';
import { harmonyTranslationsFr } from '../src/i18n/harmonyTranslationsFr.ts';
import { harmonyTranslationsBr } from '../src/i18n/harmonyTranslationsBr.ts';
import { treinoSubTranslationsFr } from '../src/i18n/treinoSubTranslationsFr.ts';
import { treinoSubTranslationsBr } from '../src/i18n/treinoSubTranslationsBr.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

console.log('=== TEST SUITE v1.4.0 : LIVRET 5 (PROJECTION RODA & PALIERS 75-88-100%) ===\n');

// Helper to synthesize an FFT bin array (in dB) for given sampleRate & fftSize
function buildSyntheticSpectrum(sampleRate, fftSize, { bodyDb = -25, ringDb = -30, airDb = -65, floorDb = -80 }) {
  const binCount = fftSize / 2;
  const bins = new Float32Array(binCount).fill(floorDb);
  const binHz = sampleRate / fftSize;
  for (let i = 1; i < binCount; i++) {
    const hz = i * binHz;
    if (hz >= 150 && hz <= 900) bins[i] = bodyDb;
    else if (hz >= 2400 && hz <= 3600) bins[i] = ringDb;
    else if (hz >= 5500 && hz <= 8500) bins[i] = airDb;
  }
  return bins;
}

// ---------------------------------------------------------------------------
// 1. TEST VOLET 1 : analyzeVocalProjectionFrame & computeSessionProjectionSummary
// ---------------------------------------------------------------------------
console.log('1. Test analyzeVocalProjectionFrame (roda_optimal, timide, forcage, anti-sibilance)...');
{
  const sr = 44100;
  const fftSize = 2048;

  // Cas A : Spectre riche à 3 kHz (body=-20 dB, ring=-24 dB -> diff=-4 dB -> 75%) + faible jitter (12 cts) + bon RMS (0.08) -> 'roda_optimal'
  const optimalBins = buildSyntheticSpectrum(sr, fftSize, { bodyDb: -20, ringDb: -24, airDb: -60 });
  const resOptimal = analyzeVocalProjectionFrame(optimalBins, sr, fftSize, 0.08, 12);
  assert.equal(resOptimal.isVoiced, true);
  assert.equal(resOptimal.isFricativeNoise, false);
  assert.ok(resOptimal.projectionScorePct >= 65, `Expected projectionScorePct >= 65, got ${resOptimal.projectionScorePct}`);
  assert.equal(resOptimal.status, 'roda_optimal');

  // Cas B : Spectre sourd (body=-22 dB, ring=-46 dB -> diff=-24 dB -> 0%) + faible RMS (0.025) -> 'timide'
  const muffledBins = buildSyntheticSpectrum(sr, fftSize, { bodyDb: -22, ringDb: -46, airDb: -70 });
  const resTimide = analyzeVocalProjectionFrame(muffledBins, sr, fftSize, 0.025, 15);
  assert.equal(resTimide.status, 'timide');
  assert.ok(resTimide.projectionScorePct < 40);

  // Cas C : Fort RMS grave (rms = 0.28) + jitter élevé (58 cts) sans harmoniques 3 kHz (ring=-42 dB) -> 'forcage'
  const forcedBins = buildSyntheticSpectrum(sr, fftSize, { bodyDb: -14, ringDb: -40, airDb: -65 });
  const resForcage = analyzeVocalProjectionFrame(forcedBins, sr, fftSize, 0.28, 58);
  assert.equal(resForcage.status, 'forcage');

  // Cas D : Bruit fricatif haute fréquence ('s', 'ch' à 6-8 kHz : airDb = -22 dB, ringDb = -25 dB) -> non confondu avec résonance vocale
  const sibilantBins = buildSyntheticSpectrum(sr, fftSize, { bodyDb: -40, ringDb: -25, airDb: -22 });
  const resSibilant = analyzeVocalProjectionFrame(sibilantBins, sr, fftSize, 0.07, 10);
  assert.equal(resSibilant.isFricativeNoise, true, 'Fricative s/ch must be flagged as isFricativeNoise');
  assert.equal(resSibilant.projectionScorePct, 0, 'Fricative s/ch must not produce false projection score');
  assert.notEqual(resSibilant.status, 'roda_optimal');

  // Accumulateur de session (doit ignorer la trame fricative et agréger les trames voisées)
  const summary = computeSessionProjectionSummary([resOptimal, resOptimal, resSibilant]);
  assert.equal(summary.voicedFramesCount, 2);
  assert.equal(summary.dominantStatus, 'roda_optimal');
  assert.ok(summary.avgProjectionScorePct >= 65);
  console.log('   ✅ analyzeVocalProjectionFrame & computeSessionProjectionSummary validés.');
}

// ---------------------------------------------------------------------------
// 2. TEST VOLET 2 : Machine à états des paliers 75% ➔ 88% ➔ 100%
// ---------------------------------------------------------------------------
console.log('2. Test evaluateSpeedTierProgression (75% ➔ 88% ➔ 100% & persistance étoiles)...');
{
  // Score pondéré : 0.45 * 80 + 0.30 * 80 + 0.25 * 80 = 80
  assert.equal(computeWeightedStudentScore(80, 80, 80), 80);

  let mastery = createEmptyPatternMastery();

  // Essai 1 à 75 % avec score 68 % (< 75 %) -> maintien sur 75 %
  const fail75 = evaluateSpeedTierProgression({
    currentSpeedRatio: 0.75,
    weightedScorePct: 68,
    autoProgressionEnabled: true,
    previousMastery: mastery,
  });
  assert.equal(fail75.unlockedTier, null);
  assert.equal(fail75.advancedToNextTier, false);
  assert.equal(fail75.nextSpeedRatio, 0.75);
  assert.equal(fail75.updatedMastery.tier75, false);

  // Essai 2 à 75 % avec score 77 % (>= 75 %) -> valide ⭐ 75 % et monte automatiquement à 88 % (0.88)
  const pass75 = evaluateSpeedTierProgression({
    currentSpeedRatio: 0.75,
    weightedScorePct: 77,
    autoProgressionEnabled: true,
    previousMastery: fail75.updatedMastery,
  });
  assert.equal(pass75.unlockedTier, 75);
  assert.equal(pass75.advancedToNextTier, true);
  assert.equal(pass75.nextSpeedRatio, 0.88);
  assert.equal(pass75.updatedMastery.tier75, true);
  assert.equal(pass75.updatedMastery.tier88, false);
  mastery = pass75.updatedMastery;

  // Essai 3 à 88 % avec score 76 % (< 78 %) -> maintien sur 88 %, mais conserve tier75 = true !
  const fail88 = evaluateSpeedTierProgression({
    currentSpeedRatio: 0.88,
    weightedScorePct: 76,
    autoProgressionEnabled: true,
    previousMastery: mastery,
  });
  assert.equal(fail88.unlockedTier, null);
  assert.equal(fail88.advancedToNextTier, false);
  assert.equal(fail88.nextSpeedRatio, 0.88);
  assert.equal(fail88.updatedMastery.tier75, true, 'tier75 star must be preserved');
  assert.equal(fail88.updatedMastery.tier88, false);

  // Essai 4 à 88 % avec score 81 % (>= 78 %) -> valide ⭐ 88 % et monte automatiquement à 100 % (1.0)
  const pass88 = evaluateSpeedTierProgression({
    currentSpeedRatio: 0.88,
    weightedScorePct: 81,
    autoProgressionEnabled: true,
    previousMastery: fail88.updatedMastery,
  });
  assert.equal(pass88.unlockedTier, 88);
  assert.equal(pass88.advancedToNextTier, true);
  assert.equal(pass88.nextSpeedRatio, 1.0);
  assert.equal(pass88.updatedMastery.tier75, true);
  assert.equal(pass88.updatedMastery.tier88, true);
  assert.equal(pass88.updatedMastery.tier100, false);

  // Essai 5 à 100 % avec score 84 % (>= 80 %) -> couronne 👑 Maîtrisé (100 %)
  const pass100 = evaluateSpeedTierProgression({
    currentSpeedRatio: 1.0,
    weightedScorePct: 84,
    autoProgressionEnabled: true,
    previousMastery: pass88.updatedMastery,
  });
  assert.equal(pass100.unlockedTier, 100);
  assert.equal(pass100.updatedMastery.tier75, true);
  assert.equal(pass100.updatedMastery.tier88, true);
  assert.equal(pass100.updatedMastery.tier100, true);
  assert.equal(pass100.updatedMastery.bestScorePct, 84);
  console.log('   ✅ Machine à états 75% ➔ 88% ➔ 100% validée.');
}

// ---------------------------------------------------------------------------
// 3. TEST VOLET 3 : Défi 4 « 🔔 A Voz na Roda » (analyzeAVozNaRoda)
// ---------------------------------------------------------------------------
console.log('3. Test analyzeAVozNaRoda (Défi 4 « 🔔 A Voz na Roda »)...');
{
  const goodSamples = Array.from({ length: 10 }, (_, i) => ({
    timeSec: i * 0.1,
    pitchMidi: 60.1, // +10 cents (<= 35 cents)
    rms: 0.09,
    brillianceRatio: 1.2,
    projectionScorePct: 68, // >= 45%
    projectionStatus: 'roda_optimal',
  }));
  const evalOk = analyzeAVozNaRoda(60, goodSamples);
  assert.equal(evalOk.isSuccess, true);
  assert.equal(evalOk.feedbackKey, 'game4Success');
  assert.equal(evalOk.projectionStatus, 'roda_optimal');

  const forcedSamples = Array.from({ length: 10 }, (_, i) => ({
    timeSec: i * 0.1,
    pitchMidi: 60.0,
    rms: 0.27,
    brillianceRatio: 0.2,
    projectionScorePct: 22,
    projectionStatus: 'forcage',
  }));
  const evalForced = analyzeAVozNaRoda(60, forcedSamples);
  assert.equal(evalForced.isSuccess, false);
  assert.equal(evalForced.feedbackKey, 'game4ForcageWarn');
  console.log('   ✅ analyzeAVozNaRoda validé.');
}

// ---------------------------------------------------------------------------
// 4. TEST VOLET 4 : Gouvernance (< 145 lignes, Règle 0, Parité i18n, v1.4.0)
// ---------------------------------------------------------------------------
console.log('4. Vérification Gouvernance (< 145 lignes, Règle 0, i18n FR/PT-BR, version 1.4.0)...');
{
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '1.4.0', `package.json version must be 1.4.0, got ${pkg.version}`);

  assert.deepEqual(
    Object.keys(harmonyTranslationsFr).sort(),
    Object.keys(harmonyTranslationsBr).sort(),
    'harmonyTranslationsFr and harmonyTranslationsBr keys must match 100%'
  );
  assert.deepEqual(
    Object.keys(treinoSubTranslationsFr).sort(),
    Object.keys(treinoSubTranslationsBr).sort(),
    'treinoSubTranslationsFr and treinoSubTranslationsBr keys must match 100%'
  );

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
  console.log(`   ✅ ${srcFiles.length} fichiers src/ vérifiés (< 145 lignes, 0 violation Règle 0, i18n 100%, v1.4.0).`);
}

console.log('\n🎉 TOUS LES TESTS v1.4.0 (LIVRET 5 : PROJECTION RODA & PALIERS 75-88-100%) SONT PASSÉS AVEC SUCCÈS !');
