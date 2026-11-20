/**
 * scripts/test_conductor_slot_insert.mjs
 * Volet A : insérer / ajouter / supprimer une colonne de la Frise Conducteur ne décale JAMAIS les audios :
 * la liaison reste strictement par `patternId` immuable (aucun pattern n'est touché).
 * Lancer : node --import ./scripts/resolve-ts.mjs scripts/test_conductor_slot_insert.mjs
 */
import assert from 'node:assert/strict';
import { insertSlotAt, removeSlotById, reorderSlotList } from '../src/utils/conductorSlotOps.ts';

const mk = (n) => Array.from({ length: n }, (_, i) => ({ slotId: `slot-${i + 1}`, puxadorPatternId: i % 2 ? null : `pat-p${i}`, coroPatternId: i % 2 ? `pat-c${i}` : null, advanceMeasures: 1 }));
const bindings = (slots) => new Map(slots.map((s) => [s.slotId, `${s.puxadorPatternId}|${s.coroPatternId}`]));
const original = mk(6), frozen = JSON.stringify(original);

console.log('=== TEST 1 : insertion à toutes les positions (début, milieu, fin) ===');
for (let at = 0; at <= original.length; at++) {
  const next = insertSlotAt(original, at);
  assert.equal(next.length, original.length + 1);
  assert.equal(next[at].puxadorPatternId, null); assert.equal(next[at].coroPatternId, null);
  const before = bindings(original), after = bindings(next);
  for (const [slotId, link] of before) assert.equal(after.get(slotId), link, `liaison ${slotId} modifiée à l'insertion @${at}`);
  const order = next.filter((s) => before.has(s.slotId)).map((s) => s.slotId);
  assert.deepEqual(order, original.map((s) => s.slotId), 'ordre relatif des colonnes existantes modifié');
}
assert.equal(JSON.stringify(original), frozen, 'le tableau source a été muté');
console.log('  OK : 7 positions, liaisons patternId inchangées, source non mutée');

console.log('=== TEST 2 : index hors bornes / NaN => borné, ids uniques ===');
{
  let slots = original;
  for (const at of [-5, 99, NaN, 2.7]) slots = insertSlotAt(slots, at);
  assert.equal(slots.length, original.length + 4);
  assert.equal(new Set(slots.map((s) => s.slotId)).size, slots.length, 'slotId dupliqué');
  assert.equal(insertSlotAt(original, -5)[0].puxadorPatternId, null);
  assert.equal(insertSlotAt(original, 99).at(-1).coroPatternId, null);
  console.log('  OK');
}

console.log('=== TEST 3 : pause Batuque insérée avec advanceMeasures ===');
{
  const next = insertSlotAt(original, 3, 2);
  assert.equal(next[3].advanceMeasures, 2); assert.equal(next[3].puxadorPatternId, null);
  console.log('  OK');
}

console.log('=== TEST 4 : suppression & réordonnancement ne touchent que l\'ordre/la colonne visée ===');
{
  const removed = removeSlotById(original, 'slot-3');
  assert.equal(removed.length, 5); assert.ok(!removed.some((s) => s.slotId === 'slot-3'));
  for (const s of removed) assert.equal(bindings(removed).get(s.slotId), bindings(original).get(s.slotId));
  assert.equal(removeSlotById([original[0]], 'slot-1').length, 1, 'la dernière colonne ne doit pas disparaître');
  const moved = reorderSlotList(original, 0, 4);
  assert.deepEqual([...bindings(moved).entries()].sort(), [...bindings(original).entries()].sort());
  assert.equal(reorderSlotList(original, 2, 2), original);
  console.log('  OK');
}
console.log('\n✅ test_conductor_slot_insert : tous les contrôles passent');
