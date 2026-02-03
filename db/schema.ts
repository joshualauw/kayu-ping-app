import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  category: text("category").notNull(), // supplier, langganan, supir, lainnya
  notes: text("notes"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});
