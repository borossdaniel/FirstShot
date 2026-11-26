import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const authors = sqliteTable('authors', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
});

export const books = sqliteTable('books', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  year: integer('year').notNull(),
  authorId: integer('author_id').notNull().references(() => authors.id),
});
