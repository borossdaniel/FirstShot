import assert from 'node:assert';
import fs from 'node:fs';
import {
  openDb,
  insertUsers,
  addOrder,
  getUserByEmail,
  topSpenders,
} from './db.mjs';

const file = './test.sqlite';
fs.rmSync(file, { force: true });

// 1. open + migration
let db = openDb(file);
assert.strictEqual(db.pragma('user_version', { simple: true }), 1);

// 2. insertUsers in a transaction, returns count
const inserted = insertUsers(db, [
  { email: 'a@example.com', name: 'Alice' },
  { email: 'b@example.com', name: 'Bob' },
  { email: 'c@example.com', name: 'Carol' },
]);
assert.strictEqual(inserted, 3);

// 3. duplicate email rolls back the whole batch
let threw = false;
try {
  insertUsers(db, [
    { email: 'd@example.com', name: 'Dave' },
    { email: 'a@example.com', name: 'Duplicate Alice' }, // dup
  ]);
} catch (e) {
  threw = true;
}
assert.strictEqual(threw, true, 'expected duplicate insert to throw');
assert.strictEqual(getUserByEmail(db, 'd@example.com'), null, 'rollback should have removed Dave too');

// 4. getUserByEmail
const alice = getUserByEmail(db, 'a@example.com');
assert.strictEqual(alice.email, 'a@example.com');
assert.strictEqual(alice.name, 'Alice');
assert.strictEqual(typeof alice.id, 'number');
assert.strictEqual(getUserByEmail(db, 'nope@example.com'), null);

const bob = getUserByEmail(db, 'b@example.com');
const carol = getUserByEmail(db, 'c@example.com');

// 5. addOrder
const orderId1 = addOrder(db, { userId: alice.id, totalCents: 1000 });
const orderId2 = addOrder(db, { userId: alice.id, totalCents: 500 });
const orderId3 = addOrder(db, { userId: bob.id, totalCents: 2000 });
assert.strictEqual(typeof orderId1, 'number');
assert.notStrictEqual(orderId1, orderId2);

// Carol has no orders - should be excluded from topSpenders

// 6. FK enforcement: invalid user_id must be rejected
let fkThrew = false;
try {
  addOrder(db, { userId: 999999, totalCents: 1 });
} catch (e) {
  fkThrew = true;
}
assert.strictEqual(fkThrew, true, 'expected FK violation to throw');

// 7. topSpenders: highest total first, excludes no-order users, respects limit
const top = topSpenders(db, 10);
assert.strictEqual(top.length, 2, 'carol should be excluded (no orders)');
assert.strictEqual(top[0].email, 'bob@example.com'.replace('bob@example.com', 'b@example.com'));
assert.strictEqual(top[0].totalCents, 2000);
assert.strictEqual(top[1].email, 'a@example.com');
assert.strictEqual(top[1].totalCents, 1500);

const topLimited = topSpenders(db, 1);
assert.strictEqual(topLimited.length, 1);
assert.strictEqual(topLimited[0].email, 'b@example.com');

db.close();

// 8. Reopening existing file keeps data and doesn't re-run migration destructively
db = openDb(file);
assert.strictEqual(db.pragma('user_version', { simple: true }), 1);
const aliceAgain = getUserByEmail(db, 'a@example.com');
assert.ok(aliceAgain, 'data should persist across reopen');
assert.strictEqual(aliceAgain.name, 'Alice');
const topAfterReopen = topSpenders(db, 10);
assert.strictEqual(topAfterReopen.length, 2, 'orders should persist across reopen');

db.close();
fs.rmSync(file, { force: true });

console.log('All tests passed.');
