import * as schema from "@/db/schema";
import { invoices } from "@/db/schema";
import dayjs from "dayjs";
import { eq, sql } from "drizzle-orm";
import { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";

export async function generateInvoiceCode(
  tx: ExpoSQLiteDatabase<typeof schema>,
  type: "sales" | "purchase",
  contactId: number,
  entryDate: string, // Expecting YYYY-MM-DD
): Promise<string> {
  const contact = await tx.select().from(schema.contacts).where(eq(schema.contacts.id, contactId)).get();

  const initials = (contact?.name || "XX")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word: string) => word[0])
    .join("")
    .toUpperCase()
    .padEnd(2, "X");

  const typeSegment = type === "sales" ? "JUAL" : "BELI";
  const dateSegment = dayjs(entryDate).format("DDMMYY");

  const existingInvoices = await tx
    .select({ count: sql<number>`count(*)` })
    .from(invoices)
    .where(eq(invoices.entryDate, entryDate));

  const nextNumber = (existingInvoices[0]?.count || 0) + 1;
  const counterSegment = String(nextNumber).padStart(3, "0");

  return `INV-${typeSegment}-${initials}-${dateSegment}/${counterSegment}`;
}
