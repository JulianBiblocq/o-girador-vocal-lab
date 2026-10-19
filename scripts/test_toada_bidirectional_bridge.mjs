import assert from 'assert';
import fs from 'fs';
import path from 'path';

import { extractInlineLineDirectives } from '../src/utils/sheetDirectiveHelper.ts';
import { parseRichTextLyricsAndPhonetics } from '../src/utils/toadaSheetParser.ts';
import { generateToadaFromSheet } from '../src/utils/toadaConductorGenerator.ts';
import { stitchSyllablesFromSteps, reconstituteToadaTxt } from '../src/utils/toadaTxtReconstitutor.ts';

console.log('========================================================================');
console.log('🧪 TEST AUTOMATISÉ : PASSERELLE BIDIRECTIONNELLE CANTADOR <-> ORGANIZADOR');
console.log('========================================================================\n');

// 1. Test Directives & Préfixes (+ et /)
console.log('▶️ Test 1 : Détection des préfixes Anacrouse (+), Mesure liée (/) et Sections');
const dirAna = extractInlineLineDirectives('+ *Atotô* [Dm7]');
assert.strictEqual(dirAna.hasAnacrusis, true, 'Doit détecter l\'anacrouse (+)');
assert.strictEqual(dirAna.cleanText, '*Atotô*', 'Doit retirer l\'accord et le +');

const dirLinked = extractInlineLineDirectives('/ Azawani');
assert.strictEqual(dirLinked.isLinkedMeasure, true, 'Doit détecter la mesure liée (/)');
assert.strictEqual(dirLinked.cleanText, 'Azawani', 'Doit nettoyer le préfixe');

const dirSec = extractInlineLineDirectives('[Refrain Principal]');
assert.strictEqual(dirSec.sectionName, 'Refrain Principal', 'Doit détecter le nom de section');
console.log('  ✅ Test 1 validé : Détection fidèle des symboles techniques.\n');

// 2. Test Soudure Syllabique MIDI
console.log('▶️ Test 2 : Soudure syllabique des pas MIDI (tirets -, exclusion ───)');
const mockSteps = [
  { stepIndex: 0, active: true, note: 'C4', midiNumber: 60, syllable: 'O-', velocity: 100, decay: 200 },
  { stepIndex: 1, active: true, note: 'D4', midiNumber: 62, syllable: 'pa-', velocity: 100, decay: 200 },
  { stepIndex: 2, active: true, note: 'E4', midiNumber: 64, syllable: 'ni-', velocity: 100, decay: 200 },
  { stepIndex: 3, active: true, note: 'F4', midiNumber: 65, syllable: '───', velocity: 100, decay: 200 }, // tenue
  { stepIndex: 4, active: true, note: 'G4', midiNumber: 67, syllable: 'jé', velocity: 100, decay: 200 },
  { stepIndex: 8, active: true, note: 'C5', midiNumber: 72, syllable: 'A-', velocity: 100, decay: 200 },
  { stepIndex: 9, active: true, note: 'B4', midiNumber: 71, syllable: 'to-', velocity: 100, decay: 200 },
  { stepIndex: 10, active: true, note: 'A4', midiNumber: 69, syllable: 'tô', velocity: 100, decay: 200 }
];

const stitched = stitchSyllablesFromSteps(mockSteps);
assert.strictEqual(stitched, 'Opanijé Atotô', `Doit souder 'Opanijé Atotô' sans tiret ni tenue (obtenu: ${stitched})`);
console.log('  ✅ Test 2 validé : Soudure syllabique impeccable (' + stitched + ').\n');

