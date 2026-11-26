import Database from 'better-sqlite3';

const migrations = [
  `CREATE TABLE users (
     id INTEGER PRIMARY KEY,
     email TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL
   );
   CREATE TABLE orders (
     id INTEGER PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id),
     total_cents INTEGER NOT NULL
   );`,
];

export function openDb(filePath) {
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const current = db.pragma('user_version', { simple: true });
  db.transaction(() => {
    for (let v = current; v < migrations.length; v++) {
      db.exec(migrations[v]);
      db.pragma(`user_version = ${v + 1}`);
    }
  })();
  return db;
}

export async function insertUsers(db, users) {
  const insert = db.prepare('INSERT INTO users (email, name) VALUES (@email, @name)');
  const insertAll = db.transaction(async (rows) => {
    for (const row of rows) insert.run(row);
    return rows.length;
  });
  return await insertAll(users);
}

export function addOrder(db, { userId, totalCents }) {
  const info = db.prepare('INSERT INTO orders (user_id, total_cents) VALUES (?, ?)').run(userId, totalCents);
  return Number(info.lastInsertRowid);
}

export function getUserByEmail(db, email) {
  return db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email) ?? null;
}

export function topSpenders(db, limit) {
  return db
    .prepare(
      `SELECT u.email AS email, SUM(o.total_cents) AS totalCents
         FROM users u JOIN orders o ON o.user_id = u.id
        GROUP BY u.id
        ORDER BY totalCents DESC
        LIMIT ?`,
    )
    .all(limit);
}
