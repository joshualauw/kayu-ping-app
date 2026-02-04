import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  category: text("category").notNull(), // supplier, client, driver, others
  notes: text("notes"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entryDate: text("entry_date").notNull(),
  contactId: integer("contact_id").references(() => contacts.id),
  amount: integer("amount").notNull(),
  type: text("type").notNull(), // sales, purchase
  notes: text("notes"),
  status: text("status").notNull().default("pending"), // pending, paid
  mediaUri: text("media_uri"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  paymentDate: text("payment_date").notNull(),
  contactId: integer("contact_id").references(() => contacts.id),
  amount: integer("amount").notNull(), // full amount
  method: text("method").notNull(), // cash, bank transfer, etc.
  type: text("type").notNull(), // income, expense
  notes: text("notes"),
  mediaUri: text("media_uri"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const paymentAllocations = sqliteTable("payment_allocations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  paymentId: integer("payment_id").references(() => payments.id),
  invoiceId: integer("invoice_id").references(() => invoices.id),
  amount: integer("amount").notNull(), // allocated amount
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});
