/**
 * test_etape5_i18n_and_governance.mjs
 * Suite de tests de validation de l'Étape 5 :
 * 1. Règle 0 stricte de nommage O Girador (0 occurrence de 'Or / 'or sur les noms d'applications dans src/).
 * 2. Parité 100 % entre tous les dictionnaires *Fr.ts et *Br.ts dans src/i18n/.
 * 3. Non-écrasement de la latence matérielle globale (persistToStorage=false dans Livret 3 vs persistance unifiée sig + globale).
 * 4. Gouvernance anti-monolithe : 100 % des fichiers de src/ strictement < 145 lignes.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');
const I18N_DIR = path.resolve(SRC_DIR, 'i18n');

function walkFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(fullPath, acc);
    else if (/\.(ts|tsx|css)$/.test(entry.name)) acc.push(fullPath);
  }
  return acc;
}

const allSrcFiles = walkFiles(SRC_DIR);
console.log(`🔍 Inspection de ${allSrcFiles.length} fichiers dans src/...`);

// ============================================================================
// TEST 1 : RÈGLE 0 STRICTE DE NOMMAGE DES APPLICATIONS O GIRADOR
// ============================================================================
const FORBIDDEN_APP_NAMES_REGEX = /\b(Organizad'Or|Organizad'or|S[eé]quenciad'Or|S[eé]quenciad'or|Cantad'Or|Cantad'or|Orquestrad'Or|Orquestrad'or|Orchestrad'Or|Orchestrad'or|Mostrad'Or|Mostrad'or|Dan[cç]ad'Or|Dan[cç]ad'or|O'Girad'Or|O\s+Girad'Or)\b/i;

const rule0Violations = [];
for (const file of allSrcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const match = content.match(FORBIDDEN_APP_NAMES_REGEX);
  if (match) {
    rule0Violations.push({ file: path.relative(SRC_DIR, file), match: match[0] });
  }
}
assert.equal(
  rule0Violations.length,
  0,
  `Violations Règle 0 détectées : ${JSON.stringify(rule0Violations)}`
);
console.log('✅ Test 1 OK : 0 violation de la Règle 0 de nommage O Girador dans tout src/.');

// ============================================================================
// TEST 2 : PARITÉ 100 % DES CLÉS ENTRE TOUS LES FICHIERS *Fr.ts ET *Br.ts
// ============================================================================
const i18nFiles = fs.readdirSync(I18N_DIR);
const frFiles = i18nFiles.filter((f) => f.endsWith('Fr.ts'));
assert.ok(frFiles.length >= 9, `Attendu au moins 9 fichiers *Fr.ts, trouvé ${frFiles.length}`);

function extractObjectKeys(tsContent) {
  // 1. Strip block and line comments
  const noComments = tsContent
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  // 2. Replace all string values ('...' or "...") after a colon with empty placeholder
  const noValues = noComments.replace(/:\s*(?:'(?:\\'|[^'])*'|"(?:\\"|[^"])*")/g, ': ""');
  // 3. Extract all object property keys before `:`
  const keys = [];
  const regex = /(?:^|[,{]\s*)(?:['"]?([a-zA-Z0-9_]+)['"]?)\s*:/gm;
  let m;
  while ((m = regex.exec(noValues)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

for (const frFile of frFiles) {
  const brFile = frFile.replace(/Fr\.ts$/, 'Br.ts');
  const frPath = path.join(I18N_DIR, frFile);
  const brPath = path.join(I18N_DIR, brFile);
  assert.ok(fs.existsSync(brPath), `Fichier miroir PT-BR manquant pour ${frFile}`);

  const frKeys = extractObjectKeys(fs.readFileSync(frPath, 'utf8'));
  const brKeys = extractObjectKeys(fs.readFileSync(brPath, 'utf8'));
  assert.ok(frKeys.length > 0, `Aucune clé extraite de ${frFile}`);

  const frSet = new Set(frKeys);
  const brSet = new Set(brKeys);

  const missingInBr = frKeys.filter((k) => !brSet.has(k));
  const missingInFr = brKeys.filter((k) => !frSet.has(k));

  assert.deepEqual(
    missingInBr,
    [],
    `Clés présentes dans ${frFile} mais absentes de ${brFile} : ${missingInBr.join(', ')}`
  );
  assert.deepEqual(
    missingInFr,
    [],
    `Clés présentes dans ${brFile} mais absentes de ${frFile} : ${missingInFr.join(', ')}`
  );
}
console.log(`✅ Test 2 OK : Parité 100 % vérifiée sur les ${frFiles.length} paires de dictionnaires FR / PT-BR.`);

// ============================================================================
// TEST 3 : UNICITÉ & NON-ÉCRASEMENT DE LA CALIBRATION MATÉRIELLE DE LATENCE
// ============================================================================
const latencyStorageCode = fs.readFileSync(path.join(SRC_DIR, 'utils/latencyStorage.ts'), 'utf8');
const nudgeBarCode = fs.readFileSync(path.join(SRC_DIR, 'components/livret-prise/LatencyNudgeBar.tsx'), 'utf8');
const waveformEditorCode = fs.readFileSync(path.join(SRC_DIR, 'components/livret-prise/WaveformTrimEditor.tsx'), 'utf8');
const reglagesCode = fs.readFileSync(path.join(SRC_DIR, 'components/livret-reglages/LivretReglages.tsx'), 'utf8');
const calibrationBannerCode = fs.readFileSync(path.join(SRC_DIR, 'components/livret-prise/CalibrationBanner.tsx'), 'utf8');

// 3a. WaveformTrimEditor ne doit jamais écraser la latence matérielle globale (soit persistToStorage={false}, soit pilotage direct de t1OffsetSec sans LatencyNudgeBar)
assert.ok(
  waveformEditorCode.includes('persistToStorage={false}') || !waveformEditorCode.includes('LatencyNudgeBar'),
  'WaveformTrimEditor.tsx ne doit jamais écraser la latence matérielle globale'
);

// 3b. LatencyNudgeBar ne doit appeler saveLatencyOffsetMs que si persistToStorage est vrai
assert.ok(
  nudgeBarCode.includes('persistToStorage = true') &&
  nudgeBarCode.includes('if (persistToStorage)') &&
  nudgeBarCode.includes('saveLatencyOffsetMs(clamped, sig)'),
  'LatencyNudgeBar.tsx doit conditionner saveLatencyOffsetMs(clamped, sig) à persistToStorage'
);

// 3c. CalibrationBanner et LivretReglages synchronisent signature matérielle et clé globale via saveLatencyOffsetMs
assert.ok(
  calibrationBannerCode.includes('saveLatencyOffsetMs(result, sig)'),
  'CalibrationBanner.tsx doit sauvegarder via saveLatencyOffsetMs(result, sig)'
);
assert.ok(
  reglagesCode.includes('saveLatencyOffsetMs(ms, sig)'),
  'LivretReglages.tsx doit synchroniser saveLatencyOffsetMs(ms, sig)'
);
assert.ok(
  latencyStorageCode.includes('saveCalibratedLatency(sig, clamped)') &&
  latencyStorageCode.includes('localStorage.setItem(STORAGE_KEY, clamped.toString())'),
  'saveLatencyOffsetMs dans latencyStorage.ts doit synchroniser la signature matérielle et la clé globale'
);
console.log('✅ Test 3 OK : Non-écrasement de la latence matérielle globale en Livret 3 et synchronisation unifiée sig + globale.');

// ============================================================================
// TEST 4 : GOUVERNANCE ANTI-MONOLITHE (100 % DES FICHIERS < 145 LIGNES)
// ============================================================================
const MAX_LINES = 144;
const oversizedFiles = [];
let maxObservedLines = 0;
let maxObservedFile = '';

for (const file of allSrcFiles) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).length;
  if (lines > maxObservedLines) {
    maxObservedLines = lines;
    maxObservedFile = path.relative(SRC_DIR, file);
  }
  if (lines >= 145) {
    oversizedFiles.push({ file: path.relative(SRC_DIR, file), lines });
  }
}

assert.equal(
  oversizedFiles.length,
  0,
  `Fichiers dépassant la limite stricte (< 145 lignes) : ${JSON.stringify(oversizedFiles)}`
);
console.log(`✅ Test 4 OK : 100 % des ${allSrcFiles.length} fichiers de src/ font strictement < 145 lignes (max observé : ${maxObservedLines} lignes dans ${maxObservedFile}).`);
console.log('\n🎉 TOUS LES TESTS DE L\'ÉTAPE 5 (I18N, RÈGLE 0, LATENCE, GOUVERNANCE < 145 LIGNES) SONT PASSÉS AVEC SUCCÈS !');
