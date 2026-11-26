import assert from 'node:assert/strict';
import { newId, newEventId, isValidUuid, uuidVersion } from './solution.mjs';

const id4 = newId();
assert.equal(isValidUuid(id4), true, 'newId should be valid');
assert.equal(uuidVersion(id4), 4, 'newId should be v4');

const id7 = newEventId();
assert.equal(isValidUuid(id7), true, 'newEventId should be valid');
assert.equal(uuidVersion(id7), 7, 'newEventId should be v7');

const fixedTs = 1_700_000_000_000;
const idA = newEventId(fixedTs);
const idB = newEventId(fixedTs);
assert.equal(uuidVersion(idA), 7);
// same timestamp should produce same time-prefix (first 12 hex chars encode the 48-bit ms timestamp)
assert.equal(idA.slice(0, 13), idB.slice(0, 13), 'same timestamp should share time prefix');

// ordering test: ids created in sequence without explicit timestamp must sort in creation order
const sequence = [];
for (let i = 0; i < 20; i++) {
  sequence.push(newEventId());
}
const sorted = [...sequence].sort();
assert.deepEqual(sequence, sorted, 'v7 ids must sort in creation order');

// a known-earlier timestamp must sort before a known-later one
const earlier = newEventId(1_000_000_000_000);
const later = newEventId(2_000_000_000_000);
assert.ok(earlier < later, 'earlier timestamp must sort before later timestamp');

assert.equal(isValidUuid('not-a-uuid'), false);
assert.equal(isValidUuid(12345), false);
assert.equal(isValidUuid(null), false);
assert.equal(isValidUuid(undefined), false);
assert.equal(uuidVersion('not-a-uuid'), null);
assert.equal(uuidVersion(42), null);

console.log('All tests passed.');
console.log({ id4, id7, earlier, later });
