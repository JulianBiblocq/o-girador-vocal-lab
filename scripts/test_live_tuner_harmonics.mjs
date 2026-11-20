/**
 * scripts/test_live_tuner_harmonics.mjs
 * Volet D : le détecteur « Cherche-Notes » doit verrouiller la vraie fondamentale (C3, F3) malgré des harmoniques
 * 2f0 / 3f0 dominants, rester sur C4 pour un vrai Do4, couper le bruit faible et la fin de souffle,
 * rejeter les sauts isolés et résister à l'écrêtage.
 * Lancer : node --import ./scripts/resolve-ts.mjs scripts/test_live_tuner_harmonics.mjs
 */
import assert from 'node:assert/strict';
import { detectLiveVocalPitch } from '../src/audio/liveVocalPitchCore.ts';
import { LiveVocalTunerDetector } from '../src/audio/liveVocalTunerDetector.ts';

const SR = 48000, N = 4096, HOP = 800;
const toMidi = (f) => 69 + 12 * Math.log2(f / 440);
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };

function synth(f0, partials, seconds, { amp = 0.3, noise = 0.004, vibrato = 0.003, clip = 0, fade = null } = {}) {
  const n = Math.floor(seconds * SR), out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = f0 * (1 + vibrato * Math.sin(2 * Math.PI * 5 * t));
    phase += (2 * Math.PI * f) / SR;
    let v = 0;
    partials.forEach((a, h) => { v += a * Math.sin(phase * (h + 1) + h); });
    v = v * amp + noise * rnd() * 2;
    if (fade) v *= Math.max(0, 1 - Math.max(0, t - fade[0]) / (fade[1] - fade[0]));
    out[i] = clip ? Math.max(-clip, Math.min(clip, v)) : v;
  }
  return out;
}

function run(signal, det = new LiveVocalTunerDetector()) {
  const res = [];
  for (let s = 0; s + N <= signal.length; s += HOP) res.push(det.process(signal.subarray(s, s + N), SR, 440));
  return res;
}

function checkNote(name, f0, partials, expectedMidi, opts) {
  const sig = synth(f0, partials, 2.0, opts), res = run(sig);
  const voiced = res.filter((r) => r.voiced), tail = res.slice(8);
  const ok = tail.filter((r) => r.voiced && Math.abs(r.midiFloat - expectedMidi) < 0.5).length;
  const octaveErrors = tail.filter((r) => r.voiced && Math.abs(r.midiFloat - expectedMidi) > 5).length;
  console.log(`  ${name}: ${ok}/${tail.length} trames justes, ${octaveErrors} erreurs d'octave/harmonique, ${voiced.length} voisées`);
  assert.ok(ok / tail.length >= 0.9, `${name} : fondamentale non verrouillée`);
  assert.equal(octaveErrors, 0, `${name} : saut harmonique détecté`);
}

console.log('=== TEST 1 : fondamentale faible + harmoniques 2f0/3f0 forts ===');
const C3 = 130.81, F3 = 174.61;
checkNote('Do3 (C3) [0.35 1.0 0.8]', C3, [0.35, 1.0, 0.8, 0.3], 48);
checkNote('Fa3 (F3) [0.30 1.0 0.9 0.4]', F3, [0.3, 1.0, 0.9, 0.4], 53);
checkNote('Fa3 (F3) riche en formants [0.5 0.9 1.0 0.7 0.5]', F3, [0.5, 0.9, 1.0, 0.7, 0.5], 53);
checkNote('Do3 fondamentale -14 dB, H2 dominant [0.2 1 0.1 0.8]', C3, [0.2, 1, 0.1, 0.8, 0.05], 48);
checkNote('Do3 H4 dominant [0.1 0.2 0.1 1]', C3, [0.1, 0.2, 0.1, 1], 48);
checkNote('Fa3 H3 dominant [0.18 0.15 1 0.1]', F3, [0.18, 0.15, 1, 0.1, 0.1], 53);

