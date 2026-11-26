import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/libsql';
import { asc, eq, gte, sql } from 'drizzle-orm';
import * as schema from './schema.mjs';

const { authors, books } = schema;

export async function openDb(filePath) {
  const db = drizzle({ connection: { url: pathToFileURL(resolve(filePath)).href }, schema });
  await db.run(sql`CREATE TABLE IF NOT EXISTS authors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  )`);
  await db.run(sql`CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    year INTEGER NOT NULL,
    author_id INTEGER NOT NULL REFERENCES authors(id)
  )`);
  return db;
}

export async function addAuthor(db, name) {
  const [row] = await db.insert(authors).values({ name }).returning({ id: authors.id });
  return row.id;
}

export async function addBook(db, { title, year, authorId }) {
  const [row] = await db.insert(books).values({ title, year, authorId }).returning();
  return row;
}

export async function booksSince(db, year) {
  return db
    .select({ title: books.title, year: books.year, author: authors.name })
    .from(books)
    .innerJoin(authors, eq(books.authorId, authors.id))
    .where(gte(books.year, year))
    .orderBy(asc(books.year), asc(books.title));
}
