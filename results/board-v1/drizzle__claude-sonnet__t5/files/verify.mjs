import fs from 'node:fs';
import assert from 'node:assert';
import { openDb, addAuthor, addBook, booksSince } from './solution.mjs';

const dbFile = './test.sqlite';
if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);

let db = openDb(dbFile);

const authorId1 = await addAuthor(db, 'Ursula K. Le Guin');
assert.strictEqual(typeof authorId1, 'number');

const authorId2 = await addAuthor(db, 'Isaac Asimov');

const book1 = await addBook(db, { title: 'The Dispossessed', year: 1974, authorId: authorId1 });
assert.strictEqual(typeof book1.id, 'number');
assert.strictEqual(book1.title, 'The Dispossessed');
assert.strictEqual(book1.year, 1974);
assert.strictEqual(book1.authorId, authorId1);

await addBook(db, { title: 'The Left Hand of Darkness', year: 1969, authorId: authorId1 });
await addBook(db, { title: 'Foundation', year: 1951, authorId: authorId2 });
await addBook(db, { title: "I, Robot", year: 1950, authorId: authorId2 });
await addBook(db, { title: 'The Currents of Space', year: 1952, authorId: authorId2 });

const since1960 = await booksSince(db, 1960);
console.log('booksSince(1960):', since1960);
assert.deepStrictEqual(since1960, [
  { title: 'The Left Hand of Darkness', year: 1969, author: 'Ursula K. Le Guin' },
  { title: 'The Dispossessed', year: 1974, author: 'Ursula K. Le Guin' },
]);

const since1950 = await booksSince(db, 1950);
console.log('booksSince(1950):', since1950);
assert.deepStrictEqual(since1950.map(b => b.title), [
  'I, Robot',
  'Foundation',
  'The Currents of Space',
  'The Left Hand of Darkness',
  'The Dispossessed',
]);

// Reopen the same file and confirm data persists
db = openDb(dbFile);
const reopened = await booksSince(db, 0);
console.log('reopened count:', reopened.length);
assert.strictEqual(reopened.length, 5);

// Uniqueness constraint on author name
let threw = false;
try {
  await addAuthor(db, 'Isaac Asimov');
} catch (e) {
  threw = true;
}
assert.strictEqual(threw, true, 'duplicate author name should throw due to unique constraint');

console.log('ALL CHECKS PASSED');
fs.unlinkSync(dbFile);
