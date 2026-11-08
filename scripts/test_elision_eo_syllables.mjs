/**
 * test_elision_eo_syllables.mjs
 * Test unitaire de non-régression pour les élisions portugaises avec apostrophe ("e'o", "d'água")
 * et la synalèphe automatique ("e o" -> "e'o") sur le Temps 3 de « Vovó falou ».
 */
import assert from 'node:assert/strict';
import { splitPortugueseLyricsIntoSyllables, splitTextIntoLetraSyllables } from '../src/utils/syllableSplitter.ts';
import { extractTimeAnchors } from '../src/utils/timeAnchorParser.ts';
import { applyLyricsSyllablesToSteps } from '../src/utils/syllableAligner.ts';
import { mergeSyllablesToImpulseCount } from '../src/utils/syllableImpulseMerger.ts';
import { formatWordsWithUnderlinedSyllables } from '../src/utils/syllableUnderlineFormatter.ts';
import { buildOrganizadorLineFromSteps } from '../src/utils/stepsToOrganizadorLineBuilder.ts';

// 1. Découpage avec apostrophe : "Vovó falou e'o barão assinou" -> 10 syllabes, jamais "oba"
const sylsEo = splitPortugueseLyricsIntoSyllables("Vovó falou e'o barão assinou");
assert.deepEqual(sylsEo, ['Vo', 'vó', 'fa', 'lou', "e'o", 'ba', 'rão', 'as', 'si', 'nou'], `Attendu 10 syllabes avec "e'o", reçu: ${JSON.stringify(sylsEo)}`);
assert.ok(!sylsEo.includes('oba'), 'Ne doit jamais produire "oba"');

// Vérification des élisions consonantiques et vocaliques variées
assert.deepEqual(splitPortugueseLyricsIntoSyllables("d'água"), ["d'á", 'gua']);
assert.deepEqual(splitPortugueseLyricsIntoSyllables("qu'eu d'a n'a c'o p'ra"), ["qu'eu", "d'a", "n'a", "c'o", "p'ra"]);

// 2. Fusion par impulsion sur le Temps 3 : ["lou", "e", "o", "ba"] (4 unités) pour 3 attaques -> ["lou", "e'o", "ba"]
const mergedBeat3 = mergeSyllablesToImpulseCount(['lou ', 'e ', 'o ', 'ba'], 3).map((s) => s.trim());
assert.deepEqual(mergedBeat3, ['lou', "e'o", 'ba'], `Attendu ["lou", "e'o", "ba"], reçu: ${JSON.stringify(mergedBeat3)}`);

// 3. Alignement complet sur « [1]_ [2]Vovó _ fa[3]lou _ e o ba[4]rão _ assi[1]nou » (avec "e o" séparé ET avec "e'o")
for (const rawLine of [
  '[1]_ [2]Vovó _ fa[3]lou _ e o ba[4]rão _ assi[1]nou',
  "[1]_ [2]Vovó _ fa[3]lou _ e'o ba[4]rão _ assi[1]nou",
]) {
  const { timeAnchors } = extractTimeAnchors(rawLine, 4, true);
  const beat3Anchor = timeAnchors.find((a) => a.measureOffset === 0 && a.beat === 3);
  assert.ok(beat3Anchor, 'Ancre du Temps 3 introuvable');
  assert.deepEqual(
    (beat3Anchor.syllables || []).map((s) => s.trim()),
    ['lou', "e'o", 'ba'],
    `Syllabes du Temps 3 incorrectes pour "${rawLine}"`
  );
  assert.deepEqual(beat3Anchor.syllableSubdivs, [0, 2, 3], `Subdivisions du Temps 3 incorrectes pour "${rawLine}"`);

  // Simulation d'une grille de 20 pas (1 mesure + 1 temps de queue +1T)
  const dummySteps = Array.from({ length: 20 }, (_, i) => ({
    stepIndex: i,
    active: false,
    note: '',
    midiNumber: 0,
    velocity: 100,
    decay: 0.15,
    syllable: '',
  }));
  const aligned = applyLyricsSyllablesToSteps(dummySteps, undefined, timeAnchors, 4, 4);
  const beat3Syls = aligned
    .slice(8, 12)
    .filter((s) => s.active && !s.isTie && s.note !== '───')
    .map((s) => ({ subdiv: s.stepIndex - 8, syl: (s.syllable || '').trim() }));

  assert.deepEqual(
    beat3Syls,
    [
      { subdiv: 0, syl: 'lou' },
      { subdiv: 2, syl: "e'o" },
      { subdiv: 3, syl: 'ba' },
    ],
    `Pas alignés du Temps 3 incorrects pour "${rawLine}": ${JSON.stringify(beat3Syls)}`
  );

  // Vérification de la reconstruction de ligne Organizador depuis les pas MIDI
  const rebuiltLine = buildOrganizadorLineFromSteps({
    id: 'p1',
    name: 'Puxador 1',
    role: 'puxador',
    measuresCount: 1,
    hasAnacrusis: false,
    mainSteps: aligned,
    assignedLyricsText: "Vovó falou e o barão assinou",
    rawLineCode: rawLine,
  });
  assert.equal(rebuiltLine, "*[1]_ [2]Vovó _ fa[3]lou _ e'o ba[4]rão _ assi[1]nou*");
}

// 4. Soulignement Organizador (formatWordsWithUnderlinedSyllables) avec "e'o"
const underlined = formatWordsWithUnderlinedSyllables(
  'Vovó falou e o barão assinou',
  ['Vo', 'vó', 'fa', 'lou', "e'o", 'ba', 'rão', 'as', 'si', 'nou'],
  false,
  false
);
assert.ok(underlined.includes("<u>e</u>'o"), `Soulignement attendu avec "<u>e</u>'o", reçu: ${underlined}`);
assert.ok(!underlined.includes('<u>o</u>'), `Le "o" élidé dans "e'o" ne doit pas être souligné séparément: ${underlined}`);

console.log('✅ test_elision_eo_syllables.mjs : TOUTES LES ASSERTIONS SONT VALIDÉES !');

