import { newId, newEventId, isValidUuid, uuidVersion } from './solution.mjs';

const id4 = newId();
console.log('newId:', id4, isValidUuid(id4), uuidVersion(id4));
console.assert(isValidUuid(id4) === true, 'id4 should be valid');
console.assert(uuidVersion(id4) === 4, 'id4 should be version 4');

const ts = 1700000000000;
const id7 = newEventId(ts);
console.log('newEventId(ts):', id7, isValidUuid(id7), uuidVersion(id7));
console.assert(isValidUuid(id7) === true, 'id7 should be valid');
console.assert(uuidVersion(id7) === 7, 'id7 should be version 7');

// verify timestamp encoding: first 48 bits of a v7 uuid = ms since epoch
const hex = id7.replace(/-/g, '');
const encodedMs = parseInt(hex.slice(0, 12), 16);
console.log('encoded ms:', encodedMs, 'expected:', ts);
console.assert(encodedMs === ts, 'timestamp should be encoded correctly');

// sequential ids without timestamp should sort in creation order
const ids = [];
for (let i = 0; i < 1000; i++) {
  ids.push(newEventId());
}
const sorted = [...ids].sort();
const isSorted = ids.every((v, i) => v === sorted[i]);
console.log('sequential ids sorted correctly:', isSorted);
console.assert(isSorted, 'ids should sort in creation order');

// invalid inputs
console.assert(isValidUuid('not-a-uuid') === false, 'invalid string should be false');
console.assert(isValidUuid(12345) === false, 'non-string should be false');
console.assert(isValidUuid(null) === false, 'null should be false');
console.assert(uuidVersion('not-a-uuid') === null, 'invalid uuid version should be null');
console.assert(uuidVersion(12345) === null, 'non-string version should be null');

console.log('ALL CHECKS PASSED');
