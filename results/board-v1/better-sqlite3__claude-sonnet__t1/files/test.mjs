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
for (const suffix of ['', '-wal', '-shm']) {
  fs.rmSync(file + suffix, { force: true });
}

// 1. open + migration
let db = openDb(file);
assert.equal(db.pragma('user_version', { simple: true }), 1);

// 2. insertUsers in a single transaction
const count = insertUsers(db, [
  { email: 'alice@example.com', name: 'Alice' },
  { email: 'bob@example.com', name: 'Bob' },
  { email: 'carol@example.com', name: 'Carol' },
]);
assert.equal(count, 3);

// 3. duplicate email rolls back the whole batch
let threw = false;
try {
  insertUsers(db, [
    { email: 'dave@example.com', name: 'Dave' },
    { email: 'alice@example.com', name: 'Alice Again' }, // duplicate
  ]);
} catch (err) {
  threw = true;
}
assert.equal(threw, true, 'expected duplicate insert to throw');
assert.equal(getUserByEmail(db, 'dave@example.com'), null, 'rollback must discard dave too');

// 4. getUserByEmail
const alice = getUserByEmail(db, 'alice@example.com');
assert.ok(alice);
assert.equal(alice.email, 'alice@example.com');
assert.equal(alice.name, 'Alice');
assert.equal(getUserByEmail(db, 'nobody@example.com'), null);

const bob = getUserByEmail(db, 'bob@example.com');
const carol = getUserByEmail(db, 'carol@example.com');

// 5. addOrder + foreign key enforcement
const orderId1 = addOrder(db, { userId: alice.id, totalCents: 1500 });
assert.equal(typeof orderId1, 'number');
addOrder(db, { userId: alice.id, totalCents: 2500 });
addOrder(db, { userId: bob.id, totalCents: 500 });
// carol has no orders -> excluded from topSpenders

let fkThrew = false;
try {
  addOrder(db, { userId: 999999, totalCents: 100 });
} catch (err) {
  fkThrew = true;
}
assert.equal(fkThrew, true, 'expected FK violation to throw for nonexistent user');

// 6. topSpenders
const spenders = topSpenders(db, 10);
assert.deepEqual(spenders, [
  { email: 'alice@example.com', totalCents: 4000 },
  { email: 'bob@example.com', totalCents: 500 },
]);
assert.equal(spenders.some((s) => s.email === 'carol@example.com'), false);

const limited = topSpenders(db, 1);
assert.equal(limited.length, 1);
assert.equal(limited[0].email, 'alice@example.com');

db.close();

// 7. reopening keeps data and does not rerun migration destructively
db = openDb(file);
assert.equal(db.pragma('user_version', { simple: true }), 1);
assert.ok(getUserByEmail(db, 'alice@example.com'));
assert.equal(topSpenders(db, 10).length, 2);
db.close();

for (const suffix of ['', '-wal', '-shm']) {
  fs.rmSync(file + suffix, { force: true });
}

console.log('All tests passed.');
