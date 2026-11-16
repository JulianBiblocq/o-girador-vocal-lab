/**
 * test_cordel_fita_and_student_shell.mjs
 * Suite de non-régression de l'architecture « Bandeirolas + A Fita + Page Dédiée Élève » :
 * 1. Forme exacte des 4 Fanions Studio (pentagone convexe SVG pointe pleine vers le bas, zéro encoche creuse).
 * 2. Séparation franche Studio (canWriteCantador) vs Page Dédiée Élève (?mode=eleve) + 1. Fiche & Paroles.
 * 3. Contrat acoustique referencePitchHz (415..466 Hz, défaut 440) sans écraser referencePitch: string.
 * 4. Zéro Render/Layout Thrashing 60 FPS & Zéro Emoji 3D Windows dans les composants refondus.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { canAccessVocalStudio, getInitialRoleMode } from '../src/utils/vocalPermissions.ts';
import { sanitizePitchHz, DEFAULT_REFERENCE_PITCH_HZ } from '../src/utils/pitchHzContract.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');

console.log('=== TEST SUITE : CORDEL BANDEIROLAS, A FITA & PAGE DÉDIÉE ÉLÈVE ===\n');

// 1. Directive 1 : Fanions SVG à pointe pleine convexe vers le bas (zéro encoche creuse / clip-path)
{
  const navCode = fs.readFileSync(path.join(SRC, 'components/navigation/BandeirolasNavbar.tsx'), 'utf8');
  assert.ok(navCode.includes('<svg viewBox="0 0 100 100" preserveAspectRatio="none"'), 'BandeirolasNavbar doit dessiner les fanions en SVG preserveAspectRatio="none"');
  assert.ok(navCode.includes('points="1,1 99,1 99,76 50,98.5 1,76"'), 'Chaque fanion doit être un pentagone convexe à pointe unique vers le bas');
  assert.ok(navCode.includes('vectorEffect="non-scaling-stroke"'), 'Le filet d’encre Cordel doit utiliser vectorEffect="non-scaling-stroke"');
  assert.ok(!navCode.includes('clip-path') && !navCode.includes('clipPath'), 'Aucun clip-path rognant la bordure ne doit être utilisé sur les fanions');
  assert.ok(navCode.includes("if (viewRoleMode === 'eleve') return null;"), 'La cordelette des 4 fanions Studio ne doit jamais monter en Vue Élève');
  console.log('✓ 1. Directive 1 validée : 4 Fanions Studio SVG à pointe convexe vers le bas + bordure 5 côtés intacte.');
}

// 2. Directive 2 : Permissions canWriteCantador & Page Dédiée Élève
{
  assert.equal(canAccessVocalStudio({ role: 'mestre' }, { hostname: 'cantador.ogirador.com' }), true);
  assert.equal(canAccessVocalStudio({ role: 'admin' }, { hostname: 'cantador.ogirador.com' }), true);
  assert.equal(canAccessVocalStudio({ role: 'membre', canWriteCantador: true }, { hostname: 'cantador.ogirador.com' }), true);
  assert.equal(canAccessVocalStudio({ role: 'membre', canWriteCantador: false }, { hostname: 'cantador.ogirador.com' }), false);
  assert.equal(canAccessVocalStudio(null, { hostname: 'localhost', search: '?mode=eleve' }), false);
  assert.equal(getInitialRoleMode({ role: 'membre', canWriteCantador: false }, { hostname: 'cantador.ogirador.com' }), 'eleve');
  assert.equal(getInitialRoleMode({ role: 'mestre' }, { hostname: 'cantador.ogirador.com', search: '?mode=eleve' }), 'eleve');
  assert.equal(getInitialRoleMode({ role: 'mestre' }, { hostname: 'cantador.ogirador.com' }), 'studio');

  const headerCode = fs.readFileSync(path.join(SRC, 'components/header/CompactStudioHeader.tsx'), 'utf8');
  assert.ok(headerCode.includes('!isEleve &&'), 'Les 3 poinçons Studio ([BPM], [Tonalité], [Matériel]) sont masqués en Vue Élève');
  assert.ok(headerCode.includes('btnStudentMicHeadphones'), 'Le bouton [Micro & Casque] est présent en Vue Élève');
  assert.ok(headerCode.includes('canAccessStudio &&'), 'Le bouton [← Retour Studio] est réservé aux utilisateurs autorisés (canAccessVocalStudio)');

  const rendererCode = fs.readFileSync(path.join(SRC, 'components/navigation/LivretContentRenderer.tsx'), 'utf8');
  assert.ok(rendererCode.includes("if (viewRoleMode === 'eleve')"), 'LivretContentRenderer verrouille strictement les livrets Studio en Vue Élève');

  const treinoCode = fs.readFileSync(path.join(SRC, 'components/livret-treino/LivretTreino.tsx'), 'utf8');
  assert.ok(treinoCode.includes("'fiche_paroles'") && treinoCode.includes('StudentToadaSheetPanel'), 'L’espace Élève ouvre par défaut 1. Fiche & Paroles');
  console.log('✓ 2. Directive 2 validée : canWriteCantador, isolation ?mode=eleve et onglet 1. Fiche & Paroles.');
}

// 3. Contrat acoustique referencePitchHz (415..466 Hz) sans collision avec referencePitch: string
{
  assert.equal(sanitizePitchHz(undefined), DEFAULT_REFERENCE_PITCH_HZ);
  assert.equal(sanitizePitchHz(442), 442);
  assert.equal(sanitizePitchHz(300), 440);
  assert.equal(sanitizePitchHz(500), 440);

  const tonalityStampCode = fs.readFileSync(path.join(SRC, 'components/header/TonalityStampPopover.tsx'), 'utf8');
  const reglagesCode = fs.readFileSync(path.join(SRC, 'components/livret-reglages/LivretReglages.tsx'), 'utf8');
  assert.ok(tonalityStampCode.includes('referencePitchHz: cleanHz'), 'TonalityStampPopover persiste referencePitchHz: number');
  assert.ok(reglagesCode.includes('referencePitchHz: cleanHz') && reglagesCode.includes('onReferencePitchChange'), 'LivretReglages sépare referencePitchHz (Hz) et referencePitch (string)');
  console.log('✓ 3. Contrat acoustique referencePitchHz (415..466 Hz) vs referencePitch (string) validé.');
}

// 4. Directive 3 & Perf 60 FPS : Zéro Emoji 3D couleur, @custom-variant dark, ResizeObserver & getPlayheadSec
{
  const indexCss = fs.readFileSync(path.join(SRC, 'index.css'), 'utf8');
  assert.ok(indexCss.includes('@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));'), '@custom-variant dark préservé dans index.css');
  assert.ok(indexCss.includes('/textures/pattern-maracatu-gravure.svg'), 'Papier peint gravé pattern-maracatu-gravure.svg actif par défaut');
  assert.ok(indexCss.includes('--wallpaper-opacity: 0.16;') && indexCss.includes('--wallpaper-opacity: 0.12;'), 'Opacités papier peint 0.16 jour / 0.12 nuit');

  const ribbonCode = fs.readFileSync(path.join(SRC, 'components/livret-prise/CabineTimelineRibbon.tsx'), 'utf8');
  assert.ok(ribbonCode.includes('ResizeObserver') && !ribbonCode.includes('getBoundingClientRect'), 'Zéro Layout Thrashing dans CabineTimelineRibbon');

  const targetFiles = [
    'components/header/CompactStudioHeader.tsx',
    'components/header/BpmStampPopover.tsx',
    'components/header/TonalityStampPopover.tsx',
    'components/header/HardwareStampPopover.tsx',
    'components/header/SyncAndExportDropdown.tsx',
    'components/navigation/BandeirolasNavbar.tsx',
    'components/fita/AFitaFrame.tsx',
    'components/fita/AFitaCompassStrip.tsx',
    'components/livret-treino/StudentToadaSheetPanel.tsx',
    'components/livret-treino/StudentToadaQuizCard.tsx',
    'i18n/fitaBandeirolasTranslationsFr.ts',
    'i18n/fitaBandeirolasTranslationsBr.ts',
  ];
  const colorEmojiRe = /[\u{1F300}-\u{1FAFF}]/u;
  for (const rel of targetFiles) {
    const c = fs.readFileSync(path.join(SRC, rel), 'utf8');
    assert.ok(!colorEmojiRe.test(c), `Emoji couleur 3D interdit détecté dans ${rel}`);
  }
  console.log('✓ 4. Directive 3 & Perf 60 FPS validées : 0 emoji 3D, @custom-variant dark, ResizeObserver & gravure.');
}

console.log('\n🎉 TOUS LES TESTS CORDEL BANDEIROLAS, A FITA & PAGE ÉLÈVE SONT PASSÉS AVEC SUCCÈS !');
