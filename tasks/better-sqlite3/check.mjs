import { runCheck, expectInstalled, importSolution, importFromWorkspace, expect, expectEqual, fail, firstLine } from '../../src/check-helpers.js';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const close = (db) => {
  try {
    if (db && db.open) db.close();
  } catch {
    /* ignore */
  }
};

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'better-sqlite3', 13);
  const m = await importSolution(ws, 'db.mjs');
  for (const f of ['openDb', 'insertUsers', 'addOrder', 'getUserByEmail', 'topSpenders']) expect(typeof m[f] === 'function', `${f} is not exported`);
  const Database = (await importFromWorkspace(ws, 'better-sqlite3')).default;

  const dir = mkdtempSync(join(tmpdir(), 'oneshot-bsq3-'));
  const file = join(dir, 'shop.db');
  let db;
  let db2;
  try {
    db = await m.openDb(file);
    expect(db instanceof Database, 'openDb did not return a better-sqlite3 Database');
    expect(existsSync(file), `openDb did not create the database file at the given path`);
    expectEqual(db.pragma('user_version', { simple: true }), 1, 'PRAGMA user_version after openDb');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'orders') ORDER BY name").pluck().all();
    expectEqual(tables, ['orders', 'users'], 'tables created by the migration');

    const n = await m.insertUsers(db, [
      { email: 'ada@example.com', name: 'Ada' },
      { email: 'bob@example.com', name: 'Bob' },
      { email: 'cy@example.com', name: 'Cy' },
    ]);
    expectEqual(n, 3, 'insertUsers return value');
    const count = () => db.prepare('SELECT COUNT(*) FROM users').pluck().get();
    expectEqual(count(), 3, 'users after insertUsers');

    // All or nothing: the duplicate in the middle must roll back the whole batch.
    let threw = false;
    try {
      await m.insertUsers(db, [
        { email: 'dee@example.com', name: 'Dee' },
        { email: 'ada@example.com', name: 'Ada again' },
        { email: 'eve@example.com', name: 'Eve' },
      ]);
    } catch {
      threw = true;
    }
    expect(threw, 'insertUsers with a duplicate email did not throw');
    expect(count() === 3, `insertUsers is not all-or-nothing: a failed batch left ${count() - 3} row(s) behind (use one transaction)`);

    const ada = await m.getUserByEmail(db, 'ada@example.com');
    expect(ada && typeof ada === 'object', `getUserByEmail('ada@example.com') returned ${JSON.stringify(ada)}`);
    expectEqual({ email: ada.email, name: ada.name }, { email: 'ada@example.com', name: 'Ada' }, 'getUserByEmail(ada)');
    expect(Number.isInteger(Number(ada.id)), `getUserByEmail id should be an integer, got ${ada.id}`);
    expectEqual(await m.getUserByEmail(db, 'nobody@example.com'), null, 'getUserByEmail for a missing user');
    expectEqual(await m.getUserByEmail(db, "x' OR '1'='1"), null, 'getUserByEmail with a quote in the input (use bound parameters)');
    const bob = await m.getUserByEmail(db, 'bob@example.com');

    const o1 = await m.addOrder(db, { userId: ada.id, totalCents: 1500 });
    expect(typeof o1 === 'number' && Number.isInteger(o1), `addOrder should return the new id as a number, got ${typeof o1} ${String(o1)}`);
    const o2 = await m.addOrder(db, { userId: bob.id, totalCents: 4000 });
    await m.addOrder(db, { userId: ada.id, totalCents: 3000 });
    expect(o2 !== o1, 'addOrder returned the same id twice');

    let fkThrew = false;
    try {
      await m.addOrder(db, { userId: 9999, totalCents: 100 });
    } catch {
      fkThrew = true;
    }
    expect(fkThrew, 'an order for a user that does not exist (user_id 9999) was accepted: the foreign key is not enforced');

    expectEqual(await m.topSpenders(db, 10), [
      { email: 'ada@example.com', totalCents: 4500 },
      { email: 'bob@example.com', totalCents: 4000 },
    ], 'topSpenders(10)');
    expectEqual(await m.topSpenders(db, 1), [{ email: 'ada@example.com', totalCents: 4500 }], 'topSpenders(1)');

    // Reopening the same file must keep the data and not re-run the migration.
    close(db);
    try {
      db2 = await m.openDb(file);
    } catch (e) {
      fail('wrong_behavior', `opening an existing database file again failed: ${firstLine(e)}`);
    }
    expectEqual(db2.prepare('SELECT COUNT(*) FROM users').pluck().get(), 3, 'users after reopening the file');
    expectEqual(db2.pragma('user_version', { simple: true }), 1, 'user_version after reopening');
    let fkThrew2 = false;
    try {
      await m.addOrder(db2, { userId: 4242, totalCents: 1 });
    } catch {
      fkThrew2 = true;
    }
    expect(fkThrew2, 'after reopening the file, an order for a missing user was accepted (foreign keys must be enabled on every connection)');
  } finally {
    close(db);
    close(db2);
    rmSync(dir, { recursive: true, force: true });
  }
  return `better-sqlite3@${version}: migration, atomic batch insert, foreign keys and prepared queries correct`;
});
