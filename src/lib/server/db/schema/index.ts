import { integer, pgTable, primaryKey, real, varchar } from 'drizzle-orm/pg-core';

export const players = pgTable('player', {
	id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
	name: varchar('name').notNull() // placeholder
});

export const mapCells = pgTable(
	'map_cell',
	{
		q: integer('q').notNull(),
		r: integer('r').notNull(),
		height: real('height').notNull()
	},
	(table) => [primaryKey({ columns: [table.q, table.r] })]
);

export * from './better-auth';