console.log('=== TEST 2 : non-régression Do4 réel (pas de faux sous-harmonique) ===');
checkNote('Do4 (C4) [1 0.3 0.1]', 261.63, [1, 0.3, 0.1], 60);
checkNote('La3 (A3) pur', 220, [1], 57);
checkNote('Do4 (C4) avec bruit de salle', 261.63, [1, 0.25], 60, { noise: 0.02 });
checkNote('Sol4 (G4) timbre nasal [0.6 1 0.8]', 392, [0.6, 1, 0.8], 67);

console.log('=== TEST 3 : écrêtage (harmoniques impaires) ===');
checkNote('Do3 écrêté 0.15', C3, [0.8, 0.6, 0.3], 48, { amp: 0.5, clip: 0.15 });

console.log('=== TEST 4 : bruit faible => aucune note ===');
{
  const noise = new Float32Array(SR), res = [];
  for (let i = 0; i < noise.length; i++) noise[i] = rnd() * 0.012;
  const r = run(noise);
  assert.equal(r.filter((x) => x.voiced).length, 0, 'bruit faible affiché comme note');
  const quiet = run(synth(C3, [1, 0.5], 1, { amp: 0.004, noise: 0.001 }));
  assert.equal(quiet.filter((x) => x.voiced).length, 0, 'signal sous le plancher affiché comme note');
  void res;
  console.log('  OK : 0 trame voisée sur bruit / signal sous la porte');
}

console.log('=== TEST 5 : relâchement de fin de souffle (pas de rebond Do4/Do#4) ===');
{
  const sig = synth(C3, [0.35, 1.0, 0.8], 2.4, { fade: [1.2, 1.6], noise: 0.003 });
  const res = run(sig), lastTone = Math.floor((1.7 * SR - N) / HOP);
  const late = res.slice(lastTone + 1).filter((r) => r.voiced);
  const bad = res.filter((r) => r.voiced && Math.abs(r.midiFloat - 48) > 1.5);
  console.log(`  trames voisées après relâchement : ${late.length}, notes parasites : ${bad.length}`);
  assert.equal(bad.length, 0, 'note parasite pendant le relâchement');
  assert.equal(late.length, 0, 'note affichée sur le bruit résiduel');
}

console.log('=== TEST 6 : rejet des sauts isolés > 5 demi-tons ===');
{
  const det = new LiveVocalTunerDetector(), base = synth(F3, [0.3, 1, 0.9], 1.2), glitch = synth(F3 * 2, [1, 0.2], 0.2);
  const merged = new Float32Array(base.length); merged.set(base);
  merged.set(glitch.subarray(0, 2400), Math.floor(0.6 * SR));
  const res = run(merged, det).filter((r) => r.voiced);
  const jumps = res.filter((r) => Math.abs(r.midiFloat - 53) > 2).length;
  console.log(`  trames hors F3 : ${jumps}`);
  assert.ok(jumps <= 1, 'saut isolé non filtré');
}

console.log('=== TEST 7 : bornes [65 Hz, 880 Hz] ===');
{
  const c2 = detectLiveVocalPitch(synth(65.41, [1, 0.6, 0.3], 0.3, { vibrato: 0 }).subarray(0, N), SR);
  assert.ok(Math.abs(toMidi(c2.freq) - 36) < 0.6, `C2 non résolu (${c2.freq.toFixed(1)} Hz)`);
  const a5 = detectLiveVocalPitch(synth(880, [1, 0.2], 0.3, { vibrato: 0 }).subarray(0, N), SR);
  assert.ok(Math.abs(toMidi(a5.freq) - 81) < 0.6, `A5 non résolu (${a5.freq.toFixed(1)} Hz)`);
  console.log(`  C2 -> ${c2.freq.toFixed(1)} Hz, A5 -> ${a5.freq.toFixed(1)} Hz`);
}
console.log('\n✅ test_live_tuner_harmonics : tous les contrôles passent');
