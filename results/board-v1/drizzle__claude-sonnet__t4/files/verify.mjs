import { unlinkSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
import { openDb, addAuthor, addBook, booksSince } from './solution.mjs';

const dbPath = './test.sqlite';
for (const f of [dbPath, dbPath + '-wal', dbPath + '-shm']) {
  if (existsSync(f)) unlinkSync(f);
}

let db = openDb(dbPath);

const tolkienId = await addAuthor(db, 'J.R.R. Tolkien');
const orwellId = await addAuthor(db, 'George Orwell');

assert.equal(typeof tolkienId, 'number');
assert.equal(typeof orwellId, 'number');

const hobbit = await addBook(db, { title: 'The Hobbit', year: 1937, authorId: tolkienId });
assert.deepEqual(hobbit, { id: hobbit.id, title: 'The Hobbit', year: 1937, authorId: tolkienId });

await addBook(db, { title: 'The Fellowship of the Ring', year: 1954, authorId: tolkienId });
await addBook(db, { title: '1984', year: 1949, authorId: orwellId });
await addBook(db, { title: 'Animal Farm', year: 1945, authorId: orwellId });

let since1945 = await booksSince(db, 1945);
assert.deepEqual(since1945, [
  { title: 'Animal Farm', year: 1945, author: 'George Orwell' },
  { title: '1984', year: 1949, author: 'George Orwell' },
  { title: 'The Fellowship of the Ring', year: 1954, author: 'J.R.R. Tolkien' },
]);

// reopen the same file and confirm data persisted
db = openDb(dbPath);
const sinceReopen = await booksSince(db, 1900);
assert.equal(sinceReopen.length, 4);

// unique constraint on author name
let threw = false;
try {
  await addAuthor(db, 'George Orwell');
} catch (e) {
  threw = true;
}
assert.equal(threw, true, 'expected unique constraint violation');

console.log('All checks passed.');
console.log(JSON.stringify(sinceReopen, null, 2));
