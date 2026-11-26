import Database from 'better-sqlite3';

const SCHEMA_VERSION = 1;

export function openDb(filePath) {
  const db = new Database(filePath);
  db.pragma('foreign_keys = ON');

  const currentVersion = db.pragma('user_version', { simple: true });
  if (currentVersion < SCHEMA_VERSION) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        total_cents INTEGER NOT NULL
      );
    `);
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }

  return db;
}

export function insertUsers(db, users) {
  const insert = db.prepare('INSERT INTO users (email, name) VALUES (?, ?)');
  const insertAll = db.transaction((rows) => {
    for (const { email, name } of rows) {
      insert.run(email, name);
    }
    return rows.length;
  });
  return insertAll(users);
}

export function addOrder(db, { userId, totalCents }) {
  const insert = db.prepare(
    'INSERT INTO orders (user_id, total_cents) VALUES (?, ?)'
  );
  const result = insert.run(userId, totalCents);
  return Number(result.lastInsertRowid);
}

export function getUserByEmail(db, email) {
  const row = db
    .prepare('SELECT id, email, name FROM users WHERE email = ?')
    .get(email);
  return row ?? null;
}

export function topSpenders(db, limit) {
  return db
    .prepare(
      `SELECT u.email AS email, SUM(o.total_cents) AS totalCents
       FROM users u
       JOIN orders o ON o.user_id = u.id
       GROUP BY u.id
       ORDER BY totalCents DESC
       LIMIT ?`
    )
    .all(limit);
}
