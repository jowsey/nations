import { smallint, integer, pgTable, text, timestamp, uuid, primaryKey } from "drizzle-orm/pg-core";

export const users = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenIdentifier: text("token_identifier").notNull().unique(),
  tokenHash: text("token_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const mapMetadata = pgTable("map_metadata", {
  id: integer("id").primaryKey().default(0),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  seed: text("seed").notNull(),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
});

export const mapCells = pgTable(
  "map_cell",
  {
    q: integer("q").notNull(),
    r: integer("r").notNull(),
    details: smallint("details").notNull(),
  },
  (table) => [primaryKey({ columns: [table.q, table.r] })],
);
