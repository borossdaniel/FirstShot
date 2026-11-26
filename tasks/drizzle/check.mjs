import { runCheck, expectInstalled, importSolution, importFromWorkspace, expect, expectEqual, fail, firstLine } from '../../src/check-helpers.js';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function closeDb(db) {
  try {
    const c = db?.$client;
    if (c && typeof c.close === 'function') await c.close();
  } catch {
    /* ignore */
  }
}

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'drizzle-orm', 0);
  const schema = await importSolution(ws, 'schema.mjs');
  const m = await importSolution(ws, 'solution.mjs');
  for (const f of ['openDb', 'addAuthor', 'addBook', 'booksSince']) expect(typeof m[f] === 'function', `${f} is not exported from solution.mjs`);

  const orm = await importFromWorkspace(ws, 'drizzle-orm');
  const core = await importFromWorkspace(ws, 'drizzle-orm/sqlite-core');
  for (const t of ['authors', 'books']) {
    expect(schema[t] && orm.is(schema[t], core.SQLiteTable), `schema.mjs does not export \`${t}\` as a Drizzle SQLite table (sqliteTable)`);
  }
  const { authors, books } = schema;
  for (const col of ['id', 'title', 'year', 'authorId']) expect(books[col], `books table has no \`${col}\` column`);
  for (const col of ['id', 'name']) expect(authors[col], `authors table has no \`${col}\` column`);

  const dir = mkdtempSync(join(tmpdir(), 'firstshot-drizzle-'));
  const file = join(dir, 'library.db');
  let db;
  let db2;
  try {
    db = await m.openDb(file);
    expect(db && typeof db.select === 'function' && typeof db.insert === 'function', 'openDb did not return a Drizzle database');
    expect(existsSync(file), 'openDb did not create the SQLite file at the given path');

    const le = await m.addAuthor(db, 'Ursula K. Le Guin');
    const pr = await m.addAuthor(db, 'Terry Pratchett');
    expect(typeof le === 'number' && Number.isInteger(le), `addAuthor should return the new id as a number, got ${typeof le} ${JSON.stringify(le)}`);
    expect(le !== pr, 'addAuthor returned the same id for two authors');

    let dupThrew = false;
    try {
      await m.addAuthor(db, 'Terry Pratchett');
    } catch {
      dupThrew = true;
    }
    expect(dupThrew, 'adding the same author name twice was accepted (name must be unique)');

    const b1 = await m.addBook(db, { title: 'The Dispossessed', year: 1974, authorId: le });
    expect(b1 && typeof b1 === 'object' && !Array.isArray(b1), `addBook should return the inserted row object, got ${JSON.stringify(b1)}`);
    expect(Number.isInteger(b1.id), `addBook row has no integer id: ${JSON.stringify(b1)}`);
    expectEqual({ title: b1.title, year: b1.year, authorId: b1.authorId }, { title: 'The Dispossessed', year: 1974, authorId: le }, 'addBook returned row');
    await m.addBook(db, { title: 'Small Gods', year: 1992, authorId: pr });
    await m.addBook(db, { title: 'Guards! Guards!', year: 1989, authorId: pr });
    await m.addBook(db, { title: 'Tehanu', year: 1990, authorId: le });
    await m.addBook(db, { title: 'Pyramids', year: 1989, authorId: pr });

    // Our own Drizzle query through the agent's db and schema: proves both match the real tables.
    const rows = await db.select().from(books).orderBy(books.id);
    expectEqual(rows.map((r) => r.title), ['The Dispossessed', 'Small Gods', 'Guards! Guards!', 'Tehanu', 'Pyramids'], 'books read back with db.select().from(books)');

    expectEqual(await m.booksSince(db, 1989), [
      { title: 'Guards! Guards!', year: 1989, author: 'Terry Pratchett' },
      { title: 'Pyramids', year: 1989, author: 'Terry Pratchett' },
      { title: 'Tehanu', year: 1990, author: 'Ursula K. Le Guin' },
      { title: 'Small Gods', year: 1992, author: 'Terry Pratchett' },
    ], 'booksSince(1989)');
    expectEqual(await m.booksSince(db, 1993), [], 'booksSince(1993)');

    await closeDb(db);
    db = null;
    try {
      db2 = await m.openDb(file);
    } catch (e) {
      fail('wrong_behavior', `opening an existing database file again failed: ${firstLine(e)}`);
    }
    const again = await m.booksSince(db2, 1974);
    expect(Array.isArray(again) && again.length === 5, `after reopening the file, booksSince(1974) returned ${JSON.stringify(again)?.slice(0, 200)} (data must persist in the file)`);
  } finally {
    await closeDb(db);
    await closeDb(db2);
    rmSync(dir, { recursive: true, force: true });
  }
  return `drizzle-orm@${version}: schema, inserts, filtered join and persistence correct`;
});
