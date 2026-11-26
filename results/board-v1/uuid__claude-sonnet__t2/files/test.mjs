import assert from 'node:assert/strict';
import { newId, newEventId, isValidUuid, uuidVersion } from './solution.mjs';

const id4 = newId();
assert.ok(isValidUuid(id4), 'newId() should be valid');
assert.equal(uuidVersion(id4), 4);

const id7 = newEventId();
assert.ok(isValidUuid(id7), 'newEventId() should be valid');
assert.equal(uuidVersion(id7), 7);

const fixedTs = Date.parse('2020-01-01T00:00:00.000Z');
const idFixed = newEventId(fixedTs);
assert.ok(isValidUuid(idFixed));
assert.equal(uuidVersion(idFixed), 7);

const hex = idFixed.replace(/-/g, '');
const decodedMsecs = parseInt(hex.slice(0, 12), 16);
assert.equal(decodedMsecs, fixedTs, 'encoded timestamp should match input');

const ids = [];
for (let i = 0; i < 20; i++) {
  ids.push(newEventId());
}
const sorted = [...ids].sort();
assert.deepEqual(ids, sorted, 'ids created in sequence should sort in creation order');

assert.equal(isValidUuid('not-a-uuid'), false);
assert.equal(isValidUuid(12345), false);
assert.equal(isValidUuid(null), false);
assert.equal(uuidVersion('not-a-uuid'), null);
assert.equal(uuidVersion(id4), 4);

console.log('All checks passed.');
console.log('sample v4:', id4);
console.log('sample v7 (now):', id7);
console.log('sample v7 (fixed ts):', idFixed);
