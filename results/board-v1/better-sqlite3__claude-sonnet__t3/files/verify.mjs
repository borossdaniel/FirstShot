import { openDb, insertUsers, addOrder, getUserByEmail, topSpenders } from './db.mjs';
import fs from 'node:fs';
import assert from 'node:assert';

const file = './test.sqlite';
fs.rmSync(file, { force: true });

let db = openDb(file);
assert.strictEqual(db.pragma('user_version', { simple: true }), 1, 'schema version should be 1 after migration');

const count = insertUsers(db, [
  { email: 'alice@example.com', name: 'Alice' },
  { email: 'bob@example.com', name: 'Bob' },
]);
assert.strictEqual(count, 2, 'should insert 2 users');

// Transaction rollback on duplicate email
let threw = false;
try {
  insertUsers(db, [
    { email: 'carol@example.com', name: 'Carol' },
    { email: 'alice@example.com', name: 'Alice Dup' }, // duplicate -> should fail
  ]);
} catch (e) {
  threw = true;
}
assert.ok(threw, 'duplicate email insert should throw');
assert.strictEqual(getUserByEmail(db, 'carol@example.com'), null, 'failed transaction should not have inserted carol');

const alice = getUserByEmail(db, 'alice@example.com');
assert.ok(alice && alice.email === 'alice@example.com' && alice.name === 'Alice');
const bob = getUserByEmail(db, 'bob@example.com');
assert.ok(bob);

assert.strictEqual(getUserByEmail(db, 'nope@example.com'), null, 'missing user should return null');

// Foreign key enforcement: order pointing to nonexistent user must be rejected
let fkThrew = false;
try {
  addOrder(db, { userId: 9999, totalCents: 100 });
} catch (e) {
  fkThrew = true;
}
assert.ok(fkThrew, 'order with nonexistent userId should be rejected by the database');

const orderId1 = addOrder(db, { userId: alice.id, totalCents: 500 });
const orderId2 = addOrder(db, { userId: alice.id, totalCents: 300 });
const orderId3 = addOrder(db, { userId: bob.id, totalCents: 1000 });
assert.strictEqual(typeof orderId1, 'number');
assert.ok(orderId1 !== orderId2);

const top = topSpenders(db, 10);
assert.strictEqual(top.length, 2, 'should only include users with orders');
assert.strictEqual(top[0].email, 'bob@example.com');
assert.strictEqual(top[0].totalCents, 1000);
assert.strictEqual(top[1].email, 'alice@example.com');
assert.strictEqual(top[1].totalCents, 800);

const topLimited = topSpenders(db, 1);
assert.strictEqual(topLimited.length, 1);
assert.strictEqual(topLimited[0].email, 'bob@example.com');

db.close();

// Reopening an existing file should keep data and not re-run migration destructively
db = openDb(file);
assert.strictEqual(db.pragma('user_version', { simple: true }), 1);
const aliceAgain = getUserByEmail(db, 'alice@example.com');
assert.ok(aliceAgain, 'data should persist after reopening the db file');
assert.strictEqual(topSpenders(db, 10).length, 2, 'orders should persist after reopening');
db.close();

fs.rmSync(file, { force: true });
console.log('ALL CHECKS PASSED');
