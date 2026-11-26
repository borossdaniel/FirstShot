import { openDb, addAuthor, addBook, booksSince } from './solution.mjs';
import fs from 'node:fs';

const dbFile = './test.sqlite';
for (const f of [dbFile, dbFile + '-wal', dbFile + '-shm']) {
  if (fs.existsSync(f)) fs.rmSync(f);
}

let db = openDb(dbFile);

const tolkienId = await addAuthor(db, 'J.R.R. Tolkien');
const orwellId = await addAuthor(db, 'George Orwell');

const b1 = await addBook(db, { title: 'The Hobbit', year: 1937, authorId: tolkienId });
console.log('inserted book:', b1);

await addBook(db, { title: 'The Fellowship of the Ring', year: 1954, authorId: tolkienId });
await addBook(db, { title: '1984', year: 1949, authorId: orwellId });
await addBook(db, { title: 'Animal Farm', year: 1945, authorId: orwellId });

const since1945 = await booksSince(db, 1945);
console.log('books since 1945:', since1945);

// Re-open same file, verify data persists
db = openDb(dbFile);
const since1950 = await booksSince(db, 1950);
console.log('books since 1950 (reopened db):', since1950);

// Verify unique constraint on author name
try {
  await addAuthor(db, 'George Orwell');
  console.error('FAIL: expected unique constraint violation');
  process.exit(1);
} catch (e) {
  console.log('OK: unique constraint enforced:', e.message.split('\n')[0]);
}

console.log('ALL CHECKS PASSED');
