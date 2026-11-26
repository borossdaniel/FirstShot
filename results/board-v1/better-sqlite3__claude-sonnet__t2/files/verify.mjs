import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  openDb,
  insertUsers,
  addOrder,
  getUserByEmail,
  topSpenders,
} from './db.mjs';

const file = './verify-test.sqlite';
fs.rmSync(file, { force: true });

// 1. open + migration
let db = openDb(file);
assert.equal(db.pragma('user_version', { simple: true }), 1);

// 2. insertUsers in a transaction
const n = insertUsers(db, [
  { email: 'a@example.com', name: 'Alice' },
  { email: 'b@example.com', name: 'Bob' },
  { email: 'c@example.com', name: 'Carol' },
]);
assert.equal(n, 3);

// 3. duplicate email rolls back the whole batch
assert.throws(() => {
  insertUsers(db, [
    { email: 'd@example.com', name: 'Dave' },
    { email: 'a@example.com', name: 'Dup' }, // duplicate
  ]);
});
assert.equal(getUserByEmail(db, 'd@example.com'), null); // rolled back

// 4. getUserByEmail
const alice = getUserByEmail(db, 'a@example.com');
assert.equal(alice.email, 'a@example.com');
assert.equal(alice.name, 'Alice');
const bob = getUserByEmail(db, 'b@example.com');
const carol = getUserByEmail(db, 'c@example.com');
assert.equal(getUserByEmail(db, 'nobody@example.com'), null);

// 5. addOrder + FK enforcement
const orderId = addOrder(db, { userId: alice.id, totalCents: 500 });
assert.equal(typeof orderId, 'number');
addOrder(db, { userId: alice.id, totalCents: 250 });
addOrder(db, { userId: bob.id, totalCents: 1000 });
// carol gets no orders

assert.throws(() => {
  addOrder(db, { userId: 99999, totalCents: 100 });
}, /FOREIGN KEY/);

// 6. topSpenders
const top = topSpenders(db, 10);
assert.deepEqual(top, [
  { email: 'b@example.com', totalCents: 1000 },
  { email: 'a@example.com', totalCents: 750 },
]);
const top1 = topSpenders(db, 1);
assert.equal(top1.length, 1);
assert.equal(top1[0].email, 'b@example.com');

db.close();

// 7. reopening keeps data and doesn't re-run migration destructively
db = openDb(file);
assert.equal(db.pragma('user_version', { simple: true }), 1);
assert.equal(getUserByEmail(db, 'a@example.com').name, 'Alice');
assert.equal(topSpenders(db, 10).length, 2);
db.close();

fs.rmSync(file, { force: true });

console.log('All checks passed.');
