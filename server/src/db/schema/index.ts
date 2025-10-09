import { bigint, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  tokenIdentifier: text("token_identifier").notNull().unique(),
  tokenHash: text("token_hash").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const mapCells = pgTable(
  "map_cell",
  {
    // worth noting that id indirectly controls max map size, sqrt(max_id) = max width/height
    // number mode limits us to 2^53 which means sqrt(2^53) = ~94m max. probably fine :p
    id: bigint("id", { mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
    q: integer("q").notNull(),
    r: integer("r").notNull(),
    height: integer("height").notNull(),
  },
  (table) => [uniqueIndex("map_cell_qr_idx").on(table.q, table.r)],
);
