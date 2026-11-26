import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, gte, asc } from 'drizzle-orm';
import * as schema from './schema.mjs';
import { authors, books } from './schema.mjs';

export function openDb(filePath) {
  const sqlite = new Database(filePath);
  sqlite.pragma('journal_mode = WAL');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      year INTEGER NOT NULL,
      author_id INTEGER NOT NULL REFERENCES authors(id)
    );
  `);

  return drizzle(sqlite, { schema });
}

export async function addAuthor(db, name) {
  const [row] = await db.insert(authors).values({ name }).returning({ id: authors.id });
  return row.id;
}

export async function addBook(db, { title, year, authorId }) {
  const [row] = await db
    .insert(books)
    .values({ title, year, authorId })
    .returning({ id: books.id, title: books.title, year: books.year, authorId: books.authorId });
  return row;
}

export async function booksSince(db, year) {
  const rows = await db
    .select({
      title: books.title,
      year: books.year,
      author: authors.name,
    })
    .from(books)
    .innerJoin(authors, eq(books.authorId, authors.id))
    .where(gte(books.year, year))
    .orderBy(asc(books.year), asc(books.title));

  return rows;
}
