import { newId, newEventId, isValidUuid, uuidVersion } from './solution.mjs';
import assert from 'node:assert/strict';

// newId
const id1 = newId();
const id2 = newId();
assert.notEqual(id1, id2);
assert.ok(isValidUuid(id1));
assert.equal(uuidVersion(id1), 4);

// newEventId without timestamp - creation order sorting
const ids = [];
for (let i = 0; i < 20; i++) {
  ids.push(newEventId());
}
const sorted = [...ids].sort();
assert.deepEqual(ids, sorted, 'ids created in sequence must sort in creation order');
for (const id of ids) {
  assert.ok(isValidUuid(id));
  assert.equal(uuidVersion(id), 7);
}

// newEventId with explicit timestamp - encodes that time
const ts = Date.UTC(2020, 0, 1); // 2020-01-01
const eventId = newEventId(ts);
assert.equal(uuidVersion(eventId), 7);
const encodedMs = parseInt(eventId.replace(/-/g, '').slice(0, 12), 16);
assert.equal(encodedMs, ts, `encoded timestamp ${encodedMs} should equal ${ts}`);

// ordering with explicit timestamps
const earlier = newEventId(Date.UTC(2021, 0, 1));
const later = newEventId(Date.UTC(2022, 0, 1));
assert.ok(earlier < later);

// isValidUuid edge cases
assert.equal(isValidUuid('not-a-uuid'), false);
assert.equal(isValidUuid(12345), false);
assert.equal(isValidUuid(null), false);
assert.equal(isValidUuid(undefined), false);
assert.equal(isValidUuid({}), false);
assert.equal(isValidUuid(id1), true);

// uuidVersion edge cases
assert.equal(uuidVersion('not-a-uuid'), null);
assert.equal(uuidVersion(12345), null);
assert.equal(uuidVersion(id1), 4);
assert.equal(uuidVersion(eventId), 7);

console.log('All checks passed.');
console.log('Sample v4:', id1);
console.log('Sample v7 (now):', ids[0]);
console.log('Sample v7 (2020-01-01):', eventId);