// 3. Test Mesures Mixtes (Appel + Réponse sur la même ligne)
console.log('▶️ Test 3 : Mesures mixtes tuilées (Puxador + Coro)');
const mixedText = '+ *Atotô* Azawani';
const segs = parseRichTextLyricsAndPhonetics(mixedText, undefined, 'puxador');
assert.strictEqual(segs.length, 2, 'Doit générer 2 segments');
assert.strictEqual(segs[0].role, 'puxador', 'Segment 1 doit être Puxador (*gras*)');
assert.strictEqual(segs[0].hasAnacrusis, true, 'Segment 1 hérite de l\'anacrouse (+)');
assert.strictEqual(segs[1].role, 'coro', 'Segment 2 doit être Coro');
assert.strictEqual(segs[0].isMixedPair, true, 'Doit être marqué comme paire mixte');

const baseProject = {
  id: 'test_toada_1',
  title: 'Toada Atotô',
  bpm: 55,
  timeSignature: '4/4',
  patterns: [],
  slots: [],
  activePatternId: ''
};

const genProject = generateToadaFromSheet(baseProject, { segments: segs });
assert.strictEqual(genProject.slots.length, 1, 'Doit créer 1 seul slot tuilé pour la mesure mixte');
assert(genProject.slots[0].puxadorPatternId, 'Slot doit contenir Puxador');
assert(genProject.slots[0].coroPatternId, 'Slot doit contenir Coro');
console.log('  ✅ Test 3 validé : Superposition fidèle sur le même créneau de la Frise.\n');

// 4. Test Agrégation des Mesures Liées (/)
console.log('▶️ Test 4 : Agrégation automatique des mesures liées consécutives (/)');
const linkedText = `+ *Première mesure*

/ Seconde mesure liée

/ Troisième mesure liée`;

const linkedSegs = parseRichTextLyricsAndPhonetics(linkedText, undefined, 'puxador');
const genLinkedProject = generateToadaFromSheet(baseProject, { segments: linkedSegs });
assert.strictEqual(genLinkedProject.patterns.length, 1, 'Doit fusionner en 1 seul pattern agrégé');
assert.strictEqual(genLinkedProject.patterns[0].measuresCount, 3, 'Pattern doit couvrir 3 mesures');
console.log('  ✅ Test 4 validé : Agrégation de measuresCount = 3 réussie.\n');

// 5. Test Reconstitution .txt propre et HTML (Sens B)
console.log('▶️ Test 5 : Reconstitution Toada .txt et HTML propre (Sens B)');
const recon = reconstituteToadaTxt(genProject);
assert(recon.rawTxtCode.includes('+ *Atotô* Azawani'), 'Doit reconstituer le code brut avec + et soliste');
assert(recon.cleanHtml.includes('<strong>Atotô</strong> Azawani'), 'Doit générer du HTML propre avec <strong>');
assert(!recon.cleanHtml.includes('+'), 'Le HTML propre ne doit JAMAIS contenir de +');
console.log('  ✅ Test 5 validé : Reconstitution Isomorphe et HTML 100% compatible.\n');

// 6. Test Règle Anti-Monolithe (< 150 lignes)
console.log('▶️ Test 6 : Règle Anti-Monolithe (< 150 lignes)');
const files = [
  'src/types/toadaDocument.types.ts',
  'src/utils/sheetDirectiveHelper.ts',
  'src/utils/toadaSheetParser.ts',
  'src/utils/toadaConductorGenerator.ts',
  'src/utils/toadaTxtReconstitutor.ts',
  'src/services/organizadorToadaPublisher.ts',
  'src/components/header/SaveAndExportDropdown.tsx'
];

for (const f of files) {
  const absPath = path.resolve(process.cwd(), f);
  const lines = fs.readFileSync(absPath, 'utf8').split('\n').length;
  console.log(`   - ${f} : ${lines} lignes`);
  assert(lines < 150, `${f} dépasse 150 lignes (${lines})`);
}
console.log('  ✅ Test 6 validé : 100% des fichiers sont strictement sous 150 lignes.\n');

console.log('========================================================================');
console.log('🏆 TOUS LES TESTS DE LA PASSERELLE CANTADOR SONT 100% VALIDÉS !');
console.log('========================================================================');
