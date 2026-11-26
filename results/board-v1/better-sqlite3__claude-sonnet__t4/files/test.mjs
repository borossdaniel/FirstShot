import assert from 'node:assert/strict';
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

let db = openDb(file);
assert.equal(db.pragma('user_version', { simple: true }), 1);

const inserted = insertUsers(db, [
  { email: 'a@example.com', name: 'Alice' },
  { email: 'b@example.com', name: 'Bob' },
  { email: 'c@example.com', name: 'Carol' },
]);
assert.equal(inserted, 3);

// Duplicate email in a batch must roll back the whole transaction.
assert.throws(() => {
  insertUsers(db, [
    { email: 'd@example.com', name: 'Dave' },
    { email: 'a@example.com', name: 'Dupe' }, // duplicate
  ]);
});
assert.equal(getUserByEmail(db, 'd@example.com'), null);

const alice = getUserByEmail(db, 'a@example.com');
assert.ok(alice);
assert.equal(alice.email, 'a@example.com');
assert.equal(alice.name, 'Alice');

const bob = getUserByEmail(db, 'b@example.com');
const carol = getUserByEmail(db, 'c@example.com');

const o1 = addOrder(db, { userId: alice.id, totalCents: 500 });
const o2 = addOrder(db, { userId: alice.id, totalCents: 250 });
addOrder(db, { userId: bob.id, totalCents: 1000 });
assert.equal(typeof o1, 'number');
assert.equal(typeof o2, 'number');

// Carol has no orders -> excluded from topSpenders.
const top = topSpenders(db, 10);
assert.deepEqual(top, [
  { email: 'b@example.com', totalCents: 1000 },
  { email: 'a@example.com', totalCents: 750 },
]);

const top1 = topSpenders(db, 1);
assert.equal(top1.length, 1);
assert.equal(top1[0].email, 'b@example.com');

// Orders must not reference a nonexistent user.
assert.throws(() => addOrder(db, { userId: 99999, totalCents: 100 }));

assert.equal(getUserByEmail(db, 'nobody@example.com'), null);

db.close();

// Reopening an existing file keeps data and does not re-run migration.
db = openDb(file);
assert.equal(db.pragma('user_version', { simple: true }), 1);
assert.ok(getUserByEmail(db, 'a@example.com'));
assert.equal(topSpenders(db, 10).length, 2);
db.close();

fs.rmSync(file, { force: true });

console.log('All tests passed.');
