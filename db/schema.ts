import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const filmRecords = sqliteTable('film_records', {
  userId: text('user_id').notNull(), filmId: text('film_id').notNull(),
  watched: integer('watched').notNull().default(0), wishlist: integer('wishlist').notNull().default(0),
  watchDate: text('watch_date').notNull().default(''), rating: integer('rating').notNull().default(0),
  notes: text('notes').notNull().default(''), updatedAt: text('updated_at').notNull(),
}, t => [primaryKey({ columns: [t.userId, t.filmId] })]);
