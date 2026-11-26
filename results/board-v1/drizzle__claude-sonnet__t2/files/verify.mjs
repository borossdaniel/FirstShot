import fs from 'node:fs';
import assert from 'node:assert/strict';
import { openDb, addAuthor, addBook, booksSince } from './solution.mjs';

const dbPath = './test.sqlite';
for (const suffix of ['', '-wal', '-shm']) {
  if (fs.existsSync(dbPath + suffix)) fs.unlinkSync(dbPath + suffix);
}

let db = openDb(dbPath);

const tolkienId = await addAuthor(db, 'J.R.R. Tolkien');
const orwellId = await addAuthor(db, 'George Orwell');
assert.equal(typeof tolkienId, 'number');
assert.equal(typeof orwellId, 'number');

const book1 = await addBook(db, { title: 'The Hobbit', year: 1937, authorId: tolkienId });
assert.deepEqual(book1, { id: book1.id, title: 'The Hobbit', year: 1937, authorId: tolkienId });

await addBook(db, { title: 'The Fellowship of the Ring', year: 1954, authorId: tolkienId });
await addBook(db, { title: 'Animal Farm', year: 1945, authorId: orwellId });
await addBook(db, { title: 'Nineteen Eighty-Four', year: 1949, authorId: orwellId });

// reopen to confirm persistence
db = openDb(dbPath);

const since1945 = await booksSince(db, 1945);
assert.deepEqual(since1945, [
  { title: 'Animal Farm', year: 1945, author: 'George Orwell' },
  { title: 'Nineteen Eighty-Four', year: 1949, author: 'George Orwell' },
  { title: 'The Fellowship of the Ring', year: 1954, author: 'J.R.R. Tolkien' },
]);

// unique constraint check
let threw = false;
try {
  await addAuthor(db, 'George Orwell');
} catch (e) {
  threw = true;
}
assert.equal(threw, true, 'duplicate author name should fail unique constraint');

console.log('All checks passed.');
console.log(JSON.stringify(since1945, null, 2));

for (const suffix of ['', '-wal', '-shm']) {
  if (fs.existsSync(dbPath + suffix)) fs.unlinkSync(dbPath + suffix);
}
