import assert from 'node:assert/strict';
import { newId, newEventId, isValidUuid, uuidVersion } from './solution.mjs';

// newId
const id1 = newId();
const id2 = newId();
assert.ok(isValidUuid(id1));
assert.equal(uuidVersion(id1), 4);
assert.notEqual(id1, id2);

// newEventId without timestamp: creation order sorts lexicographically
const e1 = newEventId();
const e2 = newEventId();
const e3 = newEventId();
assert.ok(isValidUuid(e1));
assert.equal(uuidVersion(e1), 7);
assert.ok(e1 < e2 && e2 < e3, 'v7 ids must sort in creation order');

// newEventId with explicit timestamp encodes that time
const ts = 1700000000000;
const e4 = newEventId(ts);
const e5 = newEventId(ts);
// Same timestamp -> same 48-bit time prefix (first 12 hex chars before dashes/version)
assert.equal(e4.slice(0, 8), e5.slice(0, 8));
const earlier = newEventId(ts - 1000 * 60 * 60); // 1 hour earlier
assert.ok(earlier < e4, 'earlier timestamp must sort before later timestamp');

// isValidUuid
assert.equal(isValidUuid('not-a-uuid'), false);
assert.equal(isValidUuid(12345), false);
assert.equal(isValidUuid(null), false);
assert.equal(isValidUuid(undefined), false);
assert.equal(isValidUuid('00000000-0000-0000-0000-000000000000'), true); // nil uuid, valid format

// uuidVersion
assert.equal(uuidVersion('not-a-uuid'), null);
assert.equal(uuidVersion(id1), 4);
assert.equal(uuidVersion(e1), 7);

console.log('All tests passed.');
