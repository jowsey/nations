import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
